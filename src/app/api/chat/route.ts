import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { tools } from "@/lib/tools";

// RAG retrieval + GitHub fetching need the Node runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

const CHAT_MODEL = process.env.CHAT_MODEL ?? "gpt-4o";

const SYSTEM_PROMPT = `You are DevSage, an assistant that answers questions about documentation and codebases that the user has ingested into a knowledge base.

Rules:
- For any question about the ingested docs or repos, call the \`searchKnowledge\` tool FIRST to gather relevant passages before answering.
- If the user references a URL that may not be ingested, you may call \`fetchUrl\` to read it.
- Ground every claim in retrieved sources. If the sources don't contain the answer, say so plainly instead of guessing.
- Cite sources inline using the ref numbers returned by the tools, e.g. "Auth is handled in middleware [Source 1]".
- Be concise and technical. Prefer short paragraphs and code blocks where helpful.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai(CHAT_MODEL),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, tools }),
  });
}
