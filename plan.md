# Runtime Provider Descriptions Refactoring Plan

## Problem

Runtime provider descriptions across the codebase are inconsistent, verbose, and not following a unified pattern. These descriptions get injected into tool descriptions (REPL, Artifacts) and need to be:

1. **Consistent schema** - All follow the exact same structure
2. **Concise** - Minimal tokens while being clear
3. **Accurate** - Reflect actual implementation and available contexts
4. **Embeddable** - Work cleanly when injected via `${runtimeProviderDescriptions.join("\n\n")}`

## Solution

Normalize all 5 runtime provider descriptions to follow this exact pattern:

```markdown
### Provider Name

Brief one-line summary of what this provider does.

#### When to Use
- Use case 1
- Use case 2

#### Do NOT Use For
- Anti-pattern 1
- Anti-pattern 2

#### Functions
- functionName(params) - Description, returns type
  * Example: code example

#### Example
Complete workflow:
\`\`\`javascript
code example
\`\`\`
```

**IMPORTANT**: Do NOT add "Available in: [context1, context2]" at the bottom. These descriptions are injected into tool descriptions (REPL, Artifacts) which already provide context.

## Runtime Provider Inventory

### 1. ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION
- **Description**: `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/prompts/prompts.ts:166`
- **Implementation**: `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/components/sandbox/ArtifactsRuntimeProvider.ts`
- **Available in**: REPL sandbox, HTML artifacts
- **Functions**: `listArtifacts()`, `getArtifact()`, `createOrUpdateArtifact()`, `deleteArtifact()`
- [x] Refactored and verified against implementation

### 2. ATTACHMENTS_RUNTIME_DESCRIPTION
- **Description**: `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/prompts/prompts.ts:219`
- **Implementation**: `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/components/sandbox/AttachmentsRuntimeProvider.ts`
- **Available in**: REPL sandbox, HTML artifacts
- **Functions**: `listAttachments()`, `readTextAttachment()`, `readBinaryAttachment()`
- [ ] Refactored and verified against implementation

### 3. NATIVE_INPUT_EVENTS_DESCRIPTION
- **Description**: `/Users/badlogic/workspaces/sitegeist/src/prompts/prompts.ts:178`
- **Implementation**: `/Users/badlogic/workspaces/sitegeist/src/tools/NativeInputEventsRuntimeProvider.ts`
- **Available in**: REPL sandbox AND browserjs() page context (both!)
- **Functions**: `nativeClick()`, `nativeType()`, `nativePress()`, `nativeKeyDown()`, `nativeKeyUp()`
- [x] Refactored and verified against implementation (696 → 392 tokens, -304 tokens, 44% reduction)

### 4. BROWSERJS_RUNTIME_PROVIDER_DESCRIPTION
- **Description**: `/Users/badlogic/workspaces/sitegeist/src/prompts/prompts.ts:252`
- **Implementation**: `/Users/badlogic/workspaces/sitegeist/src/tools/repl/runtime-providers.ts:24`
- **Available in**: REPL sandbox only
- **Functions**: `browserjs(func, ...args)`
- [ ] Refactored and verified against implementation

### 5. NAVIGATE_RUNTIME_PROVIDER_DESCRIPTION
- **Description**: `/Users/badlogic/workspaces/sitegeist/src/prompts/prompts.ts:313`
- **Implementation**: `/Users/badlogic/workspaces/sitegeist/src/tools/repl/runtime-providers.ts:281`
- **Available in**: REPL sandbox only
- **Functions**: `navigate(args)`
- [ ] Refactored and verified against implementation

## Workflow

For each runtime provider description:

1. **Read the implementation file** to understand exactly what functions are provided and their signatures
2. **Verify the execution contexts** where the provider is available (REPL sandbox, browserjs page context, HTML artifacts)
3. **Identify the actual function signatures and return types** from the code
4. **Rewrite the description** following the exact pattern above
5. **Check the checkbox** in this plan.md
6. **Run `./check.sh`** to ensure no errors
7. **STOP** - Let user review the changes before moving to next provider

## Notes

- Keep descriptions minimal - optimize for token efficiency
- Each function should have inline example code
- Complete workflow example should show realistic usage
- All descriptions must be exactly the same structure for consistency
- **DO NOT add "Available in:" line** - these descriptions are injected into tool descriptions which already provide context
