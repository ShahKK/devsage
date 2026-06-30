import { sql, toVectorLiteral, type RetrievedChunk } from "@/lib/db";
import { embedQuery } from "@/lib/embeddings";

/**
 * Core RAG retrieval: embed the query, then cosine-rank chunks in pgvector.
 * Returns the top-k chunks joined with their parent document for citations.
 */
export async function searchKnowledge(
  query: string,
  k: number = 6
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);
  const literal = toVectorLiteral(queryEmbedding);

  const rows = (await sql`
    select
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      1 - (c.embedding <=> ${literal}::vector) as similarity,
      d.source_ref,
      d.source_type,
      d.title
    from chunks c
    join documents d on d.id = c.document_id
    order by c.embedding <=> ${literal}::vector
    limit ${k}
  `) as RetrievedChunk[];

  return rows;
}

/** Build a compact, citation-friendly context block from retrieved chunks. */
export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No relevant context was found in the knowledge base.";
  return chunks
    .map((c, i) => {
      const label = c.metadata?.path ?? c.title ?? c.source_ref;
      return `[Source ${i + 1}: ${label}]\n${c.content}`;
    })
    .join("\n\n---\n\n");
}
