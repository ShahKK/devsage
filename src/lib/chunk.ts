/**
 * Lightweight text chunking. Splits on paragraph boundaries first, then packs
 * paragraphs into ~maxChars windows with a small overlap so context isn't lost
 * across a boundary. Deliberately dependency-free.
 */

export type Chunk = {
  content: string;
  tokenCount: number;
};

const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP_CHARS = 200;

/** Rough token estimate (~4 chars/token for English). Good enough for storage + budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(
  text: string,
  maxChars: number = DEFAULT_MAX_CHARS,
  overlapChars: number = DEFAULT_OVERLAP_CHARS
): Chunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  // Split into paragraph-ish units.
  const paragraphs = normalized.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    // Seed the next chunk with a trailing overlap from this one.
    current = overlapChars > 0 ? trimmed.slice(-overlapChars) : "";
  };

  for (const para of paragraphs) {
    // A single paragraph larger than maxChars is hard-split.
    if (para.length > maxChars) {
      if (current.trim()) pushCurrent();
      for (let i = 0; i < para.length; i += maxChars - overlapChars) {
        chunks.push(para.slice(i, i + maxChars).trim());
      }
      current = "";
      continue;
    }

    if ((current + "\n\n" + para).length > maxChars) {
      pushCurrent();
    }
    current = current ? current + "\n\n" + para : para;
  }
  if (current.trim()) chunks.push(current.trim());

  // De-duplicate empties and map to Chunk objects.
  return chunks
    .filter((c) => c.length > 0)
    .map((content) => ({ content, tokenCount: estimateTokens(content) }));
}
