-- Cluster administrator only, on a dedicated NEW TraceMigo database.
-- No login credentials or service accounts are created here.
DO $bootstrap$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['tracemigo_owner','tracemigo_app_role','tracemigo_peer_role','tracemigo_judge_role','tracemigo_assessment_role','tracemigo_publisher_role','tracemigo_worker_role','tracemigo_billing_role','tracemigo_identity_role','tracemigo_privacy_role'] LOOP
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',role_name);
    ELSIF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname=role_name AND
      (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
      RAISE EXCEPTION 'Unsafe existing TraceMigo group role';
    END IF;
  END LOOP;
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC',current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO tracemigo_owner,tracemigo_app_role,tracemigo_peer_role,tracemigo_judge_role,tracemigo_assessment_role,tracemigo_publisher_role,tracemigo_worker_role,tracemigo_billing_role,tracemigo_identity_role,tracemigo_privacy_role',current_database());
END $bootstrap$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION tracemigo_owner;
CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION tracemigo_owner;
CREATE SCHEMA IF NOT EXISTS ops AUTHORIZATION tracemigo_owner;
DO $verify$
DECLARE n text;
BEGIN
 IF EXISTS(SELECT FROM pg_namespace WHERE nspname IN('app','private','ops') AND nspowner<>(SELECT oid FROM pg_roles WHERE rolname='tracemigo_owner')) THEN RAISE EXCEPTION 'Unexpected schema owner'; END IF;
 FOREACH n IN ARRAY ARRAY['tracemigo_app_role','tracemigo_peer_role','tracemigo_judge_role','tracemigo_assessment_role','tracemigo_publisher_role','tracemigo_worker_role','tracemigo_billing_role','tracemigo_identity_role','tracemigo_privacy_role'] LOOP
  IF pg_has_role(n,'tracemigo_owner','MEMBER') THEN RAISE EXCEPTION 'Service group inherits migration ownership'; END IF;
 END LOOP;
END $verify$;
REVOKE ALL ON SCHEMA app, private, ops FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO tracemigo_app_role,tracemigo_peer_role,tracemigo_judge_role,tracemigo_assessment_role,tracemigo_publisher_role,tracemigo_worker_role,tracemigo_billing_role,tracemigo_identity_role,tracemigo_privacy_role;
GRANT USAGE ON SCHEMA private TO tracemigo_judge_role,tracemigo_assessment_role,tracemigo_publisher_role;
GRANT USAGE ON SCHEMA ops TO tracemigo_app_role,tracemigo_worker_role,tracemigo_billing_role,tracemigo_privacy_role;
ALTER DEFAULT PRIVILEGES FOR ROLE tracemigo_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
