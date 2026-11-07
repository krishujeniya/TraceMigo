-- Optional later capability, NOT discovered by the core runner. Requires separate approval and pgvector availability.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
CREATE TABLE private.content_embeddings(
 problem_version_id uuid REFERENCES app.problem_versions(id),chunk_id text,embedding_model text,
 text_sha256 app.sha256 NOT NULL,embedding public.vector(768) NOT NULL,
 PRIMARY KEY(problem_version_id,chunk_id,embedding_model)
);
REVOKE ALL ON private.content_embeddings FROM PUBLIC;
