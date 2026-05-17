/**
 * pi-html — Convert session context to beautiful self-contained HTML.
 *
 * Registers the /html command that extracts the full conversation
 * from the current session and sends a structured prompt to the LLM
 * to generate HTML files.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

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
  "You are a document designer. Convert the following conversation into beautiful, self-contained HTML files. Synthesize the full conversation context — including explanations, code, decisions, and any written files — into well-structured HTML documents. Choose the right visual layout for each document type — for example, side-by-side comparisons for tradeoffs, timelines for status reports, collapsible sections for explainers, annotated diffs for code reviews. Make the output visually rich and scannable.";

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
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
 * Extract text from a message content field.
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
 * Build a conversation transcript from the session branch.
 * Includes user messages, assistant explanations, and tool interactions.
 */
function buildConversation(entries: SessionEntry[]): string {
  const parts: string[] = [];

  for (const entry of entries) {
    if (entry.type !== "message" || !entry.message) continue;
    const msg = entry.message;

    if (msg.role === "user") {
      const text = extractMessageText(msg.content as string | ContentBlock[] | undefined).trim();
      if (text) {
        parts.push(`<user>\n${text}\n</user>`);
      }
    } else if (msg.role === "assistant") {
      const blocks = msg.content;
      if (typeof blocks === "string" || !Array.isArray(blocks)) continue;

      for (const block of blocks) {
        if (block.type === "text" && block.text?.trim()) {
          parts.push(`<assistant>\n${block.text.trim()}\n</assistant>`);
        } else if (block.type === "toolCall" && block.name === "write" && block.arguments) {
          const args = block.arguments as { path?: string; content?: string };
          if (args.path && args.content) {
            parts.push(
              `<file-write path="${escapeXml(args.path)}">\n${args.content}\n</file-write>`,
            );
          }
        }
      }
    } else if (msg.role === "toolResult" && msg.toolName === "write") {
      // Skip tool results for writes — we already capture the content from the toolCall
    }
  }

  return parts.join("\n\n");
}

/**
 * Build the structured XML prompt.
 */
function buildPrompt(conversation: string, outputDir: string, refinements?: string): string {
  const refinementsSection = refinements
    ? `\n<refinements>${escapeXml(refinements)}</refinements>`
    : "";

  return `<role>${ROLE_PROMPT}</role>

<design-system>${DESIGN_SYSTEM}
</design-system>

<conversation>
${conversation}
</conversation>
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
    description: "Convert session context to beautiful HTML files",
    handler: async (args, ctx) => {
      const refinements = args?.trim() || undefined;

      const entries = ctx.sessionManager.getBranch() as SessionEntry[];
      const conversation = buildConversation(entries);

      if (!conversation.trim()) {
        ctx.ui.notify("No conversation content found in this session", "warning");
        return;
      }

      // Create temp directory
      const tempDir = mkdtempSync(join(tmpdir(), "pi-html-"));

      // Build and send the prompt
      const prompt = buildPrompt(conversation, tempDir, refinements);
      pi.sendUserMessage(prompt);
    },
  });
}
