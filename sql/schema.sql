-- DevSage schema: documents + chunks with pgvector embeddings.
-- Run via `npm run db:migrate` (scripts/migrate.ts) or paste into the Neon SQL editor.

create extension if not exists vector;

create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('url', 'repo')),
  source_ref  text not null,
  title       text,
  created_at  timestamptz not null default now()
);

create table if not exists chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content     text not null,
  embedding   vector(1536),
  token_count integer,
  metadata    jsonb not null default '{}'::jsonb
);

-- Approximate nearest-neighbour index for cosine distance.
-- ivfflat needs ANALYZE after data load to be effective; fine for MVP scale.
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists chunks_document_id_idx on chunks (document_id);
