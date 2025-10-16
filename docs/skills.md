# Site Skills System

## Overview

**Site Skills** are reusable JavaScript libraries that provide domain-specific automation APIs for websites. Instead of writing DOM manipulation code from scratch, the LLM uses pre-built functions like `window.slack.reply("Thanks!")` or `window.gmail.search("from:boss")`.

Skills are:
- **Auto-injected** when matching domains are visited
- **Stored persistently** in extension storage
- **Glob-pattern matched** for flexible domain/path matching
- **LLM-accessible** via the `skill` tool

## Skill Format

```typescript
interface Skill {
  name: string;                    // Unique identifier (e.g., "slack", "youtube")
  domainPatterns: string[];        // Glob patterns (e.g., ["slack.com", "*.slack.com/client/*"])
  shortDescription: string;        // One-line plain text description
  description: string;             // Full markdown description with gotchas
  createdAt: string;              // ISO 8601 timestamp
  lastUpdated: string;            // ISO 8601 timestamp
  examples: string;               // JavaScript code examples
  library: string;                // JavaScript code to inject (e.g., "window.slack = {...}")
}
```

**Implementation**: [src/storage/stores/skills-store.ts](../src/storage/stores/skills-store.ts)

## Skill Tool API

### Get Skill Documentation

```javascript
await skill({
  action: 'get',
  name: 'youtube',
  includeLibraryCode: false  // Optional: include full library code
})
```

Returns skill description, examples, and optionally library code.

### List Skills

```javascript
// List skills for current tab URL
await skill({ action: 'list' })

// List skills for specific URL
await skill({ action: 'list', url: 'https://youtube.com' })

// List all skills (no filtering)
await skill({ action: 'list', url: '' })
```

Returns array of matching skills with names and short descriptions.

### Create Skill

```javascript
await skill({
  action: 'create',
  data: {
    name: 'github',
    domainPatterns: ['github.com', 'github.com/*/issues'],
    shortDescription: 'GitHub automation for issues and PRs',
    description: '# GitHub Skill\n\nAutomation for...',
    examples: '// Get issue list\nconst issues = github.getIssues();',
    library: 'window.github = { getIssues: () => {...} }'
  }
})
```

### Update Skill

```javascript
// Full field replacement
await skill({
  action: 'update',
  name: 'github',
  data: {
    library: 'window.github = { /* new code */ }',
    description: 'Updated description'
  }
})
```

Validates library syntax before saving. Merges with existing skill (only updates provided fields).

### Patch Skill

```javascript
// String replacement in specific fields
await skill({
  action: 'patch',
  name: 'slack',
  patches: {
    library: {
      old_string: '.message-input',
      new_string: '[data-qa="message_input"]'
    },
    description: {
      old_string: 'Works on all pages',
      new_string: 'Works on channel pages only'
    }
  }
})
```

Validates library syntax after patching. Safer than full update when changing small parts.

### Delete Skill

```javascript
await skill({ action: 'delete', name: 'old-skill' })
```

**Implementation**: [src/tools/skill.ts](../src/tools/skill.ts:236-520)

## Domain Matching

Skills use **minimatch** for glob pattern matching:

```javascript
// Exact domain
["slack.com"]  // Matches slack.com, app.slack.com, *.slack.com

// With path
["github.com/*/issues"]  // Matches github.com/org/repo/issues

// Wildcard domain
["google.*/search*"]  // Matches google.com/search, google.de/search?q=...

// Multiple patterns
["youtube.com", "youtu.be"]  // Matches both domains
```

**Implementation**: [src/storage/stores/skills-store.ts:81-112](../src/storage/stores/skills-store.ts)

## Skill Lifecycle

### 1. Detection & Injection

When user navigates to a page:

1. System checks for matching skills using domain patterns
2. Matching skills' libraries are auto-injected into page context
3. LLM receives system reminder about available skills

**Implementation**: Skills are injected via the browser JavaScript tools when they detect matching domains.

### 2. Using Skills

LLM can use skills in two ways:

**Direct usage** (if API is remembered):
```javascript
// In javascript_repl or browser_javascript
const messages = await slack.getMessages();
```

**Get documentation** (when needed):
```javascript
await skill({ action: 'get', name: 'slack' })
```

### 3. Creating Skills

**User triggers**:
- "let's create a skill for this site"
- "can we make a GitHub skill?"
- "save this automation as a skill"

**LLM workflow**:
1. **Identify tasks** - Ask what user wants to automate
2. **Explore & implement** - Test each function interactively
3. **Build library** - Create namespace object with all functions
4. **Document** - Write description and examples
5. **Save** - Call `skill({ action: 'create', ... })`

### 4. Updating Skills

When skill breaks (selectors changed, page updated):

1. **Debug** - Investigate what changed
2. **Fix** - Update affected function(s)
3. **Patch or Update** - Use `patch` for small changes, `update` for major changes
4. **Test** - Verify fix works
5. **Continue** - Resume original task

## Default Skills

Sitegeist ships with built-in skills:

- **google** - Extract search results, featured snippets, related searches
- **google-sheets** - Cell/range operations, formatting, title management
- **linkedin-engagement** - Collect posts, get comment trees, post replies
- **whatsapp** - [Coming soon]
- **youtube** - Video controls, info extraction, transcripts, comments

**Implementation**: [src/tools/skill.ts:37-114](../src/tools/skill.ts)

## Syntax Validation

Skills are validated before saving:

- JavaScript code is executed in a sandboxed iframe
- CSP-compliant (no eval, no Function constructor)
- Timeout protection (5 seconds)
- Errors reported to user with details

**Implementation**: [src/tools/skill.ts:136-161](../src/tools/skill.ts)

## Best Practices

### ✅ DO

- **Use descriptive names**: `window.slack.sendMessage()` not `window.slack.send()`
- **Add console.log messages**: Help debug when things break
- **Handle errors gracefully**: Return useful error messages
- **Include short URLs**: `domainPatterns: ['youtube.com', 'youtu.be']`
- **Document limitations**: "Only works on channel pages, not DMs"
- **Keep functions simple**: One task per function
- **Test immediately**: Verify each function works before saving

### ❌ DON'T

- **Don't make functions do too much**: Split into smaller functions
- **Don't forget to document**: Examples show LLM how to use the skill
- **Don't use complex selectors**: Page structure changes break skills
- **Don't hardcode values**: Use parameters instead
- **Don't create duplicate skills**: Update existing ones instead

## UI Components

### Skill Management Dialog

Users can browse, view, edit, and delete skills via Settings → Skills tab.

**Implementation**: [src/dialogs/SkillsTab.ts](../src/dialogs/SkillsTab.ts)

### Skill Pills

Skills are shown as interactive pills in the chat when relevant.

**Implementation**: [src/components/SkillPill.ts](../src/components/SkillPill.ts)

## Files

**Core Implementation:**
- [src/tools/skill.ts](../src/tools/skill.ts) - Skill tool, validation, defaults
- [src/storage/stores/skills-store.ts](../src/storage/stores/skills-store.ts) - Storage and matching
- [src/prompts/tool-prompts.ts](../src/prompts/tool-prompts.ts) - Tool description for LLM

**UI Components:**
- [src/dialogs/SkillsTab.ts](../src/dialogs/SkillsTab.ts) - Settings management UI
- [src/dialogs/SkillDialog.ts](../src/dialogs/SkillDialog.ts) - Create/edit dialog
- [src/components/SkillPill.ts](../src/components/SkillPill.ts) - Skill pills in chat

**Tool Renderers:**
- [src/tools/skill.ts:560-700](../src/tools/skill.ts) - Skill tool result renderer
