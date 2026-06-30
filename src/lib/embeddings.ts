import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

/**
 * OpenAI embeddings. text-embedding-3-small is 1536-dim and cheap, matching the
 * vector(1536) column in sql/schema.sql. Anthropic has no embeddings API, which
 * is why embeddings always run through OpenAI even when chat uses another model.
 */
export const embeddingModel = openai.embedding("text-embedding-3-small");

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel, value: text });
  return embedding;
}

export async function embedDocuments(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  const { embeddings } = await embedMany({ model: embeddingModel, values });
  return embeddings;
}
