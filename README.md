# pi-html

Turn your pi conversations into beautiful, self-contained HTML files.

## Install

```
pi install npm:@s1m0n38/pi-html
```

<details>
<summary>Alternative install commands</summary>

```bash
# Git shorthand
pi install git:github.com/S1M0N38/pi-html

# Pin to a specific version
pi install npm:@s1m0n38/pi-html@1.0.0

# Try without installing
pi -e npm:@s1m0n38/pi-html
```

</details>

## Usage

Type `/html` in the pi agent TUI to convert the current conversation into HTML and open the files in your browser.

Add refinements after the command:

```
/html use a dark theme
/html simplify the explanations, focus on diagrams
/html only the implementation plan
```

## How it works

1. Extracts the full conversation from your session — user prompts, assistant explanations, and file writes
2. Sends a structured prompt to the LLM with the conversation and a built-in design system
3. The LLM generates self-contained HTML files in a temp directory
4. Each file is opened in your default browser

## Uninstall

```
pi remove npm:@s1m0n38/pi-html
```
