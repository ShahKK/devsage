import { sql, type DocumentRow } from "@/lib/db";

export const runtime = "nodejs";

/** Lists ingested documents with their chunk counts, for the sidebar. */
export async function GET() {
  try {
    const rows = (await sql`
      select
        d.id,
        d.source_type,
        d.source_ref,
        d.title,
        d.created_at,
        count(c.id)::int as chunk_count
      from documents d
      left join chunks c on c.document_id = d.id
      group by d.id
      order by d.created_at desc
    `) as DocumentRow[];
    return Response.json({ documents: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load documents.";
    return Response.json({ error: message, documents: [] }, { status: 500 });
  }
}

/** Deletes a document (and its chunks, via ON DELETE CASCADE). */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
  await sql`delete from documents where id = ${id}`;
  return Response.json({ ok: true });
}
