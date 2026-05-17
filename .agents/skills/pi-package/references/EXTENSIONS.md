# Pi Extension Patterns (pi-html edition)

Essential patterns for maintaining the pi-html extension.

> For the full reference, see pi's installed docs:
> `npm root -g` → `@earendil-works/pi-coding-agent/docs/extensions.md`

---

## Table of Contents

1. [Extension Structure & Factory](#1-extension-structure--factory)
2. [Slash Commands](#2-slash-commands)
3. [Sending Messages to the LLM](#3-sending-messages-to-the-llm)
4. [User Interaction](#4-user-interaction)
5. [Anti-Patterns](#5-anti-patterns)

---

## 1. Extension Structure & Factory

### Single-file extension (what pi-html uses)

```typescript
// extensions/index.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("html", { /* ... */ });
}
```

### Key rules

- **No build step** — pi loads `.ts` via jiti
- **`import type`** for `ExtensionAPI` and other pi types
- **`export default function`** — the factory must be the default export
- **Peer dependencies** — `@earendil-works/pi-coding-agent`, `typebox`, etc. are provided by pi at runtime. List them as `peerDependencies` with `"*"` range

---

## 2. Slash Commands

### Basic command

```typescript
pi.registerCommand("hello", {
  description: "Say hello from the package",
  handler: async (args, ctx) => {
    const name = args?.trim() || "world";
    ctx.ui.notify(`Hello, ${name}!`, "info");
  },
});
```

### Command with autocomplete

```typescript
import type { AutocompleteItem } from "@earendil-works/pi-tui";

pi.registerCommand("deploy", {
  description: "Deploy to an environment",
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const envs = ["dev", "staging", "prod"];
    const items = envs.map((e) => ({ value: e, label: e }));
    const filtered = items.filter((i) => i.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`Deploying: ${args}`, "info");
  },
});
```

### Command triggering new session

```typescript
pi.registerCommand("new-session", {
  description: "Start a fresh session with context",
  handler: async (args, ctx) => {
    await ctx.newSession({
      setup: async (sm) => {
        sm.appendMessage({
          role: "user",
          content: [{ type: "text", text: `Continue from: ${args}` }],
          timestamp: Date.now(),
        });
      },
      withSession: async (ctx) => {
        await ctx.sendUserMessage("Ready!");
      },
    });
  },
});
```

---

## 3. Sending Messages to the LLM

### sendUserMessage (what pi-html uses)

```typescript
// Sends a message as if the user typed it — the LLM processes it normally
pi.sendUserMessage(prompt);
```

### With delivery mode

```typescript
// Steer: injected during current streaming turn
pi.sendUserMessage("Focus on error handling", { deliverAs: "steer" });

// Follow-up: sent after all tools finish
pi.sendUserMessage("Then summarize", { deliverAs: "followUp" });
```

---

## 4. User Interaction

### Notifications

```typescript
ctx.ui.notify("Done!", "info");     // "info" | "warning" | "error"
```

### Check for UI availability

```typescript
if (!ctx.hasUI) {
  // Print mode or JSON mode — no interactive UI
  return;
}
```

### Status bar and widgets

```typescript
ctx.ui.setStatus("my-ext", "Processing...");
ctx.ui.setStatus("my-ext", undefined);  // Clear
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
ctx.ui.setWidget("my-widget", undefined);  // Clear
```

---

## 5. Anti-Patterns

### ❌ Import ExtensionAPI as a value (not a type)

```typescript
// ❌ Bundled at runtime, breaks peer dep
import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
// ✅ Type-only import
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
```

### ❌ Add a build/compile step

```typescript
// ❌ pi loads .ts directly via jiti
// Never add tsc, esbuild, or webpack to the package pipeline
```

### ❌ Pin peer dependencies

```typescript
// ❌ Peer deps must use "*" range
{ "peerDependencies": { "@earendil-works/pi-coding-agent": "^0.70.0" } }
// ✅ Unpinned — pi provides the version
{ "peerDependencies": { "@earendil-works/pi-coding-agent": "*" } }
```

### ❌ Forget to check ctx.hasUI before interactive calls

```typescript
// ❌ Crashes in print mode
const choice = await ctx.ui.select("Pick:", ["A", "B"]);
// ✅ Guard UI calls
if (ctx.hasUI) {
  const choice = await ctx.ui.select("Pick:", ["A", "B"]);
}
```
