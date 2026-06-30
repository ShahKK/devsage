import { ingestSource, classifySource } from "@/lib/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Streams newline-delimited JSON (NDJSON) progress events while ingesting a
 * source. The client reads the stream and updates a progress indicator (F2).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { source?: string } | null;
  const source = body?.source?.trim();

  if (!source) {
    return Response.json({ error: "Provide a `source` URL or GitHub repo." }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(source);
  } catch {
    return Response.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return Response.json({ error: "Only http(s) sources are supported." }, { status: 400 });
  }

  const sourceType = classifySource(source);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of ingestSource({ sourceType, sourceRef: source })) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ingestion failed.";
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}
