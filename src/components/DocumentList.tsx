"use client";

import type { DocumentRow } from "@/lib/db";

type Props = {
  documents: DocumentRow[];
  onDeleted: () => void;
};

export function DocumentList({ documents, onDeleted }: Props) {
  async function remove(id: string) {
    await fetch(`/api/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    onDeleted();
  }

  if (documents.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No sources yet. Paste a docs URL or GitHub repo above to build the knowledge base.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="group rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-200">
                {doc.title || doc.source_ref}
              </p>
              <p className="truncate text-xs text-neutral-500">{doc.source_ref}</p>
            </div>
            <button
              onClick={() => remove(doc.id)}
              className="shrink-0 text-xs text-neutral-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              aria-label="Delete source"
            >
              ✕
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 uppercase tracking-wide">
              {doc.source_type}
            </span>
            <span>{doc.chunk_count ?? 0} chunks</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
