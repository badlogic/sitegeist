# Multi-Window Session Management

## Overview

Sitegeist implements window-scoped session locking using Chrome's port API to prevent the same session from being open in multiple windows simultaneously. Each session can only be active in one window at a time.

## Behavior

### Opening Sidepanels

**First Window** (Cmd+Shift+P):
- Opens sidepanel
- Automatically loads last active session
- Session is locked to this window
- Navigation events from tabs in this window are tracked

**Second Window** (Cmd+Shift+P):
- Opens sidepanel
- Last session is locked → shows landing page with welcome message
- Can create new session or select different session from history

**Keyboard Shortcut** (Cmd+Shift+P):
- When sidepanel closed → opens it
- When sidepanel open → closes it
- Works independently per window

### Session List Dialog

Sessions display visual status:
- **Current** badge (blue): Session active in current window
- **Locked** badge (red): Session active in another window (not selectable)
- Locked sessions are dimmed and non-clickable

### Automatic Lock Release

Locks are automatically released when:
- Sidepanel closes (X button click)
- Window closes
- Page navigates (session switch, Cmd+U to debug page)
- Sidepanel crashes
- Extension reloads

No manual cleanup code needed - port disconnect handles everything.

## Architecture

### Port-Based Communication

Uses `chrome.runtime.connect()` for reliable lifecycle tracking. Port disconnects automatically trigger lock cleanup.

**Why Ports vs Messages**:
- `runtime.sendMessage()`: One-shot, unreliable in `beforeunload`
- `runtime.connect()`: Long-lived, `onDisconnect` fires reliably on page unload

### Components

#### Background Service Worker ([background.ts](../src/background.ts))

Manages session locks and port connections. See implementation for details.

**Key responsibilities** (lines 21-122):
- **State**: Tracks `sessionLocks` (sessionId → windowId) and `windowPorts` (windowId → port)
- **Port handler** (line 26): Listens for connections with name format `sidepanel:${windowId}`
  - `acquireLock` message: Grants lock if available or owner port is dead (stale lock detection)
  - `getLockedSessions` message: Returns all current locks for session list UI
  - `onDisconnect`: Auto-releases all locks for the disconnected window
- **Window cleanup** (line 88): Belt-and-suspenders cleanup when entire window closes
- **Keyboard shortcut** (line 98): Toggles sidepanel open/close via port existence check

#### Port Module ([utils/port.ts](../src/utils/port.ts))

Centralized port communication with automatic reconnection and type-safe messaging. See implementation for details.

**Key features**:
- **Initialization** (line 116): `initialize(windowId)` - must be called before sending messages
- **Auto-reconnection** (line 173): 2-attempt retry with automatic reconnect on failure or ~5min inactivity timeout
- **Type-safe messaging** (line 173): `sendMessage<TRequest>` infers response type from request type
- **Message routing** (line 134): Dispatches responses to registered handlers, handles `close-yourself` command
- **Connection management** (line 125): Creates port with name `sidepanel:${windowId}`, listens for disconnect

#### Sidepanel ([sidepanel.ts](../src/sidepanel.ts))

Uses port module for session locking and tracks window-specific events. See implementation for details.

**Key behaviors**:
- **Port init** (line 660): Calls `port.initialize(currentWindowId)` during app startup
- **Lock on init** (line 703): Tries to acquire lock for latest session, shows landing page if locked
- **Lock on session creation** (line 230): Acquires lock when first message creates a sessionId
- **Window filtering** (line 518, 538): Only tracks tab navigation/activation in current window
- **No manual cleanup**: Port disconnect automatically releases locks on navigation/close

#### Session List Dialog ([dialogs/SessionListDialog.ts](../src/dialogs/SessionListDialog.ts))

Displays session list with Current/Locked badges. See implementation for details.

**Key features**:
- **Lock query** (line 78): Uses `port.sendMessage({ type: "getLockedSessions" })` to fetch all locks
- **Badge logic** (line 153-163): `isSessionLocked()` and `isCurrentSession()` determine badge display
- **UI rendering** (line 473-497): Locked sessions are dimmed and non-clickable, current session highlighted

## Technical Details

### Port Lifecycle

**Port Creation**: `runtime.connect({ name: "sidepanel:${windowId}" })`
**Port Disconnect**: Fires when page unloads for ANY reason:
- Manual close (X button)
- Window close
- Navigation (`window.location.href`)
- Crash
- Extension reload

**Reliability**: Chrome guarantees `onDisconnect` fires - official API for tracking page lifecycle

### Stale Lock Detection

Background checks if lock owner's port still exists before denying lock request. If owner port is dead (stale lock), lock is reassigned to requester. See [background.ts:80-81](../src/background.ts#L80-L81).

If service worker restarts and loses lock state, no ports exist → all locks treated as available (good default).

### Memory-Only Locks

**Why**: Persisting locks to `chrome.storage` doesn't solve cleanup problem and creates stale locks across extension reloads.

**Trade-off**: Lock loss on service worker restart is acceptable:
- Service worker stays alive while sidepanels are open (ports keep it alive)
- If it restarts, sidepanel port disconnects briefly and reconnects automatically
- Port module handles automatic reconnection after ~5min inactivity disconnect (2-attempt retry logic)
- User can always reopen session

See [utils/port.ts:173-236](../src/utils/port.ts#L173-L236) for reconnection implementation.

## Test Scenarios

1. **Basic Isolation**
   - Window A: Open sidepanel (Cmd+Shift+P) → session loads
   - Window B: Open sidepanel → landing page (session locked)
   - Navigate in Window A tabs → only Window A sees events
   - Navigate in Window B tabs → no effect on Window A

2. **New Session Lock**
   - Window A: Create new session, send first message
   - Window A: Wait for response (sessionId assigned, lock acquired)
   - Window B: Open sidepanel → landing page (Window A's session locked)
   - Window B: Session list → Window A's session shows "Locked" badge

3. **Lock Badges**
   - Window A: Open session list → session has "Current" badge
   - Window B: Open session list → same session has "Locked" badge, not clickable

4. **Session Switching**
   - Window A: Switch to different session
   - Window B: Session list → original session now selectable (lock released)

5. **Sidepanel Close**
   - Window A: Close sidepanel with X button
   - Window B: Open sidepanel → session loads (lock released)

6. **Window Close**
   - Window A: Close entire window
   - Window B: Session now available (lock released)

7. **Keyboard Toggle**
   - Sidepanel open: Cmd+Shift+P → closes
   - Sidepanel closed: Cmd+Shift+P → opens
   - Independent per window

8. **Navigation**
   - Cmd+U to debug page → locks released
   - Session switch → locks released
   - All handled by port disconnect

## Edge Cases

### Service Worker Sleep
**Scenario**: Background service worker goes inactive
**Impact**: In-memory locks lost
**Resolution**: Ports keep service worker alive while sidepanels open. If it restarts, ports reconnect and locks are re-acquired.

### Extension Reload
**Scenario**: User reloads extension
**Impact**: All locks cleared, all ports disconnected
**Resolution**: Intentional - prevents stale locks. Users can reopen any session.

### Crashed Sidepanel
**Scenario**: Sidepanel crashes without closing gracefully
**Impact**: Port disconnects
**Resolution**: Lock automatically released via `onDisconnect`

### Direct URL Navigation
**Scenario**: User manually types `?session=123` in URL
**Impact**: Triggers lock acquisition check
**Resolution**: Shows landing page if session is locked, loads if available

## Related Files

**Core Implementation**:
- [background.ts](../src/background.ts) - Port handler, lock manager, keyboard shortcut toggle, window close cleanup
- [utils/port.ts](../src/utils/port.ts) - Centralized port communication with automatic reconnection, type-safe message handling
- [sidepanel.ts](../src/sidepanel.ts) - Port initialization, window ID filtering, lock acquisition on init and session creation

**UI Components**:
- [dialogs/SessionListDialog.ts](../src/dialogs/SessionListDialog.ts) - Lock badges UI (Current/Locked), lock state querying
- [utils/i18n-extension.ts](../src/utils/i18n-extension.ts) - "Current" and "Locked" translations

**Configuration**:
- [static/manifest.chrome.json](../static/manifest.chrome.json) - Chrome keyboard shortcut: "toggle-sidepanel" with Cmd+Shift+P
