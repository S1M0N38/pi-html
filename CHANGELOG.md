# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0](https://github.com/S1M0N38/pi-html/compare/v1.0.0...v1.1.0) (2026-05-17)


### Features

* implement /html command to convert session markdown to HTML ([b8479b9](https://github.com/S1M0N38/pi-html/commit/b8479b9ac2e4ba9f5c53085a909cf6c1bcae340b))


### Bug Fixes

* use lowercase org name `[@s1m0n38](https://github.com/s1m0n38)` in all references ([a56d8ae](https://github.com/S1M0N38/pi-html/commit/a56d8aef412d229595c06f325729e4a84d68ab61))

## 1.0.0 (2026-05-17)


### Features

* implement /html command to convert session markdown to HTML ([b8479b9](https://github.com/S1M0N38/pi-html/commit/b8479b9ac2e4ba9f5c53085a909cf6c1bcae340b))


### Bug Fixes

* use lowercase org name `[@s1m0n38](https://github.com/s1m0n38)` in all references ([a56d8ae](https://github.com/S1M0N38/pi-html/commit/a56d8aef412d229595c06f325729e4a84d68ab61))

## 0.1.0 (2026-05-16)

### Features

- **`/html` command**: extracts markdown documents from the current session (file writes and substantial assistant explanations), sends a structured XML prompt to the LLM, and generates beautiful self-contained HTML files using the html-effectiveness design system.
- Supports optional refinements: `/html use a dark theme`
- Auto-opens generated files in the default browser
- Soft cap at ~50KB with notification when documents are skipped
- Enriches file-write documents from disk (latest version) with fallback to tool result
