# DevSage

**Chat with any documentation site or GitHub repo.** Point DevSage at a docs URL or a public repository, it ingests the content, and you ask questions in a streaming chat. Answers are grounded in retrieved context (RAG) and cite the exact sources they used. The model can also call tools to retrieve passages or fetch pages on demand.

Built end-to-end on **Next.js (App Router)** and the **Vercel AI SDK**, with **OpenAI** for chat + embeddings and **Postgres + pgvector** (Neon) as the vector store.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ShahKK/devsage&env=OPENAI_API_KEY,DATABASE_URL&envDescription=OpenAI%20key%20and%20a%20Neon%20Postgres%20connection%20string)

> Live demo: _add your Vercel URL here_

---

## What it does

- **F1 — Streaming chat.** Token-by-token responses via `useChat` + `streamText`.
- **F2 — Ingestion.** Paste a docs URL or `github.com/owner/repo`. DevSage fetches, chunks, embeds, and stores the content, streaming progress as it goes.
- **F3 — RAG retrieval.** Each question is embedded and matched against stored chunks with pgvector cosine search; the top passages are injected as grounding context.
- **F4 — Citations.** Every answer shows the sources it drew from, with similarity scores, so it's verifiable.
- **F5 — Tool calling.** The model decides when to call `searchKnowledge(query)` (RAG) and `fetchUrl(url)` (pull a page), chaining steps as an agent.

## Architecture

```
            ┌──────────────────────────── Browser ────────────────────────────┐
            │  Workspace (RSC shell)                                           │
            │    ├─ IngestPanel ──POST /api/ingest (NDJSON progress stream)    │
            │    └─ Chat (useChat) ──POST /api/chat (UI message stream)        │
            └───────────────┬───────────────────────────────┬─────────────────┘
                            │                               │
                 ┌──────────▼─────────┐          ┌──────────▼──────────────────┐
                 │ /api/ingest        │          │ /api/chat                   │
                 │  fetch → chunk →   │          │  streamText + tools         │
                 │  embed → store     │          │  ├─ searchKnowledge (RAG)   │
                 └──────┬──────┬──────┘          │  └─ fetchUrl                │
                        │      │                 └──────┬──────────────┬───────┘
              embeddings│      │store                   │embed query   │tool calls
                        │      │                        │              │
                 ┌──────▼──┐  ┌▼────────────────────────▼──┐    ┌──────▼───────┐
                 │ OpenAI  │  │ Postgres + pgvector (Neon)  │    │ OpenAI chat  │
                 │ embed   │  │ documents / chunks(vector)  │    │ (gpt-4o)     │
                 └─────────┘  └─────────────────────────────┘    └──────────────┘
```

**Data model** (`sql/schema.sql`):

- `documents` — `id, source_type ('url'|'repo'), source_ref, title, created_at`
- `chunks` — `id, document_id, content, embedding vector(1536), token_count, metadata jsonb`

## Tech stack

| Concern        | Choice                                                |
| -------------- | ----------------------------------------------------- |
| Framework      | Next.js 16 (App Router, RSC, route handlers)          |
| Language       | TypeScript                                            |
| AI             | Vercel AI SDK v7 (`streamText`, `useChat`, tools)     |
| Chat model     | OpenAI `gpt-4o` (configurable via `CHAT_MODEL`)       |
| Embeddings     | OpenAI `text-embedding-3-small` (1536-dim)            |
| Vector store   | Postgres + pgvector on Neon                           |
| HTML parsing   | cheerio                                               |
| Deployment     | Vercel                                                |

## Local setup

```bash
git clone https://github.com/ShahKK/devsage
cd devsage
npm install
cp .env.example .env.local   # fill in OPENAI_API_KEY and DATABASE_URL
npm run db:migrate           # creates the pgvector extension + tables
npm run dev                  # http://localhost:3000
```

1. Create a free Postgres DB at [neon.tech](https://neon.tech) and copy the pooled connection string into `DATABASE_URL`.
2. Add your OpenAI key to `OPENAI_API_KEY`.
3. Run `npm run db:migrate` once to apply `sql/schema.sql`.
4. Start the app, paste a docs URL or GitHub repo in the sidebar, then chat.

> `db:migrate` uses Node's built-in TypeScript stripping and `--env-file`, so it needs Node 22+.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel (or use the button above).
2. Add a Neon Postgres integration (or paste `DATABASE_URL`) and set `OPENAI_API_KEY`.
3. Run the migration against your production DB (`npm run db:migrate` with the prod `DATABASE_URL`, or paste `sql/schema.sql` into the Neon SQL editor).

## Project layout

```
src/
  app/
    api/chat/route.ts        # F1/F3/F4/F5 — streaming chat w/ RAG + tools
    api/ingest/route.ts      # F2 — NDJSON ingestion progress stream
    api/documents/route.ts   # list / delete ingested sources
    page.tsx, layout.tsx
  components/                 # Workspace, Chat, IngestPanel, DocumentList
  lib/
    db.ts                    # Neon client + types + pgvector helpers
    sources.ts               # fetch & extract text from URLs / GitHub repos
    chunk.ts                 # text chunking
    embeddings.ts            # OpenAI embed helpers
    ingest.ts                # fetch → chunk → embed → store (generator)
    retrieval.ts             # pgvector top-k search
    tools.ts                 # searchKnowledge + fetchUrl AI SDK tools
scripts/migrate.ts           # applies sql/schema.sql
sql/schema.sql               # documents + chunks(vector) + indexes
```

## Roadmap (stretch goals)

- Multi-provider routing + failover via the Vercel AI Gateway.
- Eval harness of question/expected-answer pairs.
- Extract the chunk-and-embed logic into a reusable package.

## License

MIT — see [LICENSE](./LICENSE).
