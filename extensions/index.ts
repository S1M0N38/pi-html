/**
 * pi-html — Convert agent markdown output to beautiful self-contained HTML.
 *
 * Registers the /html command that extracts markdown documents from the
 * current session and sends a structured prompt to the LLM to generate
 * HTML files.
 */

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Minimum character length for an assistant text block to be considered a document
const MIN_TEXT_LENGTH = 200;

// Soft cap on total extracted content (~50KB)
const MAX_CONTENT_BYTES = 50_000;

// Design system tokens from html-effectiveness
const DESIGN_SYSTEM = `
Colors:
  - background: #FAF9F5 (ivory)
  - text: #141413 (slate)
  - accent: #D97757 (clay)
  - secondary: #E3DACC (oat)
  - success: #788C5D (olive)
  - cards: #FFFFFF (white)
  - gray-100: #F0EEE6, gray-300: #D1CFC5, gray-500: #87867F, gray-700: #3D3D3A
Fonts:
  - headings: ui-serif, Georgia, "Times New Roman", serif
  - body: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
  - code: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace
Style:
  - Border radius: 12px for cards, 8px for inner elements
  - Borders: 1.5px solid gray-300
  - Generous whitespace (48-56px section gaps, 24px card padding)
  - Subtle box-shadows on hover (0 10px 30px rgba(20,20,19,0.10))
  - Card backgrounds white (#FFFFFF) on ivory (#FAF9F5) page
  - Serif for headings (font-weight 500), sans-serif body
  - Monospace for code, labels, chips
  - Clean horizontal rules (1.5px solid gray-300)
  - Responsive: max-width 860-1040px, mobile-friendly
`;

const OUTPUT_INSTRUCTIONS = `
- Write each document as a separate, fully self-contained HTML file with all CSS inlined in a <style> tag.
- Use the design system above for consistent, professional styling.
- Name files as 01-slug.html, 02-slug.html, etc., using descriptive slugs derived from the content.
- Write all files to the directory: {OUTPUT_DIR}
- After writing each file, open it in the default browser:
    - macOS: open <path>
    - Linux: xdg-open <path>
    - Windows: start <path>
- Print the full path of each generated file.
`;

const ROLE_PROMPT =
  "You are a document designer. Convert the following content into beautiful, self-contained HTML files. Each distinct document should become its own file. Choose the right visual layout for each document type — for example, side-by-side comparisons for tradeoffs, timelines for status reports, collapsible sections for explainers, annotated diffs for code reviews. Make the output visually rich and scannable.";

interface ExtractedDocument {
  index: number;
  title: string;
  source: string;
  triggeringPrompt: string;
  content: string;
  bytes: number;
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  arguments?: { path?: string };
}

interface SessionEntry {
  type: string;
  message?: {
    role: string;
    content?: string | ContentBlock[];
    toolCallId?: string;
    toolName?: string;
    isError?: boolean;
  };
}

/**
 * Extract text from a user/assistant message content field.
 */
function extractMessageText(content: string | ContentBlock[] | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text ?? "")
    .join("\n");
}

/**
 * Extract plain text from tool result content (array of content blocks or string).
 */
function extractToolResultText(content: string | ContentBlock[] | undefined): string | null {
  if (!content) return null;
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text ?? "")
    .join("\n");
}

/**
 * Heuristic: does this content look like markdown?
 */
function looksLikeMarkdown(text: string): boolean {
  const mdPatterns = [/^#{1,6}\s/m, /^\s*[-*+]\s/m, /^\s*\d+\.\s/m, /^```/m];
  return mdPatterns.some((p) => p.test(text));
}

/**
 * Check if content is already HTML.
 */
function isHtmlContent(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");
}

/**
 * Infer a title from markdown content (first heading or first line).
 */
function inferTitle(content: string, fallback: string): string {
  const headingMatch = content.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const firstLine = content.trim().split("\n")[0];
  if (firstLine && firstLine.length < 80) return firstLine;
  return fallback;
}

/**
 * Try to read file content from disk, falling back to the provided content.
 */
function readFileFromDisk(filePath: string, fallback: string): string {
  try {
    if (existsSync(filePath)) {
      return readFileSync(filePath, "utf8");
    }
  } catch {
    // File not accessible, use fallback
  }
  return fallback;
}

/**
 * Build a map of write tool call IDs → file paths from assistant messages.
 */
function buildWritePathMap(entries: SessionEntry[]): Map<string, string> {
  const writePaths = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type !== "message" || !entry.message) continue;
    if (entry.message.role !== "assistant") continue;
    const blocks = entry.message.content;
    if (typeof blocks === "string" || !Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (block.type === "toolCall" && block.name === "write" && block.arguments?.path) {
        writePaths.set(block.id ?? "", block.arguments.path);
      }
    }
  }
  return writePaths;
}

/**
 * Extract markdown documents from the session branch.
 * Collects both file writes (.md/.mdx/.txt) and long assistant text blocks.
 * If applyLimit is true, enforces the soft byte cap (keeps most recent).
 */
function extractDocuments(entries: SessionEntry[], applyLimit = true): ExtractedDocument[] {
  const documents: ExtractedDocument[] = [];
  let docIndex = 0;
  let lastUserPrompt = "";
  let totalBytes = 0;

  const writePaths = buildWritePathMap(entries);

  for (const entry of entries) {
    if (entry.type !== "message" || !entry.message) continue;
    const msg = entry.message;

    // Capture user prompts for context
    if (msg.role === "user") {
      const text = extractMessageText(msg.content as string | ContentBlock[] | undefined).trim();
      if (text) lastUserPrompt = text;
      continue;
    }

    // Extract content from write tool results
    if (msg.role === "toolResult" && msg.toolName === "write" && !msg.isError) {
      const textContent = extractToolResultText(msg.content as string | ContentBlock[] | undefined);
      if (!textContent || !looksLikeMarkdown(textContent)) continue;

      const bytes = Buffer.byteLength(textContent, "utf8");
      if (applyLimit && totalBytes + bytes > MAX_CONTENT_BYTES) continue;
      totalBytes += bytes;

      // Enrich from disk if possible
      const filePath = writePaths.get(msg.toolCallId ?? "");
      const content = filePath ? readFileFromDisk(filePath, textContent) : textContent;

      docIndex++;
      documents.push({
        index: docIndex,
        title: inferTitle(content, `Document ${docIndex}`),
        source: filePath ?? "file write",
        triggeringPrompt: lastUserPrompt,
        content,
        bytes: Buffer.byteLength(content, "utf8"),
      });
    }

    // Extract long assistant text blocks (concatenated per turn)
    if (msg.role === "assistant") {
      const blocks = msg.content;
      if (typeof blocks === "string" || !Array.isArray(blocks)) continue;

      const textBlocks: string[] = [];
      for (const block of blocks) {
        if (block.type === "text" && block.text) {
          textBlocks.push(block.text);
        }
      }
      const combined = textBlocks.join("\n\n");
      if (combined.length < MIN_TEXT_LENGTH || isHtmlContent(combined)) continue;

      const bytes = Buffer.byteLength(combined, "utf8");
      if (applyLimit && totalBytes + bytes > MAX_CONTENT_BYTES) continue;
      totalBytes += bytes;

      docIndex++;
      documents.push({
        index: docIndex,
        title: inferTitle(combined, `Document ${docIndex}`),
        source: "assistant explanation",
        triggeringPrompt: lastUserPrompt,
        content: combined,
        bytes,
      });
    }
  }

  return documents;
}

/**
 * Build the structured XML prompt.
 */
function buildPrompt(
  documents: ExtractedDocument[],
  outputDir: string,
  refinements?: string,
): string {
  const documentsXml = documents
    .map(
      (doc) =>
        `<document index="${doc.index}" title="${escapeXml(doc.title)}" source="${escapeXml(doc.source)}">
${doc.triggeringPrompt ? `  <triggering-prompt>${escapeXml(doc.triggeringPrompt)}</triggering-prompt>\n` : ""}  <content>
${doc.content}
  </content>
</document>`,
    )
    .join("\n\n");

  const refinementsSection = refinements
    ? `\n<refinements>${escapeXml(refinements)}</refinements>`
    : "";

  return `<role>${ROLE_PROMPT}</role>

<design-system>${DESIGN_SYSTEM}
</design-system>

<documents count="${documents.length}">
${documentsXml}
</documents>
${refinementsSection}
<output-instructions>
${OUTPUT_INSTRUCTIONS.replace("{OUTPUT_DIR}", outputDir)}
</output-instructions>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("html", {
    description: "Convert session markdown to beautiful HTML files",
    handler: async (args, ctx) => {
      const refinements = args?.trim() || undefined;

      // Extract content from session
      const entries = ctx.sessionManager.getBranch() as SessionEntry[];
      const documents = extractDocuments(entries);

      if (documents.length === 0) {
        ctx.ui.notify("No markdown documents found in this session", "warning");
        return;
      }

      // Check if we hit the soft limit and some docs were skipped
      const unlimitedDocs = extractDocuments(entries, false);
      if (unlimitedDocs.length > documents.length) {
        ctx.ui.notify(
          `Converting ${documents.length} most recent documents (skipped ${unlimitedDocs.length - documents.length} older ones due to size limit)`,
          "info",
        );
      }

      // Create temp directory
      const tempDir = mkdtempSync(join(tmpdir(), "pi-html-"));

      // Build and send the prompt
      const prompt = buildPrompt(documents, tempDir, refinements);
      pi.sendUserMessage(prompt);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("pi-html loaded — type /html to convert markdown to HTML", "info");
  });
}
