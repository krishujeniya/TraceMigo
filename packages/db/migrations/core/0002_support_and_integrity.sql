-- Additive expansion: v1 clients can keep using their existing explicit columns.
ALTER TABLE app.attempts ADD COLUMN last_activity_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX attempts_activity ON app.attempts(tenant_id,user_id,last_activity_at);
CREATE TABLE private.rubric_nodes(
 problem_version_id uuid REFERENCES app.problem_versions(id),id text,concept_id text NOT NULL REFERENCES app.concepts(id),kind text NOT NULL,
 anchors jsonb NOT NULL CHECK(app.valid_envelope(anchors,'rubric.anchors.v1')),source_spans jsonb NOT NULL CHECK(app.valid_envelope(source_spans,'source.spans.v1')),
 oracle_refs jsonb NOT NULL CHECK(app.valid_envelope(oracle_refs,'oracle.refs.v1')),PRIMARY KEY(problem_version_id,id)
);
CREATE TABLE private.rubric_edges(
 problem_version_id uuid,from_id text,to_id text,relation text CHECK(relation IN('supports','contradicts','depends_on')),
 PRIMARY KEY(problem_version_id,from_id,to_id,relation),CHECK(from_id<>to_id),
 FOREIGN KEY(problem_version_id,from_id) REFERENCES private.rubric_nodes(problem_version_id,id),
 FOREIGN KEY(problem_version_id,to_id) REFERENCES private.rubric_nodes(problem_version_id,id)
);
CREATE TABLE private.content_reviews(
 id uuid PRIMARY KEY,version_id uuid NOT NULL REFERENCES app.problem_versions(id),reviewer_id uuid NOT NULL REFERENCES app.users(id),revision integer NOT NULL CHECK(revision>0),
 decision text NOT NULL CHECK(decision IN('approve','reject','changes_requested')),test_report_hash app.sha256 NOT NULL,
 notes jsonb NOT NULL CHECK(app.valid_envelope(notes,'content.review.v1')),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(version_id,reviewer_id,revision)
);
CREATE TABLE private.source_provenance(
 id uuid PRIMARY KEY,version_id uuid NOT NULL REFERENCES app.problem_versions(id),repo_url text NOT NULL CHECK(repo_url ~ '^https://'),
 commit_sha text NOT NULL CHECK(commit_sha ~ '^([0-9a-f]{40}|[0-9a-f]{64})$'),path text NOT NULL,
 original_span jsonb NOT NULL CHECK(app.valid_envelope(original_span,'source.span.v1')),file_hash app.sha256 NOT NULL,
 license_expression text NOT NULL CHECK(length(license_expression)>0),notice_key text NOT NULL,
 transformation_log jsonb NOT NULL CHECK(app.valid_envelope(transformation_log,'source.transform.v1')),
 approval_state text NOT NULL CHECK(approval_state IN('quarantine','approved','rejected')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.problem_retirements(
 version_id uuid PRIMARY KEY REFERENCES app.problem_versions(id),reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z_]{1,80}$'),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION app.valid_scores(payload jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE key text; names text[]:=ARRAY['functional_model','trace','bug_reasoning','complexity','refactoring','communication'];
BEGIN
 IF NOT app.valid_envelope(payload,'assessment.scores.v1') OR (payload->'data')-names<>'{}'::jsonb THEN RETURN false; END IF;
 FOREACH key IN ARRAY names LOOP
  IF jsonb_typeof(payload->'data'->key) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
  IF (payload->'data'->>key)::numeric NOT BETWEEN 0 AND 4 THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
CREATE TABLE app.assessment_results(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,attempt_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),rubric_version text NOT NULL,
 dimension_scores jsonb NOT NULL CHECK(app.valid_scores(dimension_scores)),evidence_ids jsonb NOT NULL CHECK(app.valid_envelope(evidence_ids,'assessment.evidence.v1')),
 confidence numeric NOT NULL CHECK(confidence BETWEEN 0 AND 1),decision_source text NOT NULL CHECK(decision_source IN('deterministic','human_review')),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(attempt_id,revision),UNIQUE(tenant_id,user_id,attempt_id,id),
 FOREIGN KEY(tenant_id,user_id,attempt_id) REFERENCES app.attempts(tenant_id,user_id,id)
);
CREATE TABLE app.appeals(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,attempt_id uuid NOT NULL,result_id uuid NOT NULL,
 explanation text NOT NULL CHECK(length(explanation) BETWEEN 1 AND 8192),status text NOT NULL DEFAULT 'open' CHECK(status IN('open','under_review','resolved','rejected')),
 reviewer_id uuid REFERENCES app.users(id),decision text CHECK(decision IN('upheld','corrected','rejected')),replacement_result_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,user_id,attempt_id,result_id) REFERENCES app.assessment_results(tenant_id,user_id,attempt_id,id),
 FOREIGN KEY(tenant_id,user_id,attempt_id,replacement_result_id) REFERENCES app.assessment_results(tenant_id,user_id,attempt_id,id),
 CHECK(result_id IS DISTINCT FROM replacement_result_id),CHECK((decision IS NOT DISTINCT FROM 'corrected')=(replacement_result_id IS NOT NULL)),
 CHECK((status IN('resolved','rejected'))=(decision IS NOT NULL)),CHECK(decision IS NULL OR reviewer_id IS NOT NULL)
);
CREATE TABLE app.user_preferences(
 id uuid PRIMARY KEY,user_id uuid NOT NULL UNIQUE REFERENCES app.users(id),locale text NOT NULL DEFAULT 'en',timezone text NOT NULL DEFAULT 'UTC',
 assistance_settings jsonb NOT NULL CHECK(app.valid_envelope(assistance_settings,'preferences.assistance.v1')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.consents(
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES app.users(id),purpose text NOT NULL CHECK(purpose IN('voice','journal','research','personalization')),
 consent_version text NOT NULL,granted_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,purpose,consent_version),CHECK(revoked_at IS NULL OR revoked_at>=granted_at)
);
CREATE TABLE ops.billing_events(
 id uuid PRIMARY KEY,provider text NOT NULL CHECK(provider IN('razorpay')),external_event_id text NOT NULL,payload_hash app.sha256 NOT NULL,
 processing_state text NOT NULL DEFAULT 'received' CHECK(processing_state IN('received','processed','rejected','retry')),
 verified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(provider,external_event_id),CHECK(processing_state<>'processed' OR verified_at IS NOT NULL)
);
CREATE TABLE app.entitlements(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,product text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 quota_policy jsonb NOT NULL CHECK(app.valid_envelope(quota_policy,'entitlement.quota.v1')),provider_purchase_id text NOT NULL,
 state text NOT NULL DEFAULT 'active' CHECK(state IN('active','revoked','expired')),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(provider_purchase_id,product),
 FOREIGN KEY(tenant_id,user_id) REFERENCES app.memberships(tenant_id,user_id),CHECK(ends_at>starts_at)
);
CREATE TABLE ops.quota_reservations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,operation_id uuid NOT NULL UNIQUE,
 estimated_units bigint NOT NULL CHECK(estimated_units>=0),estimated_usd_micros bigint NOT NULL CHECK(estimated_usd_micros>=0),expires_at timestamptz NOT NULL,
 actual_units bigint CHECK(actual_units>=0),actual_usd_micros bigint CHECK(actual_usd_micros>=0),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN('reserved','settled','released','expired')),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,user_id) REFERENCES app.memberships(tenant_id,user_id),CHECK(expires_at>created_at),CHECK(state<>'settled' OR (actual_units IS NOT NULL AND actual_usd_micros IS NOT NULL))
);
CREATE TABLE ops.idempotency_records(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,route text NOT NULL CHECK(route ~ '^/v1/'),key text NOT NULL CHECK(length(key) BETWEEN 1 AND 200),
 request_hash app.sha256 NOT NULL,response jsonb CHECK(response IS NULL OR app.valid_envelope(response,'idempotency.response.v1')),response_status integer CHECK(response_status BETWEEN 100 AND 599),expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','completed')),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,user_id,route,key),FOREIGN KEY(tenant_id,user_id) REFERENCES app.memberships(tenant_id,user_id),CHECK(expires_at>created_at),
 CHECK((state='pending' AND response IS NULL AND response_status IS NULL) OR (state='completed' AND response IS NOT NULL AND response_status IS NOT NULL))
);
CREATE TABLE ops.audit_events(
 id uuid PRIMARY KEY,tenant_id uuid,actor_id uuid,target_id uuid NOT NULL,action text NOT NULL CHECK(action ~ '^[A-Z_]{1,80}$'),reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z_]{1,80}$'),created_at timestamptz NOT NULL DEFAULT now()
);
-- Tombstones intentionally outlive user rows and therefore do not FK to users.
CREATE TABLE ops.deletion_requests(
 id uuid PRIMARY KEY,user_id uuid NOT NULL,generation bigint NOT NULL CHECK(generation>0),
 scope jsonb NOT NULL CHECK(app.valid_envelope(scope,'deletion.scope.v1')),checkpoints jsonb NOT NULL CHECK(app.valid_envelope(checkpoints,'deletion.checkpoints.v1')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','running','completed','failed')),error_code text CHECK(error_code ~ '^[A-Z_]{1,80}$'),
 created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,UNIQUE(user_id,generation),CHECK((state='completed')=(completed_at IS NOT NULL)),CHECK(state<>'failed' OR error_code IS NOT NULL)
);
CREATE FUNCTION private.guard_content_child() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE version_id uuid; publication text;
BEGIN
 IF TG_TABLE_NAME IN('rubric_nodes','rubric_edges') THEN
  IF TG_OP='DELETE' THEN version_id:=OLD.problem_version_id; ELSE version_id:=NEW.problem_version_id; END IF;
  IF TG_OP='UPDATE' AND OLD.problem_version_id<>NEW.problem_version_id THEN RAISE EXCEPTION 'Content parent is immutable' USING ERRCODE='23514'; END IF;
 ELSE
  IF TG_OP='DELETE' THEN version_id:=OLD.version_id; ELSE version_id:=NEW.version_id; END IF;
  IF TG_OP='UPDATE' AND OLD.version_id<>NEW.version_id THEN RAISE EXCEPTION 'Content parent is immutable' USING ERRCODE='23514'; END IF;
 END IF;
 SELECT status::text INTO publication FROM app.problem_versions WHERE id=version_id FOR UPDATE;
 IF publication IN('published','retired') THEN RAISE EXCEPTION 'Published content child is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION private.guard_publication() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE approvals integer;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' THEN RAISE EXCEPTION 'Content starts in draft' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.status IN('published','retired') THEN RAISE EXCEPTION 'Published version is immutable; append retirement or new version' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.id<>OLD.id OR NEW.problem_id<>OLD.problem_id OR NEW.version_number<>OLD.version_number THEN RAISE EXCEPTION 'Version identity is immutable' USING ERRCODE='23514'; END IF;
 IF NEW.status='published' THEN
  IF OLD.status<>'review' THEN RAISE EXCEPTION 'Publication requires review state' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO approvals FROM(SELECT DISTINCT ON(reviewer_id) decision FROM private.content_reviews WHERE version_id=NEW.id ORDER BY reviewer_id,revision DESC) r WHERE decision='approve';
  IF approvals<2 OR NOT EXISTS(SELECT FROM private.problem_authorities WHERE version_id=NEW.id) THEN RAISE EXCEPTION 'Publication needs two reviewers and authority' USING ERRCODE='23514'; END IF;
 ELSIF NEW.status='retired' THEN RAISE EXCEPTION 'Retire via separate record' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER published_immutable BEFORE INSERT OR UPDATE OR DELETE ON app.problem_versions FOR EACH ROW EXECUTE FUNCTION private.guard_publication();
CREATE FUNCTION private.guard_problem_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT FROM app.problem_versions WHERE problem_id=OLD.id AND status IN('published','retired')) THEN RAISE EXCEPTION 'Published problem identity is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER published_problem_immutable BEFORE UPDATE OR DELETE ON app.problems FOR EACH ROW EXECUTE FUNCTION private.guard_problem_identity();
CREATE FUNCTION app.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Append-only record' USING ERRCODE='23514'; END $$;
CREATE FUNCTION app.guard_assessment_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE expected integer;
BEGIN
 PERFORM 1 FROM app.attempts WHERE id=NEW.attempt_id FOR UPDATE;
 SELECT COALESCE(max(revision),0)+1 INTO expected FROM app.assessment_results WHERE attempt_id=NEW.attempt_id;
 IF NEW.revision<>expected THEN RAISE EXCEPTION 'Assessment revision must be next' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assessment_revision BEFORE INSERT ON app.assessment_results FOR EACH ROW EXECUTE FUNCTION app.guard_assessment_revision();
CREATE TRIGGER assessment_immutable BEFORE UPDATE OR DELETE ON app.assessment_results FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER events_immutable BEFORE UPDATE OR DELETE ON app.attempt_events FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER submissions_immutable BEFORE UPDATE OR DELETE ON app.submissions FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON ops.usage_ledger FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON ops.audit_events FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER retirement_immutable BEFORE UPDATE OR DELETE ON app.problem_retirements FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER content_child_immutable BEFORE INSERT OR UPDATE OR DELETE ON private.problem_authorities FOR EACH ROW EXECUTE FUNCTION private.guard_content_child();
CREATE TRIGGER content_child_immutable BEFORE INSERT OR UPDATE OR DELETE ON private.rubric_nodes FOR EACH ROW EXECUTE FUNCTION private.guard_content_child();
CREATE TRIGGER content_child_immutable BEFORE INSERT OR UPDATE OR DELETE ON private.rubric_edges FOR EACH ROW EXECUTE FUNCTION private.guard_content_child();
CREATE TRIGGER content_child_immutable BEFORE INSERT OR UPDATE OR DELETE ON private.content_reviews FOR EACH ROW EXECUTE FUNCTION private.guard_content_child();
CREATE TRIGGER content_child_immutable BEFORE INSERT OR UPDATE OR DELETE ON private.source_provenance FOR EACH ROW EXECUTE FUNCTION private.guard_content_child();
ALTER TABLE app.problem_retirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.problem_retirements FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.problem_retirements TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.assessment_results FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.assessment_results TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.appeals FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.appeals TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.user_preferences TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.consents FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.consents TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE app.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.entitlements FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON app.entitlements TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE ops.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.billing_events FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON ops.billing_events TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE ops.quota_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.quota_reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON ops.quota_reservations TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE ops.idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.idempotency_records FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON ops.idempotency_records TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE ops.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON ops.audit_events TO tracemigo_owner USING(true) WITH CHECK(true);
ALTER TABLE ops.deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.deletion_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_maintenance ON ops.deletion_requests TO tracemigo_owner USING(true) WITH CHECK(true);
GRANT SELECT ON app.assessment_results,app.appeals,app.user_preferences,app.consents,app.entitlements TO tracemigo_app_role;
GRANT INSERT,UPDATE ON app.appeals,app.user_preferences,app.consents TO tracemigo_app_role;
GRANT SELECT,INSERT ON app.assessment_results TO tracemigo_assessment_role;
GRANT SELECT ON private.rubric_nodes,private.rubric_edges TO tracemigo_assessment_role,tracemigo_judge_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.content_reviews,private.source_provenance,private.rubric_nodes,private.rubric_edges TO tracemigo_publisher_role;
GRANT INSERT ON app.problem_retirements TO tracemigo_publisher_role;
GRANT SELECT,INSERT,UPDATE ON app.users,app.memberships TO tracemigo_identity_role;
GRANT SELECT,INSERT,UPDATE ON app.entitlements,ops.billing_events,ops.quota_reservations TO tracemigo_billing_role;
GRANT SELECT,INSERT,UPDATE ON ops.idempotency_records TO tracemigo_app_role;
GRANT INSERT ON ops.audit_events TO tracemigo_app_role,tracemigo_worker_role;
GRANT SELECT,INSERT,UPDATE ON ops.deletion_requests TO tracemigo_privacy_role;
GRANT EXECUTE ON FUNCTION app.valid_envelope(jsonb,text),app.valid_scores(jsonb) TO tracemigo_assessment_role;

GRANT EXECUTE ON FUNCTION app.valid_envelope(jsonb,text) TO tracemigo_worker_role,tracemigo_privacy_role,tracemigo_identity_role,tracemigo_judge_role;

CREATE FUNCTION ops.guard_outbox_update() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF ROW(NEW.id,NEW.tenant_id,NEW.user_id,NEW.attempt_id,NEW.aggregate_id,NEW.topic,NEW.operation_id,NEW.payload,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.user_id,OLD.attempt_id,OLD.aggregate_id,OLD.topic,OLD.operation_id,OLD.payload,OLD.created_at)
 OR NEW.attempts<OLD.attempts OR (OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at)
 OR (NEW.published_at IS NOT NULL AND NEW.published_at<NEW.created_at) THEN
 RAISE EXCEPTION 'Outbox identity and accepted payload are immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outbox_identity BEFORE UPDATE ON ops.outbox FOR EACH ROW EXECUTE FUNCTION ops.guard_outbox_update();
CREATE FUNCTION ops.guard_idempotency_update() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF ROW(NEW.id,NEW.tenant_id,NEW.user_id,NEW.route,NEW.key,NEW.request_hash,NEW.expires_at,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.user_id,OLD.route,OLD.key,OLD.request_hash,OLD.expires_at,OLD.created_at)
 OR OLD.state='completed' THEN RAISE EXCEPTION 'Idempotency identity or completed response is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER idempotency_identity BEFORE UPDATE ON ops.idempotency_records FOR EACH ROW EXECUTE FUNCTION ops.guard_idempotency_update();
