# Pi-html — Agent Context

## Project Overview

**@s1m0n38/pi-html** is a pi package that adds the `/html` command to the pi coding agent. The command extracts markdown documents from the current session (file writes and substantial assistant explanations) and sends a structured XML prompt to the LLM, which generates beautiful, self-contained HTML files using the design system from the [html-effectiveness](https://github.com/ThariqS/html-effectiveness) repo.

**Tech Stack:** TypeScript (no build step — pi loads `.ts` directly via jiti), typebox for schemas, biome for lint/format.

### Structure

```
extensions/index.ts    # Extension entry point (/html command handler + prompt builder)
package.json           # Pi manifest, peer deps, npm publish config
biome.json             # Linter/formatter config
tsconfig.json          # Type checking only (noEmit)
```

### Key Constraints

- **No build step** — pi loads `.ts` via jiti. Never add a build/compile step.
- **Peer dependencies** — `@earendil-works/pi-coding-agent` and `typebox` are provided by pi at runtime. List them as `peerDependencies` with `"*"` range. Do not bundle them.
- **2-space indentation** — Enforced by biome.

---

## Git and PR Conventions

- **Conventional commits** — `feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `refactor:` prefixes. Releases are automated via release-please.
- **Rebase merges only** — The repo does not allow squash or merge commits. Always use:
  ```bash
  gh pr merge <number> --rebase
  ```
- **Release PRs** — release-please automatically opens a Release PR when conventional commits land on `main`. Review the changelog, then merge it with `--rebase` to trigger `npm publish`.

---

## Development Commands

```bash
npm run typecheck      # TypeScript type checking (tsc --noEmit)
npm run lint           # Check lint + formatting (biome check)
npm run lint:fix       # Auto-fix lint + formatting issues (biome check --write)
npm run format         # Format code only (biome format --write)
```

### Testing the Package with pi

#### Print mode (`-p`) — quick functionality test

```bash
pi -ne -e . --no-session -p "List the tools you have available."
```

#### Interactive mode — test the /html command

```bash
pi -ne -e . --no-session
# Then ask the agent to generate some markdown, then type: /html
```

#### Verify npm tarball contents

```bash
npm pack --dry-run
```

---

## Architecture

### The /html command flow

1. User types `/html` or `/html <refinements>`
2. Command handler extracts documents from `ctx.sessionManager.getBranch()`:
   - **File writes**: `.md`/`.mdx`/`.txt` files written by the agent (reads from disk, falls back to tool result)
   - **Assistant explanations**: text blocks >200 chars concatenated per turn (skips HTML content)
3. Each document is labeled with its title, source, and the triggering user prompt
4. Soft cap at ~50KB — most recent documents kept, user notified if skipped
5. If no documents found → notify warning, return
6. Creates temp directory (`/tmp/pi-html-XXXXX/`)
7. Builds structured XML prompt (`<role>`, `<design-system>`, `<documents>`, `<refinements>`, `<output-instructions>`)
8. Sends prompt via `pi.sendUserMessage()`
9. The LLM writes self-contained HTML files and opens them in the browser

### Design decisions

- **Prompt-based generation** (not tool-based): the LLM already knows how to use `write` and `bash`
- **Temp directory output**: files are for one-time human consumption, no filesystem pollution
- **Embedded design tokens**: the html-effectiveness color palette is baked into the prompt
- **Numbered+slug filenames**: `01-implementation-plan.html`, `02-code-review.html`
- **Auto-open**: the prompt instructs the LLM to open files in the browser after writing
