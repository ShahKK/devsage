"use client";

import { useState } from "react";

type Props = {
  onIngested: () => void;
};

export function IngestPanel({ onIngested }: Props) {
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = source.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    setStatus("Starting…");

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: trimmed }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Ingestion failed." }));
        throw new Error(data.error ?? "Ingestion failed.");
      }

      // Read NDJSON progress events line by line.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "status") setStatus(event.message);
          else if (event.type === "error") setError(event.message);
          else if (event.type === "done") {
            setStatus(`✅ Ingested “${event.title}” (${event.chunkCount} chunks).`);
            setSource("");
            onIngested();
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400">
        Ingest a source
      </label>
      <input
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="https://docs… or https://github.com/owner/repo"
        disabled={busy}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={busy || !source.trim()}
        className="w-full rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Ingesting…" : "Ingest"}
      </button>
      {status && <p className="text-xs text-neutral-400">{status}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
