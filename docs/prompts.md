# Prompts Architecture

## Overview

This document describes the architecture of prompts, tool descriptions, and runtime provider descriptions across the Sitegeist and web-ui codebases. Understanding this architecture is essential for maintaining and updating prompts consistently.

## Core Concepts

### 1. Tools
Tools are capabilities that the LLM can invoke. Each tool has:
- **Name**: Identifier (e.g., `browser_repl`, `artifacts`)
- **Label**: Human-readable name
- **Parameters**: JSON schema defining inputs
- **Description**: Instructions for the LLM on when and how to use the tool
- **Execute**: Function that runs when the tool is called

### 2. Runtime Providers
Runtime providers inject special functions into sandboxed execution environments. Each provider implements the `SandboxRuntimeProvider` interface with:
- **getData()**: Returns data to inject into `window` scope
- **getRuntime()**: Returns a function that will be stringified and executed in the sandbox to define helper functions
- **handleMessage()**: Optional bidirectional communication handler
- **getDescription()**: Returns documentation describing what functions this provider makes available

### 3. Tool Descriptions with Provider Injection
Tool descriptions are **template functions** that accept an array of runtime provider descriptions and inject them into the appropriate location:

```typescript
export const TOOL_DESCRIPTION = (runtimeProviderDescriptions: string[]) => `
# Tool Name

## When to Use
...

## Available Functions
${runtimeProviderDescriptions.join("\n\n")}
`;
```

The descriptions from runtime providers are **dynamically injected** so the LLM knows what functions are available in that tool's execution context.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent Initialization                     │
│                      (sidepanel.ts:304-349)                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
           ┌───────────┴──────────┐
           │                      │
           ▼                      ▼
    ┌──────────┐          ┌──────────────┐
    │  Tools   │          │  Runtime     │
    │          │          │  Providers   │
    └──────────┘          └──────────────┘
           │                      │
           │                      │
    ┌──────┴──────────────────────┴──────┐
    │                                     │
    ▼                                     ▼
┌────────────────┐              ┌──────────────────┐
│ Tool           │              │ Provider         │
│ Description    │◄─────────────│ getDescription() │
│ (template fn)  │   injected   │                  │
└────────────────┘              └──────────────────┘
```

## File Locations

### Web-UI Prompts
**File**: `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/prompts/prompts.ts`

Contains shared prompts and runtime provider descriptions:

1. **JAVASCRIPT_REPL_TOOL_DESCRIPTION(runtimeProviderDescriptions)** (line 10)
   - Template function for JavaScript REPL tool
   - Accepts runtime provider descriptions array
   - Documents sandboxed execution environment

2. **ARTIFACTS_TOOL_DESCRIPTION(runtimeProviderDescriptions)** (line 69)
   - Template function for artifacts tool
   - Accepts runtime provider descriptions array
   - Documents create/update/rewrite/get/delete/logs commands

3. **ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION** (line 163)
   - Provider description for artifact manipulation functions
   - Exported to be used in tool descriptions
   - Documents: `listArtifacts()`, `getArtifact()`, `createOrUpdateArtifact()`, `deleteArtifact()`

4. **ATTACHMENTS_RUNTIME_DESCRIPTION** (line 209)
   - Provider description for user attachment access
   - Documents: `listAttachments()`, `readTextAttachment()`, `readBinaryAttachment()`

5. **EXTRACT_DOCUMENT_DESCRIPTION** (line 240)
   - Tool description for document extraction
   - Simple description (not a template - no runtime providers)

### Sitegeist Prompts
**File**: `/Users/badlogic/workspaces/sitegeist/src/prompts/prompts.ts`

Contains Sitegeist-specific prompts:

1. **SYSTEM_PROMPT** (line 12)
   - Main agent system prompt
   - Defines identity, tone, tools, workflows
   - Used during agent initialization in sidepanel.ts

2. **NATIVE_INPUT_EVENTS_DESCRIPTION** (line 180)
   - Runtime provider description for trusted browser events
   - Documents: `nativeClick()`, `nativeType()`, `nativePress()`, `nativeKeyDown()`, `nativeKeyUp()`
   - Embedded directly into BROWSER_JAVASCRIPT_DESCRIPTION

3. **NAVIGATE_TOOL_DESCRIPTION** (line 224)
   - Tool description for navigate tool
   - Simple description (no runtime providers)

4. **JAVASCRIPT_REPL_DESCRIPTION** (line 246)
   - Documentation for browser_repl tool with browserjs()/navigate() helpers
   - ⚠️ **ISSUE**: Manually composed, should use template from web-ui

5. **ASK_USER_WHICH_ELEMENT_DESCRIPTION** (line 325)
   - Tool description for element selector
   - Simple description (no runtime providers)

6. **SKILL_TOOL_DESCRIPTION** (line 363)
   - Tool description for skill management
   - Simple description (no runtime providers)

## Implementation Details

### How Runtime Providers Work

#### 1. Provider Implementation
Example from `ArtifactsRuntimeProvider.ts`:

```typescript
export class ArtifactsRuntimeProvider implements SandboxRuntimeProvider {
    getData(): Record<string, any> {
        // Data to inject into window scope
        return { artifacts: snapshot };
    }

    getRuntime(): (sandboxId: string) => void {
        // This function is stringified and executed in sandbox
        return (_sandboxId: string) => {
            (window as any).listArtifacts = async () => { ... };
            (window as any).getArtifact = async (filename: string) => { ... };
            // etc.
        };
    }

    handleMessage(message: any, respond: (response: any) => void) {
        // Handle bidirectional communication
    }

    getDescription(): string {
        return ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION;
    }
}
```

#### 2. Tool Registration with Provider Injection
Example from `artifacts.ts:242-254`:

```typescript
public get tool(): AgentTool<typeof artifactsParamsSchema, undefined> {
    const self = this;
    return {
        label: "Artifacts",
        name: "artifacts",
        get description() {
            // Dynamically get provider descriptions
            const runtimeProviderDescriptions =
                self.runtimeProvidersFactory?.()
                    .map((d) => d.getDescription())
                    .filter((d) => d.trim().length > 0) || [];
            // Inject into template
            return ARTIFACTS_TOOL_DESCRIPTION(runtimeProviderDescriptions);
        },
        parameters: artifactsParamsSchema,
        execute: async (...) => { ... }
    };
}
```

The `description` property is a **getter** that:
1. Calls `runtimeProvidersFactory()` to get all providers
2. Maps each provider to its `getDescription()` output
3. Filters out empty descriptions
4. Passes array to the template function

#### 3. Provider Composition in Sidepanel
Example from `sidepanel.ts:320-332`:

```typescript
replTool.runtimeProvidersFactory = () => {
    // Providers available in page context via browserjs()
    const pageProviders = [
        ...runtimeProvidersFactory(), // attachments + artifacts from ChatPanel
        new NativeInputEventsRuntimeProvider(), // trusted browser events
    ];

    return [
        ...pageProviders, // Available in REPL context too
        new BrowserJsRuntimeProvider(pageProviders), // Page context orchestration
        new NavigateRuntimeProvider(navigateTool), // Navigation helper
    ];
};
```

This composition ensures:
- Base providers (attachments, artifacts) are available everywhere
- Page-specific providers (native input events) are available via `browserjs()`
- REPL-specific providers (browserjs, navigate) are available in REPL context

### How Descriptions Flow Through the System

```
1. Provider defines getDescription()
   └─> Returns description string

2. Tool's runtimeProvidersFactory() returns provider instances
   └─> Called when tool.description getter is accessed

3. Tool description getter collects descriptions
   └─> Calls getDescription() on each provider
   └─> Filters empty strings
   └─> Passes array to template function

4. Template function injects descriptions
   └─> Uses ${runtimeProviderDescriptions.join("\n\n")}
   └─> Returns complete tool description

5. Agent uses tool description
   └─> Tool description sent to LLM with prompt
   └─> LLM knows what functions are available
```

## Runtime Provider Descriptions Pattern

All provider descriptions must follow this pattern:

```markdown
### Provider Name

Brief one-sentence summary of what these functions provide.

#### When to Use
- Bullet point describing use case
- Another use case

#### Do NOT Use For
- Negative case
- Another negative case

#### Functions
- functionName(params) - Brief description, returns type
  * Usage notes
  * Example: const result = functionName(arg);

- anotherFunction(params) - Brief description, returns type
  * Example: await anotherFunction(arg);

#### Example
Complete workflow example:
\`\`\`javascript
const data = await someFunction();
await anotherFunction(data);
\`\`\`
```

**Key requirements**:
- Start with `###` heading for provider name
- Add one-sentence summary immediately after heading
- Use `####` subheadings for: "When to Use", "Do NOT Use For", "Functions", "Example"
- List functions with parameter and return type info
- Provide inline examples for each function
- End with complete workflow example in code block
- Keep descriptions minimal (token efficiency)

## Tool Description Pattern

All tool descriptions must follow this pattern:

```markdown
# Tool Name

## Purpose
One-line summary of what the tool does.

## When to Use
- Use case 1
- Use case 2
- Use case 3

## Environment
- What execution context
- What APIs are available
- What libraries can be imported

## Input
- How to provide input
- What data is available

## Output
- How to return data
- What formats are supported
- What happens to the output

## Example
\`\`\`javascript
// Concrete example
const result = doSomething();
console.log(result);
\`\`\`

## Important Notes
- Critical constraint 1
- Critical constraint 2

## Helper Functions (Automatically Available)

These functions are injected into the execution environment and available globally:

${runtimeProviderDescriptions.join("\n\n")}
```

**Key requirements**:
- Use `#` for main heading, `##` for sections
- Start with Purpose (one line)
- Include "When to Use", "Environment", "Input", "Output"
- Provide concrete examples
- End with "Helper Functions (Automatically Available)" section for runtime provider injection
- Keep minimal (token efficiency)

## Current Issues & Migration Path

### Issues

1. **JAVASCRIPT_REPL_DESCRIPTION is manually composed**
   - Sitegeist has its own version instead of using web-ui template
   - Should use `JAVASCRIPT_REPL_TOOL_DESCRIPTION` from web-ui
   - Need to ensure runtime provider descriptions are properly injected

2. **Inconsistent provider description styles**
   - Some providers return minimal descriptions (e.g., BrowserJsRuntimeProvider: "Provides browserjs() helper")
   - Others follow the full pattern (e.g., ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION)
   - Need to standardize all to follow the full pattern

3. **browserjs() and navigate() lack provider descriptions**
   - `BrowserJsRuntimeProvider.getDescription()` returns stub
   - `NavigateRuntimeProvider.getDescription()` returns stub
   - Should follow full provider description pattern with examples

### Migration Tasks

#### High Priority

1. **Standardize BrowserJsRuntimeProvider description**
   - Create full description following the pattern
   - Document `browserjs(func, ...args)` with examples
   - Add WHEN TO USE and DO NOT USE sections

2. **Standardize NavigateRuntimeProvider description**
   - Create full description following the pattern
   - Document `navigate(args)` with examples
   - Add WHEN TO USE and DO NOT USE sections

#### Medium Priority

3. **Use web-ui JAVASCRIPT_REPL_TOOL_DESCRIPTION in sitegeist**
   - Remove custom JAVASCRIPT_REPL_DESCRIPTION from sitegeist prompts.ts
   - Import and use JAVASCRIPT_REPL_TOOL_DESCRIPTION from web-ui
   - Ensure runtime providers are properly passed

4. **Audit all provider descriptions for consistency**
   - NativeInputEventsRuntimeProvider - already follows pattern ✓
   - ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION - follows pattern ✓
   - ATTACHMENTS_RUNTIME_DESCRIPTION - follows pattern ✓
   - BrowserJsRuntimeProvider - needs work
   - NavigateRuntimeProvider - needs work

5. **Document skill library injection**
   - Skills auto-inject into browserjs() execution context
   - Need to document how this works in system prompt
   - Consider adding to BrowserJsRuntimeProvider description

## Writing Guidelines

### Structure
- Start with one-line summary
- Use clear headers (`##`, `###`)
- Group related information
- Put critical rules at the end with CRITICAL/IMPORTANT prefix
- Include concrete examples

### Language
- Be explicit: "ALWAYS use X", "NEVER use Y"
- Use active voice: "Click the button" not "The button should be clicked"
- Give concrete examples with code
- State consequences: "If you do X, Y will happen"
- Avoid "you should" or "it's recommended" - be direct

### Examples
Always provide:
- Inline examples for each function
- Complete workflow examples at the end
- Both positive and negative examples where helpful

### Testing
After updating prompts:
1. Edit the prompt file
2. Run `./check.sh` to verify no TypeScript errors
3. Test with actual agent - does it follow instructions?
4. Check edge cases - does it handle errors correctly?
5. Verify terminology is consistent across all prompts

## References

### Key Files

**Interfaces**:
- `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/components/sandbox/SandboxRuntimeProvider.ts` - Provider interface

**Prompt Definitions**:
- `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/prompts/prompts.ts` - Shared prompts and providers
- `/Users/badlogic/workspaces/sitegeist/src/prompts/prompts.ts` - Sitegeist-specific prompts

**Provider Implementations**:
- `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/components/sandbox/ArtifactsRuntimeProvider.ts` - Artifacts provider
- `/Users/badlogic/workspaces/sitegeist/src/tools/NativeInputEventsRuntimeProvider.ts` - Native events provider
- `/Users/badlogic/workspaces/sitegeist/src/tools/repl/runtime-providers.ts` - BrowserJs and Navigate providers

**Tool Implementations**:
- `/Users/badlogic/workspaces/pi-mono/packages/web-ui/src/tools/artifacts/artifacts.ts` - Artifacts tool
- `/Users/badlogic/workspaces/sitegeist/src/tools/repl/repl.ts` - REPL tool

**Integration**:
- `/Users/badlogic/workspaces/sitegeist/src/sidepanel.ts` - Tool and provider composition

### Related Documentation
- `docs/tool-renderers.md` - How tool invocations are rendered in UI
- `docs/storage.md` - Storage architecture
- `docs/skills.md` - Skill system (auto-inject libraries into browserjs)
