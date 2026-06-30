import { sql, toVectorLiteral, type ChunkMetadata } from "@/lib/db";
import { chunkText } from "@/lib/chunk";
import { embedDocuments } from "@/lib/embeddings";
import { fetchRepoSource, fetchUrlSource, parseGitHubUrl, type SourceUnit } from "@/lib/sources";

export type IngestProgress =
  | { type: "status"; message: string }
  | { type: "error"; message: string }
  | {
      type: "done";
      documentId: string;
      title: string;
      chunkCount: number;
    };

const EMBED_BATCH = 96;

type PreparedChunk = { content: string; tokenCount: number; metadata: ChunkMetadata };

/**
 * Orchestrates ingestion as an async generator so the route handler can stream
 * progress to the client: fetch -> chunk -> embed (batched) -> store.
 */
export async function* ingestSource(input: {
  sourceType: "url" | "repo";
  sourceRef: string;
}): AsyncGenerator<IngestProgress> {
  const { sourceType, sourceRef } = input;

  try {
    yield { type: "status", message: `Fetching ${sourceType}…` };
    const source =
      sourceType === "repo"
        ? await fetchRepoSource(sourceRef)
        : await fetchUrlSource(sourceRef);

    if (source.units.length === 0) {
      yield { type: "error", message: "No readable content found at that source." };
      return;
    }

    yield {
      type: "status",
      message:
        sourceType === "repo"
          ? `Found ${source.units.length} files. Chunking…`
          : "Chunking content…",
    };

    const prepared: PreparedChunk[] = [];
    source.units.forEach((unit: SourceUnit) => {
      const pieces = chunkText(unit.content);
      pieces.forEach((piece, index) => {
        prepared.push({
          content: piece.content,
          tokenCount: piece.tokenCount,
          metadata: { path: unit.path, index, source: sourceRef },
        });
      });
    });

    if (prepared.length === 0) {
      yield { type: "error", message: "Content was empty after chunking." };
      return;
    }

    yield { type: "status", message: `Embedding ${prepared.length} chunks…` };

    // Insert the document row first so chunks can reference it.
    const [doc] = (await sql`
      insert into documents (source_type, source_ref, title)
      values (${sourceType}, ${sourceRef}, ${source.title})
      returning id
    `) as { id: string }[];
    const documentId = doc.id;

    let embedded = 0;
    for (let i = 0; i < prepared.length; i += EMBED_BATCH) {
      const batch = prepared.slice(i, i + EMBED_BATCH);
      const embeddings = await embedDocuments(batch.map((b) => b.content));

      await sql.transaction(
        batch.map((chunk, j) =>
          sql`
            insert into chunks (document_id, content, embedding, token_count, metadata)
            values (
              ${documentId},
              ${chunk.content},
              ${toVectorLiteral(embeddings[j])}::vector,
              ${chunk.tokenCount},
              ${JSON.stringify(chunk.metadata)}::jsonb
            )
          `
        )
      );

      embedded += batch.length;
      yield {
        type: "status",
        message: `Stored ${embedded}/${prepared.length} chunks…`,
      };
    }

    yield {
      type: "done",
      documentId,
      title: source.title,
      chunkCount: prepared.length,
    };
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : "Unknown ingestion error.",
    };
  }
}

/** Classify a raw input string as a GitHub repo or a plain docs URL. */
export function classifySource(ref: string): "url" | "repo" {
  return parseGitHubUrl(ref) ? "repo" : "url";
}
