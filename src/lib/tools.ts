import { tool } from "ai";
import { z } from "zod";
import { searchKnowledge } from "@/lib/retrieval";
import { fetchUrlSource } from "@/lib/sources";

/**
 * Agentic tools the model can call (F5). The model decides when to retrieve
 * context vs. fetch a fresh page. Tool outputs are structured so the UI can
 * render citations directly from the message parts.
 */
export const tools = {
  searchKnowledge: tool({
    description:
      "Search the ingested knowledge base (docs and repositories) for passages relevant to a question. Use this first for any question about ingested content. Returns ranked source passages.",
    inputSchema: z.object({
      query: z.string().describe("A focused natural-language search query."),
      k: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .describe("How many passages to retrieve. Default 6."),
    }),
    execute: async ({ query, k }) => {
      const results = await searchKnowledge(query, k ?? 6);
      return {
        results: results.map((r, i) => ({
          ref: i + 1,
          source: r.metadata?.path ?? r.title ?? r.source_ref,
          sourceType: r.source_type,
          similarity: Number(r.similarity.toFixed(3)),
          content: r.content,
        })),
      };
    },
  }),

  fetchUrl: tool({
    description:
      "Fetch the readable text of a public web page on demand. Use when the user references a URL that may not be in the knowledge base, or to pull fresh content.",
    inputSchema: z.object({
      url: z.string().url().describe("The absolute URL to fetch."),
    }),
    execute: async ({ url }) => {
      const { title, units } = await fetchUrlSource(url);
      const text = units.map((u) => u.content).join("\n\n");
      return { title, url, excerpt: text.slice(0, 8000) };
    },
  }),
};

export type DevSageTools = typeof tools;
