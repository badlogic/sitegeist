# Browser Execution Refactor Plan

## 1. Unify Execution Path
- **Current**  
  - `src/tools/browser-javascript.ts`: standalone tool with bespoke runtime wiring, renderer, prompts.  
  - `pi-mono/packages/web-ui/src/tools/javascript-repl.ts`: separate sandbox executor without navigation/browser helpers.  
  - Issues: duplicate code paths; inaccurate prompts; abort semantics weak.
- **Plan**  
  - [ ] Delete `BrowserJavaScriptTool` class, renderer, exports, prompt strings. Remove references in `sidepanel.ts`, debug builds.  
  - [ ] Move shared execution logic into new module `src/runtime/browser-script-executor.ts` (wrapper builder, timeout handling, provider registration).  
  - [ ] Update `javascript-repl` to import and use the shared executor.

## 2. REPL Helper APIs
- **Current**  
  - No official `browserjs`/`navigate` helpers in the REPL sandbox; experimentation requires ad-hoc providers.  
- **Plan**  
  - [ ] Add `BrowserJsRuntimeProvider` and `NavigateRuntimeProvider` (new file e.g. `src/runtime/repl-providers.ts`). Inject helpers that call existing `BrowserJavaScriptTool`/`NavigateTool` instances via `sendRuntimeMessage`.  
  - [ ] Modify `ChatPanel.setAgent` and `debug/ReplPanel.ts` (pi-mono) to include providers in `runtimeProvidersFactory`.  
  - [ ] Update `JAVASCRIPT_REPL_DESCRIPTION` and docs with helper usage examples.

## 3. Abort & Watchdog Behaviour
- **Current**  
  - Abort only rejects promises; user scripts keep running; navigation continues.  
  - `while(true)` loops rely solely on timeout in `wrapperFunction` inside `browser-javascript.ts`.  
- **Plan**  
  - [ ] Ensure shared executor always wraps user code in timeout guard (copy from current wrapper).  
  - [ ] When helpers propagate abort, call `chrome.tabs.stop()` in navigate implementation (if applicable) and ensure sandbox listeners are cleaned up.

## 4. web-ui Runtime Cleanup
- **Current**  
  - Runtime providers scattered under `pi-mono/packages/web-ui/src/components/sandbox`.  
  - `javascript-repl.ts` lives flat in `tools/`.  
- **Plan**  
  - [ ] Create `pi-mono/packages/web-ui/src/tools/javascript-repl/` folder. Move `javascript-repl.ts`, renderer, and new helper providers there.  
  - [ ] Relocate generic providers (`ArtifactsRuntimeProvider`, `AttachmentsRuntimeProvider`, etc.) into subfolder (e.g. `tools/javascript-repl/runtime/`). Update import paths.  
  - [ ] Run build/tests to verify path changes.

## 5. Prompts & Docs
- **Current**  
  - `src/prompts/tool-prompts.ts` references `createArtifact()` etc.; `docs/prompts.md` describes deprecated tool.  
  - `prompts-review.md` pending updates.  
- **Plan**  
  - [ ] Update prompts to reference REPL helpers; remove obsolete instructions.  
  - [ ] Revise docs (`docs/prompts.md`, `prompts-review.md`) with new workflow guidance.  
  - [ ] Note change in release notes / README.

## 6. Testing & Regression
- **Current**  
  - Existing workflows rely on old tool; regression coverage minimal for helper API.  
- **Plan**  
  - [ ] Smoke test skills (Google, Sheets, DeepLearning) via REPL helper path.  
  - [ ] Add automated tests (where possible) covering helper success, error, artifact writes, downloads, navigation loops.  
  - [ ] Validate timeout abort by running infinite loop script.
