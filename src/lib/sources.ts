import * as cheerio from "cheerio";

/** A unit of text to be chunked and embedded, with a path/section label for citations. */
export type SourceUnit = {
  path: string;
  content: string;
};

export type SourceResult = {
  title: string;
  units: SourceUnit[];
};

// ---------- URL (documentation page) ----------

export async function fetchUrlSource(url: string): Promise<SourceResult> {
  const res = await fetch(url, {
    headers: { "user-agent": "DevSage/1.0 (+https://github.com)" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const { title, text } = extractReadableText(html, url);
  return { title, units: [{ path: url, content: text }] };
}

/** Strip boilerplate and return the readable text of an HTML page. */
export function extractReadableText(html: string, url: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, header, footer, nav, aside, form").remove();

  const title = ($("title").first().text() || $("h1").first().text() || url).trim();

  // Prefer a main/article container when present; fall back to body.
  const root = $("main").length ? $("main") : $("article").length ? $("article") : $("body");
  const text = root
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text };
}

// ---------- GitHub repository ----------

const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt",
  "c", "h", "cpp", "hpp", "cs", "php", "swift", "scala", "sh", "bash",
  "md", "mdx", "txt", "json", "yaml", "yml", "toml", "html", "css", "scss",
  "sql", "graphql", "vue", "svelte",
]);

const MAX_FILES = 80;
const MAX_FILE_BYTES = 100_000;

type ParsedRepo = { owner: string; repo: string; branch?: string };

export function parseGitHubUrl(input: string): ParsedRepo | null {
  try {
    const u = new URL(input);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo, kind, branch] = parts;
    return {
      owner,
      repo: repo.replace(/\.git$/, ""),
      branch: kind === "tree" && branch ? branch : undefined,
    };
  } catch {
    return null;
  }
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "DevSage/1.0",
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

export async function fetchRepoSource(input: string): Promise<SourceResult> {
  const parsed = parseGitHubUrl(input);
  if (!parsed) throw new Error(`Not a valid GitHub repository URL: ${input}`);
  const { owner, repo } = parsed;

  let branch = parsed.branch;
  if (!branch) {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubHeaders(),
    });
    if (!repoRes.ok) {
      throw new Error(`GitHub API error for ${owner}/${repo}: ${repoRes.status}`);
    }
    branch = ((await repoRes.json()) as { default_branch: string }).default_branch;
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: githubHeaders() }
  );
  if (!treeRes.ok) {
    throw new Error(`Failed to list ${owner}/${repo}@${branch}: ${treeRes.status}`);
  }
  const tree = (await treeRes.json()) as {
    tree: { path: string; type: string; size?: number }[];
    truncated: boolean;
  };

  const candidates = tree.tree
    .filter((n) => n.type === "blob")
    .filter((n) => (n.size ?? 0) <= MAX_FILE_BYTES)
    .filter((n) => {
      const ext = n.path.split(".").pop()?.toLowerCase() ?? "";
      return TEXT_EXTENSIONS.has(ext);
    })
    .filter((n) => !/(^|\/)(node_modules|dist|build|\.next|vendor|__pycache__)\//.test(n.path))
    .slice(0, MAX_FILES);

  const units: SourceUnit[] = [];
  for (const node of candidates) {
    const rawRes = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${node.path}`,
      { headers: { "user-agent": "DevSage/1.0" } }
    );
    if (!rawRes.ok) continue;
    const content = await rawRes.text();
    if (content.trim()) units.push({ path: node.path, content });
  }

  return { title: `${owner}/${repo}`, units };
}
