# pi-html

Convert your agent's markdown output to beautiful, self-contained HTML files.

## Install

```
pi install @S1M0N38/pi-html
```

## Usage

Type `/html` in the pi agent TUI to convert all markdown documents from the current session into HTML and open them in your browser.

Add refinements after the command:

```
/html use a dark theme
/html simplify the explanations, focus on diagrams
/html only the implementation plan
```

## How it works

1. Scans the session for markdown files written by the agent and substantial assistant explanations
2. Sends a structured prompt to the LLM with the extracted content
3. The LLM generates self-contained HTML files in a temp directory
4. Files are opened in your default browser

## Uninstall

```
pi uninstall @S1M0N38/pi-html
```
