import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon serverless Postgres client (HTTP). Works in both Node and edge runtimes.
 * The connection string lives in DATABASE_URL (see .env.example).
 *
 * The client is created lazily on first use (not at module load) so that
 * importing this module during the build — e.g. while collecting page data —
 * doesn't crash when DATABASE_URL is absent.
 */
let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string."
      );
    }
    client = neon(url);
  }
  return client;
}

// A transparent proxy so callers keep the ergonomic `sql\`...\`` tagged-template
// API (and `sql.transaction`, `sql.query`) while initialization stays lazy.
export const sql = new Proxy(
  function () {} as unknown as NeonQueryFunction<false, false>,
  {
    apply(_target, _thisArg, args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (getClient() as any)(...args);
    },
    get(_target, prop) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = getClient() as any;
      const value = c[prop];
      return typeof value === "function" ? value.bind(c) : value;
    },
  }
);

/** The embedding dimension we store. Must match the embedding model (text-embedding-3-small = 1536). */
export const EMBEDDING_DIM = 1536;

export type DocumentRow = {
  id: string;
  source_type: "url" | "repo";
  source_ref: string;
  title: string | null;
  created_at: string;
  chunk_count?: number;
};

export type RetrievedChunk = {
  id: string;
  document_id: string;
  content: string;
  metadata: ChunkMetadata;
  similarity: number;
  source_ref: string;
  source_type: "url" | "repo";
  title: string | null;
};

export type ChunkMetadata = {
  /** File path (repo) or section/anchor (url). */
  path?: string;
  /** Position of the chunk within the source document. */
  index?: number;
  /** Original source reference, duplicated for convenience. */
  source?: string;
};

/** pgvector accepts a string literal like "[0.1,0.2,...]". */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
