"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

const SUGGESTIONS = [
  "How do I configure this?",
  "Where is authentication handled?",
  "Summarize how the build step works.",
];

type Citation = {
  ref: number;
  source: string;
  sourceType: string;
  similarity: number;
  content: string;
};

/** Pull citations out of any searchKnowledge tool outputs on a message. */
function extractCitations(message: UIMessage): Citation[] {
  const out: Citation[] = [];
  for (const part of message.parts) {
    if (
      part.type === "tool-searchKnowledge" &&
      "state" in part &&
      part.state === "output-available" &&
      part.output &&
      typeof part.output === "object" &&
      "results" in part.output
    ) {
      const results = (part.output as { results: Citation[] }).results;
      out.push(...results);
    }
  }
  // De-dupe by source+ref, keep first.
  const seen = new Set<string>();
  return out.filter((c) => {
    const key = `${c.ref}:${c.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Tool-call activity chips (shows the agent retrieving / fetching). */
function ToolActivity({ message }: { message: UIMessage }) {
  const chips: string[] = [];
  for (const part of message.parts) {
    if (part.type === "tool-searchKnowledge") {
      const q = "input" in part && part.input ? (part.input as { query?: string }).query : "";
      chips.push(`🔎 searched knowledge${q ? `: “${q}”` : ""}`);
    } else if (part.type === "tool-fetchUrl") {
      const u = "input" in part && part.input ? (part.input as { url?: string }).url : "";
      chips.push(`🌐 fetched ${u ?? "a page"}`);
    }
  }
  if (chips.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span
          key={i}
          className="rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[11px] text-neutral-400"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function Citations({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  return (
    <div className="mt-3 border-t border-neutral-800 pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-neutral-400 hover:text-neutral-200"
      >
        {open ? "▾" : "▸"} {citations.length} source{citations.length === 1 ? "" : "s"}
      </button>
      {open && (
        <ol className="mt-2 space-y-2">
          {citations.map((c) => (
            <li key={`${c.ref}-${c.source}`} className="rounded-md bg-neutral-900/70 p-2 text-xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium text-neutral-300">
                  [Source {c.ref}] {c.source}
                </span>
                <span className="text-neutral-500">{(c.similarity * 100).toFixed(0)}% match</span>
              </div>
              <p className="line-clamp-3 text-neutral-500">{c.content}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function Chat() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");

  const busy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl pt-10 text-center">
            <h2 className="text-lg font-semibold text-neutral-200">Ask your docs & code</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Ingest a documentation site or GitHub repo, then ask questions. DevSage retrieves the
              relevant passages and answers with citations.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === "user";
          const text = message.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("");
          const citations = isUser ? [] : extractCitations(message);

          return (
            <div key={message.id} className={isUser ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  isUser
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-neutral-100 px-4 py-2 text-sm text-neutral-900"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm bg-neutral-900 px-4 py-3 text-sm text-neutral-100"
                }
              >
                {!isUser && <ToolActivity message={message} />}
                <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
                {!isUser && <Citations citations={citations} />}
              </div>
            </div>
          );
        })}

        {status === "submitted" && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-neutral-500">
              Thinking…
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
            {error.message || "Something went wrong."}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="border-t border-neutral-800 p-4"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder="Ask about your ingested docs or code…"
            className="max-h-40 flex-1 resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
