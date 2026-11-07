-- Core schema. Executed atomically as tracemigo_owner; no optional extensions.
CREATE DOMAIN app.sha256 AS text CHECK (VALUE ~ '^[0-9a-f]{64}$');
CREATE DOMAIN app.image_digest AS text CHECK (VALUE ~ '^sha256:[0-9a-f]{64}$');
CREATE TYPE app.attempt_mode AS ENUM ('practice','mock_solo','mock_ai');
CREATE TYPE app.attempt_stage AS ENUM ('warmup','predict','trace','explain','mutate','review');
CREATE TYPE app.problem_difficulty AS ENUM ('foundation','core','advanced');
CREATE TYPE app.publication_status AS ENUM ('draft','review','published','retired');
CREATE FUNCTION app.valid_envelope(payload jsonb, version text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT COALESCE(jsonb_typeof(payload)='object' AND payload->>'schema_version'=version
 AND jsonb_typeof(payload->'data')='object'
 AND payload-ARRAY['schema_version','data']='{}'::jsonb
 AND octet_length(payload::text)<=65536,false)
$$;
CREATE TABLE app.tenants(id uuid PRIMARY KEY,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app.users(id uuid PRIMARY KEY,oidc_issuer text NOT NULL,oidc_subject text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(oidc_issuer,oidc_subject));
CREATE TABLE app.memberships(tenant_id uuid REFERENCES app.tenants(id),user_id uuid REFERENCES app.users(id),role text NOT NULL CHECK(role IN('learner','reviewer','admin')),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,user_id));
CREATE TABLE app.problems(id uuid PRIMARY KEY,slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),family_id text NOT NULL,difficulty app.problem_difficulty NOT NULL,sealed boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app.problem_versions(
 id uuid PRIMARY KEY,problem_id uuid NOT NULL REFERENCES app.problems(id),version_number integer NOT NULL CHECK(version_number>0),
 status app.publication_status NOT NULL DEFAULT 'draft',language text NOT NULL CHECK(language='python'),
 content_hash app.sha256 NOT NULL,public_manifest_key text NOT NULL CHECK(length(public_manifest_key)>0),
 public_manifest jsonb NOT NULL CHECK(app.valid_envelope(public_manifest,'case.public.v1')),
 runtime_digest app.image_digest NOT NULL,published_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(problem_id,version_number),CHECK((status IN('published','retired'))=(published_at IS NOT NULL))
);
CREATE TABLE private.problem_authorities(version_id uuid PRIMARY KEY REFERENCES app.problem_versions(id),private_bundle_key text NOT NULL CHECK(length(private_bundle_key)>0),oracle_hash app.sha256 NOT NULL,witness_hash app.sha256 NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app.concepts(id text PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 120),title text NOT NULL);
CREATE TABLE app.concept_edges(id uuid PRIMARY KEY,from_id text NOT NULL REFERENCES app.concepts(id),to_id text NOT NULL REFERENCES app.concepts(id),relation text NOT NULL CHECK(relation IN('prerequisite','related')),UNIQUE(from_id,to_id,relation),CHECK(from_id<>to_id));
CREATE INDEX concept_prerequisites ON app.concept_edges(from_id,to_id) WHERE relation='prerequisite';
CREATE TABLE app.attempts(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,problem_version_id uuid NOT NULL REFERENCES app.problem_versions(id),
 mode app.attempt_mode NOT NULL,stage app.attempt_stage NOT NULL DEFAULT 'warmup',
 status text NOT NULL DEFAULT 'active' CHECK(status IN('active','paused','submitted','assessing','completed','abandoned')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),disclosure_level integer NOT NULL DEFAULT 0 CHECK(disclosure_level BETWEEN 0 AND 6),
 context_source text NOT NULL DEFAULT 'direct' CHECK(context_source IN('direct','spaced_retrieval')),prior_attempt_id uuid,
 started_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,user_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES app.memberships(tenant_id,user_id),
 FOREIGN KEY(tenant_id,user_id,prior_attempt_id) REFERENCES app.attempts(tenant_id,user_id,id),
 CHECK(prior_attempt_id IS NULL OR prior_attempt_id<>id),
 CHECK((context_source='spaced_retrieval')=(prior_attempt_id IS NOT NULL)),
 CHECK((status IN('completed','abandoned'))=(finished_at IS NOT NULL)),CHECK(finished_at IS NULL OR finished_at>=started_at)
);
CREATE TABLE app.attempt_events(
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,attempt_id uuid NOT NULL,seq bigint NOT NULL CHECK(seq>0),event_id uuid NOT NULL UNIQUE,
 event_type text NOT NULL CHECK(length(event_type) BETWEEN 1 AND 100),payload jsonb NOT NULL CHECK(app.valid_envelope(payload,'attempt.event.v1')),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,attempt_id,seq),
 FOREIGN KEY(tenant_id,user_id,attempt_id) REFERENCES app.attempts(tenant_id,user_id,id)
);
CREATE TABLE app.submissions(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,attempt_id uuid NOT NULL,
 source_sha256 app.sha256 NOT NULL,object_key text NOT NULL CHECK(length(object_key)>0),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,user_id,attempt_id,id),FOREIGN KEY(tenant_id,user_id,attempt_id) REFERENCES app.attempts(tenant_id,user_id,id)
);
CREATE TABLE app.execution_jobs(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,attempt_id uuid NOT NULL,submission_id uuid NOT NULL,
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),request_sha256 app.sha256 NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','leased','running','succeeded','failed','cancelled','expired')),
 lease_epoch bigint NOT NULL DEFAULT 0 CHECK(lease_epoch>=0),lease_until timestamptz,runtime_digest app.image_digest NOT NULL,
 result_key text,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,user_id,attempt_id,id),UNIQUE(tenant_id,user_id,idempotency_key),
 FOREIGN KEY(tenant_id,user_id,attempt_id,submission_id) REFERENCES app.submissions(tenant_id,user_id,attempt_id,id),
 CHECK((state IN('leased','running'))=(lease_until IS NOT NULL))
);
CREATE TABLE app.observations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,attempt_id uuid NOT NULL,execution_job_id uuid,kind text NOT NULL,
 evidence jsonb NOT NULL CHECK(app.valid_envelope(evidence,'observation.v1')),
 verification_status text NOT NULL CHECK(verification_status IN('unverified','verified','rejected')),verifier_version text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,user_id,attempt_id) REFERENCES app.attempts(tenant_id,user_id,id),
 FOREIGN KEY(tenant_id,user_id,attempt_id,execution_job_id) REFERENCES app.execution_jobs(tenant_id,user_id,attempt_id,id)
);
CREATE TABLE app.skill_evidence(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,attempt_id uuid NOT NULL,concept_id text NOT NULL REFERENCES app.concepts(id),
 independent boolean NOT NULL,outcome text NOT NULL CHECK(outcome IN('correct','partial','incorrect','unavailable')),assistance_level integer NOT NULL CHECK(assistance_level BETWEEN 0 AND 6),evidence_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(attempt_id,concept_id,evidence_version),FOREIGN KEY(tenant_id,user_id,attempt_id) REFERENCES app.attempts(tenant_id,user_id,id),CHECK(NOT independent OR assistance_level=0)
);
CREATE TABLE app.peer_turns(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,attempt_id uuid NOT NULL,turn_number integer NOT NULL CHECK(turn_number>0),
 role text NOT NULL CHECK(role IN('learner','peer')),role_reason jsonb NOT NULL CHECK(app.valid_envelope(role_reason,'peer.reason.v1')),
 model_id text NOT NULL,prompt_version text NOT NULL,evidence_ids jsonb NOT NULL CHECK(app.valid_envelope(evidence_ids,'peer.evidence.v1')),
 confirmed_text text,usage jsonb NOT NULL CHECK(app.valid_envelope(usage,'peer.usage.v1')),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(attempt_id,turn_number),
 FOREIGN KEY(tenant_id,user_id,attempt_id) REFERENCES app.attempts(tenant_id,user_id,id)
);
CREATE TABLE ops.outbox(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,attempt_id uuid NOT NULL,aggregate_id uuid NOT NULL,
 topic text NOT NULL CHECK(length(topic) BETWEEN 1 AND 100),operation_id uuid NOT NULL UNIQUE,
 payload jsonb NOT NULL CHECK(app.valid_envelope(payload,'outbox.v1')),created_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),FOREIGN KEY(tenant_id,user_id,attempt_id) REFERENCES app.attempts(tenant_id,user_id,id)
);
CREATE TABLE ops.usage_ledger(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,operation_id uuid NOT NULL,
 entry_type text NOT NULL CHECK(entry_type IN('reserve','settle','release','refund')),usd_micros bigint NOT NULL CHECK(usd_micros>=0),units bigint NOT NULL CHECK(units>=0),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(operation_id,entry_type),FOREIGN KEY(tenant_id,user_id) REFERENCES app.memberships(tenant_id,user_id)
);
CREATE INDEX attempts_owner_time ON app.attempts(tenant_id,user_id,started_at DESC);
CREATE INDEX execution_dispatch ON app.execution_jobs(state,created_at);
CREATE INDEX pending_outbox ON ops.outbox(created_at) WHERE published_at IS NULL;
CREATE INDEX observations_attempt ON app.observations(tenant_id,user_id,attempt_id);
CREATE FUNCTION app.guard_attempt_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF ROW(NEW.id,NEW.tenant_id,NEW.user_id,NEW.problem_version_id,NEW.prior_attempt_id,NEW.context_source,NEW.started_at) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.user_id,OLD.problem_version_id,OLD.prior_attempt_id,OLD.context_source,OLD.started_at) THEN
  RAISE EXCEPTION 'Attempt identity is immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Revision must increase by one' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER attempt_revision BEFORE UPDATE ON app.attempts FOR EACH ROW EXECUTE FUNCTION app.guard_attempt_revision();
CREATE FUNCTION app.guard_prerequisite_cycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.relation<>'prerequisite' THEN RETURN NEW; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Graph edits require read committed isolation' USING ERRCODE='25001'; END IF;
 PERFORM pg_advisory_xact_lock(73001701);
 IF EXISTS(WITH RECURSIVE reach(id) AS (
  SELECT NEW.to_id UNION SELECT e.to_id FROM app.concept_edges e JOIN reach r ON e.from_id=r.id
  WHERE e.relation='prerequisite' AND e.id<>NEW.id
 ) SELECT FROM reach WHERE id=NEW.from_id) THEN RAISE EXCEPTION 'Prerequisite cycle' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER concept_dag BEFORE INSERT OR UPDATE ON app.concept_edges FOR EACH ROW EXECUTE FUNCTION app.guard_prerequisite_cycle();
-- Personal data and even public catalog start default-deny. Later tasks add reviewed policies.
ALTER TABLE app.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.tenants TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.users FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.users TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.memberships TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.problems FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.problems TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.problem_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.problem_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.problem_versions TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.concepts FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.concepts TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.concept_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.concept_edges FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.concept_edges TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.attempts TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.attempt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.attempt_events FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.attempt_events TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.submissions FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.submissions TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.execution_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.execution_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.execution_jobs TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.observations FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.observations TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.skill_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.skill_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.skill_evidence TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.peer_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.peer_turns FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.peer_turns TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE ops.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON ops.outbox TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE ops.usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.usage_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON ops.usage_ledger TO tracemigo_owner USING(true) WITH CHECK(true);
GRANT SELECT ON app.problems,app.problem_versions,app.concepts,app.concept_edges TO tracemigo_app_role,tracemigo_peer_role;
GRANT SELECT,INSERT,UPDATE ON app.attempts,app.attempt_events,app.submissions TO tracemigo_app_role;
GRANT SELECT ON app.execution_jobs,app.observations,app.skill_evidence,app.peer_turns TO tracemigo_app_role;
GRANT SELECT,INSERT ON app.peer_turns TO tracemigo_peer_role;
GRANT SELECT ON app.problem_versions TO tracemigo_judge_role,tracemigo_assessment_role,tracemigo_publisher_role;
GRANT SELECT ON private.problem_authorities TO tracemigo_judge_role,tracemigo_assessment_role;
GRANT SELECT,INSERT,UPDATE ON app.problems,app.problem_versions,app.concepts,app.concept_edges TO tracemigo_publisher_role;
GRANT SELECT,INSERT,UPDATE ON private.problem_authorities TO tracemigo_publisher_role;
GRANT INSERT ON ops.outbox TO tracemigo_app_role;
GRANT SELECT,UPDATE ON ops.outbox TO tracemigo_worker_role;
GRANT SELECT,INSERT ON ops.usage_ledger TO tracemigo_billing_role;
GRANT EXECUTE ON FUNCTION app.valid_envelope(jsonb,text) TO tracemigo_app_role,tracemigo_peer_role,tracemigo_publisher_role,tracemigo_assessment_role,tracemigo_billing_role;
