# Prompt Optimization Progress

## Runtime Providers - Completed
- [x] NATIVE_INPUT_EVENTS - 696 → 346 tokens (50% reduction)
- [x] ARTIFACTS_RW - 505 → 457 tokens (9% reduction, added binary examples)
- [x] ARTIFACTS_RO - 281 → 274 tokens (3% reduction, added binary examples)
- [x] NAVIGATE - 428 → 214 tokens (50% reduction, removed history/skills)
- [x] ATTACHMENTS - 578 → 309 tokens (47% reduction)
- [x] BROWSERJS - 544 → 528 tokens (3% reduction, added critical serialization guidance)

## Total Progress
- Runtime Providers: 3,512 → 2,128 tokens (39% reduction, saved 1,384 tokens)
- Tools Completed: 6/7 tools optimized
  - skill: 2,165 → ~870 tokens (60% reduction)
  - repl: 2,698 → ~650 tokens (76% reduction)
  - artifacts: 1,595 → ~550 tokens (65% reduction)
  - ask_user_which_element: 394 → 112 tokens (72% reduction)
  - extract_document: 263 → 107 tokens (59% reduction)
  - navigate: 220 → 179 tokens (19% reduction)
- Tools Remaining: system_prompt (TBD tokens)
- Complete agent setup: ~7,555 tokens (down from ~13,034, saved ~5,479 tokens so far, 42% reduction)

### Runtime Providers Summary
All 6 runtime provider descriptions have been optimized following a consistent pattern:
- Removed redundant inline examples from Functions sections
- Added binary file examples where needed (ARTIFACTS)
- Clarified critical constraints (BROWSERJS serialization, NAVIGATE no history/skills)
- Removed unnecessary "Do NOT Use For" items
- Streamlined "When to Use" sections

---

## Tool Descriptions - To Review

### Sitegeist Tools
- [x] **repl** - 2,698 → ~650 tokens (76% reduction)
  - Location: `/Users/badlogic/workspaces/sitegeist/src/prompts/prompts.ts`
  - REPL tool description (includes runtime provider descriptions)
  - Updated to use # h1 + ## h2 pattern
  - Reordered "When to Use" to emphasize current page interaction first
  - Added structured Input format: { title: "...", code: "..." }
  - Added Returns section
  - Split Examples into "Read current page" and "Multi-page scraping"
  - Added PDF and Word libraries to Common Libraries
  - Removed verbose "Purpose" and redundant text

- [x] **skill** - 2,165 → ~870 tokens (60% reduction)
  - Location: `/Users/badlogic/workspaces/sitegeist/src/prompts/prompts.ts`
  - Skill management tool description
  - Updated to use # h1 + ## h2 pattern
  - Renamed actions: patch→update, update→rewrite (consistent with artifacts)
  - Added support for updating all fields including name
  - Simplified Input format with all 6 actions
  - Added Returns section
  - Condensed Creating Skills Workflow with better guidance
  - Merged User Testing sections
  - Removed verbose "Why patch is better" explanations

- [ ] **system_prompt** - TBD tokens
  - Location: `/Users/badlogic/workspaces/sitegeist/src/prompts/prompts.ts`
  - Main system prompt for the agent

- [x] **ask_user_which_element** - 394 → 112 tokens (72% reduction)
  - Location: `/Users/badlogic/workspaces/sitegeist/src/prompts/prompts.ts`
  - Element picker tool description
  - Updated to use ## headers pattern
  - Fixed reference from browser_javascript to browserjs() + repl

- [x] **navigate** - 220 → 179 tokens (19% reduction)
  - Location: `/Users/badlogic/workspaces/sitegeist/src/prompts/prompts.ts`
  - Navigate tool description (not runtime provider)
  - Added tab ID to return value
  - Updated to use ## headers pattern

### Shared Tools (from pi-web-ui)
- [x] **artifacts** - 1,595 → ~550 tokens (65% reduction)
  - Location: `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/prompts/prompts.ts`
  - Artifacts tool description
  - Updated to use # h1 + ## h2 pattern
  - Clear distinction: artifacts tool (YOU author) vs REPL + storage (CODE processes)
  - Established pattern: REPL generates data → Artifacts tool creates HTML that visualizes it
  - Simplified Input format: { action: "...", param: "..." }
  - Removed verbose Commands section, ANTI-PATTERNS, file type specifics
  - Added HTML Artifacts section with Data Access, Requirements, Styling subsections
  - Changed logs → htmlArtifactLogs for clarity
  - Simplified to esm.sh only for ES modules
  - Added guidance: avoid purple gradients, AI aesthetic clichés, and emojis

- [x] **extract_document** - 263 → 107 tokens (59% reduction)
  - Location: `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/prompts/prompts.ts`
  - Document extraction tool description
  - Updated to use # h1 + ## h2 pattern
  - Changed Parameters → Input with example format
  - Removed verbose Returns examples and Notes section
