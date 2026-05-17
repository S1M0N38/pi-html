---
name: pi-package
description: >
  Pi package development patterns for pi-html. Use when editing extensions/index.ts,
  adding commands, or modifying the pi-html extension. Also use when the user asks
  about the pi extension API, slash commands, or sendUserMessage.
---

# Pi-html Extension Development

Patterns and best practices for maintaining the pi-html extension.

## Official Pi Documentation

For the complete API reference, read pi's installed docs:

```bash
npm root -g  # → <dir>/@earendil-works/pi-coding-agent/docs/
```

Key documents: `extensions.md`, `packages.md`.

## Reference Files

Read on demand based on the task:

### `references/EXTENSIONS.md`
Extension patterns relevant to pi-html: factory, slash commands, sendUserMessage, notifications, anti-patterns.

## Working on pi-html

1. Read `AGENTS.md` for project-specific rules
2. The main source is `extensions/index.ts` — single-file extension
3. pi-html uses: `registerCommand`, `sendUserMessage`, `sessionManager.getBranch()`, `ctx.ui.notify()`
4. Run `npm run typecheck && npm run lint` before committing
