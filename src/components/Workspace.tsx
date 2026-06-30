"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentRow } from "@/lib/db";
import { IngestPanel } from "@/components/IngestPanel";
import { DocumentList } from "@/components/DocumentList";
import { Chat } from "@/components/Chat";

export function Workspace() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (data.error) setLoadError(data.error);
      else setLoadError(null);
      setDocuments(data.documents ?? []);
    } catch {
      setLoadError("Could not reach the database. Is DATABASE_URL set and migrated?");
    }
  }, []);

  useEffect(() => {
    // Load the knowledge base once on mount. setState only runs after the
    // fetch resolves, so this doesn't cause the cascading renders the rule warns about.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return (
    <div className="flex h-dvh bg-neutral-950 text-neutral-100">
      <aside className="flex w-80 shrink-0 flex-col gap-4 border-r border-neutral-800 p-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">DevSage</h1>
          <p className="text-xs text-neutral-500">Chat with any docs site or GitHub repo.</p>
        </div>

        <IngestPanel onIngested={refresh} />

        <div className="flex-1 overflow-y-auto">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Knowledge base
          </h2>
          {loadError && <p className="mb-2 text-xs text-amber-400">{loadError}</p>}
          <DocumentList documents={documents} onDeleted={refresh} />
        </div>

        <a
          href="https://github.com/ShahKK/devsage"
          target="_blank"
          rel="noopener"
          className="text-[11px] text-neutral-600 hover:text-neutral-400"
        >
          Open source · MIT
        </a>
      </aside>

      <main className="flex-1">
        <Chat />
      </main>
    </div>
  );
}
