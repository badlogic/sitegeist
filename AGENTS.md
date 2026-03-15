# Development Rules

## First Message
If the user did not give you a concrete task, read README.md first.

## Commands
- After code changes: run `./check.sh`. Fix all errors and warnings before committing.
- The user runs `./dev.sh` in a separate tmux session. Do not run `npm run dev` or `npm run build`.
- NEVER commit unless the user asks.

## Code Quality
- No `any` types unless absolutely necessary
- Check node_modules for external API type definitions instead of guessing
- NEVER use inline imports (no `await import(...)`, no `import("pkg").Type`)
- Always ask before removing functionality or code that appears intentional

## Dependencies
- `@mariozechner/mini-lit`, `@mariozechner/pi-ai`, `@mariozechner/pi-web-ui`, `@mariozechner/pi-agent-core` are linked via `file:` to sibling repos `../mini-lit` and `../pi-mono`
- Changes to those packages require rebuilding them (the dev watcher handles this)
- If you need to modify upstream code, edit it in `../pi-mono` or `../mini-lit` directly and rebuild

## Changelog
Location: `CHANGELOG.md`

### Format
Use these sections under `## [Unreleased]`:
- `### Breaking Changes`
- `### Added`
- `### Changed`
- `### Fixed`
- `### Removed`

### Rules
- New entries ALWAYS go under `## [Unreleased]`
- Append to existing subsections, do not create duplicates
- NEVER modify already-released version sections

## Releasing
When the user asks to do a release:
1. Ask: major, minor, or patch?
2. Ensure `CHANGELOG.md` has entries under `## [Unreleased]`
3. Run `./release.sh <major|minor|patch>`

The script bumps the version in `static/manifest.chrome.json`, finalizes the changelog, commits, tags, and pushes. GitHub Actions builds and publishes the release.

## Updating the Website
When the user asks to update the website:
```bash
cd site && ./run.sh deploy
```
Requires SSH access to `slayer.marioslab.io`.

The site is static HTML (no backend). Source is in `site/src/frontend/`.

## Style
- No emojis in commits, code, or comments
- No fluff or cheerful filler text
- Technical prose only, direct and concise

## Git Rules
- NEVER use `git add -A` or `git add .`
- ALWAYS use `git add <specific-file-paths>`
- NEVER use `git reset --hard`, `git checkout .`, `git clean -fd`, `git stash`
- NEVER use `git commit --no-verify`
- Include `fixes #<number>` or `closes #<number>` in commit messages when applicable

## Project Structure
```
src/
  sidepanel.ts          # Main entry point, agent setup, settings, rendering
  background.ts         # Service worker (sidepanel toggle, session locks)
  oauth/                # Browser OAuth flows (Anthropic, OpenAI, GitHub, Gemini)
  dialogs/              # Settings tabs, API key dialogs, welcome setup
  tools/                # Agent tools (navigate, REPL, extract-image, skills, debugger)
  messages/             # Custom message types (navigation, welcome)
  storage/              # IndexedDB storage (sessions, skills, costs)
  prompts/              # System prompt and token counting
  components/           # UI components (Toast, TabPill, OrbAnimation)
site/
  src/frontend/         # Static landing page and install instructions
static/
  manifest.chrome.json  # Extension manifest (version lives here)
```
