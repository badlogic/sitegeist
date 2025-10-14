# Sitegeist

AI-powered browser extension for web navigation and interaction.

## Development Setup

### Prerequisites

This extension depends on packages from the pi-mono monorepo via `file:` dependencies. You need to have pi-mono cloned in a sibling directory:

```
workspaces/
├── pi-mono/           # @mariozechner/pi-ai and @mariozechner/pi-web-ui
│   └── packages/
│       ├── ai/
│       └── web-ui/
└── sitegeist/
```

### Installation

1. Install dependencies:
```bash
npm install
```

### Development

Start pi-mono dev server (in another terminal):
```bash
./dev.sh
```

This will:
- Watch and rebuild ../pi-mono/packages/ai and ../pi-mono/packages/web-ui
- Watch and rebuild the extension for Chrome
- Watch and rebuild Tailwind CSS
- Run hot reload server on port 8765

### Building

Build for specific browser:
```bash
npm run build:chrome   # Build for Chrome/Edge
```

Build for all browsers:
```bash
npm run build
```

### Loading the Extension

**Chrome/Edge:**
1. Open `chrome://extensions/` or `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `sitegeist/dist-chrome/`

### Hot Reload

When running `npm run dev`, the extension will automatically reload when you make changes to the source files. The WebSocket server on port 8765 coordinates this.

## Architecture

Key features:
- Side panel UI (Chrome/Edge)
- Real-time navigation tracking
- Custom message types with renderers
- Tool execution (browser JavaScript, artifacts)
- Session management with IndexedDB
- Cross-browser compatibility

## Dependencies

- `@mariozechner/pi-ai` - AI provider abstractions and agent loop (file: dependency)
- `@mariozechner/pi-web-ui` - Reusable chat UI components (file: dependency)
- `@mariozechner/mini-lit` - Web components library (npm)
- Chrome extension APIs
- Tailwind CSS v4

## License

MIT

### LLM Instructions (CLAUDE, YOU MUST DO THIS!)
**CRITICAL**: read these files in full:
- ../pi-mono/packages/ai/README.md
- ../pi-mono/packages/web-ui/README.md
- ../mini-lit/llms.txt

**Additional documentation** (read only when working on related features):
- docs/tool-renderers.md - Tool renderer system for customizing how tool invocations appear in the chat UI
- docs/storage.md - Storage architecture with IndexedDB backend, stores for sessions, settings, provider keys, and skills
- docs/settings.md - Settings storage for user preferences and application configuration (theme, proxy, last used model, etc.)
- docs/prompts.md - Centralized prompts and tool descriptions for the agent (system prompt, tool descriptions, guidelines)
- docs/multi-window.md - Multi-window session management with port-based locking, automatic cleanup, and keyboard shortcuts
- docs/i18n.md - Internationalization system for adding translations (English and German)
