/**
 * Centralized port communication module for sidepanel <-> background messaging.
 *
 * Handles automatic reconnection when port disconnects (Chrome disconnects after ~5min inactivity).
 * Background script listeners (runtime.onConnect) stay alive forever and handle new connections.
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Request to acquire a session lock.
 * Sent from sidepanel to background.
 */
export interface AcquireLockMessage {
	type: "acquireLock";
	sessionId: string;
	windowId: number;
}

/**
 * Response to acquireLock request.
 * Sent from background to sidepanel.
 */
export interface LockResultMessage {
	type: "lockResult";
	sessionId: string;
	success: boolean;
	ownerWindowId?: number; // Set if lock failed (session owned by another window)
}

/**
 * Request to get all currently locked sessions.
 * Sent from sidepanel to background.
 */
export interface GetLockedSessionsMessage {
	type: "getLockedSessions";
}

/**
 * Response to getLockedSessions request.
 * Sent from background to sidepanel.
 */
export interface LockedSessionsMessage {
	type: "lockedSessions";
	locks: Record<string, number>; // sessionId -> windowId
}

/**
 * Command from background to sidepanel to close itself.
 * Used for keyboard shortcut toggle.
 */
export interface CloseYourselfMessage {
	type: "close-yourself";
}

/**
 * All messages that can be sent from sidepanel to background.
 */
export type SidepanelToBackgroundMessage =
	| AcquireLockMessage
	| GetLockedSessionsMessage;

/**
 * All messages that can be sent from background to sidepanel.
 */
export type BackgroundToSidepanelMessage =
	| LockResultMessage
	| LockedSessionsMessage
	| CloseYourselfMessage;

/**
 * Maps request message types to their corresponding response message types.
 * This allows TypeScript to infer the response type from the request.
 */
export interface MessagePairs {
	acquireLock: {
		request: AcquireLockMessage;
		response: LockResultMessage;
	};
	getLockedSessions: {
		request: GetLockedSessionsMessage;
		response: LockedSessionsMessage;
	};
}

/**
 * Helper type to extract response type from request message type.
 */
type ResponseForRequest<TRequest extends SidepanelToBackgroundMessage> =
	TRequest extends AcquireLockMessage ? LockResultMessage :
	TRequest extends GetLockedSessionsMessage ? LockedSessionsMessage :
	never;

// ============================================================================
// PORT COMMUNICATION
// ============================================================================

let port: chrome.runtime.Port | null = null;
let currentWindowId: number | undefined;
const responseHandlers = new Map<string, (msg: BackgroundToSidepanelMessage) => void>();

/**
 * Initialize port system with window ID.
 * Must be called before sending any messages.
 */
export function initialize(windowId: number): void {
	currentWindowId = windowId;
	connect();
}

/**
 * Create new port connection and set up listeners.
 * Background script will receive this connection via runtime.onConnect.
 */
function connect(): void {
	if (!currentWindowId) {
		throw new Error("[Port] Cannot connect: windowId not initialized");
	}

	console.log("[Port] Connecting...");
	port = chrome.runtime.connect({ name: `sidepanel:${currentWindowId}` });

	// Set up message listener to dispatch responses
	port.onMessage.addListener((msg) => {
		// Handle special close-yourself command
		if (msg.type === "close-yourself") {
			window.close();
			return;
		}

		// Dispatch to registered response handlers
		const handler = responseHandlers.get(msg.type);
		if (handler) {
			handler(msg);
		}
	});

	// Set up disconnect listener
	port.onDisconnect.addListener(() => {
		console.log("[Port] Disconnected (likely due to inactivity timeout)");
		port = null;
	});

	console.log("[Port] Connected");
}

/**
 * Mark port as disconnected.
 * Next send attempt will create a new connection.
 */
function disconnect(): void {
	port = null;
}

/**
 * Send a message through the port and wait for a response.
 * The response type is automatically inferred from the request message type.
 *
 * @param message - Request message to send to background script
 * @param responseType - Expected response message type (e.g., "lockResult")
 * @param timeoutMs - Response timeout in milliseconds (default: 5000)
 * @returns Promise resolving to the corresponding response message
 */
export async function sendMessage<TRequest extends SidepanelToBackgroundMessage>(
	message: TRequest,
	responseType: ResponseForRequest<TRequest>["type"],
	timeoutMs?: number,
): Promise<ResponseForRequest<TRequest>>;

/**
 * Send a fire-and-forget message through the port (no response expected).
 *
 * @param message - Message to send to background script
 * @returns Promise resolving when message is sent
 */
export async function sendMessage(
	message: SidepanelToBackgroundMessage,
): Promise<void>;

// Implementation
export async function sendMessage<TRequest extends SidepanelToBackgroundMessage>(
	message: SidepanelToBackgroundMessage,
	responseType?: string,
	timeoutMs = 5000,
): Promise<ResponseForRequest<TRequest> | void> {
	for (let attempt = 1; attempt <= 2; attempt++) {
		// Ensure we have a port connection
		if (!port) {
			connect();
		}

		// TypeScript: at this point port cannot be null (connect() sets it)
		if (!port) {
			throw new Error("[Port] Failed to establish connection");
		}

		try {
			// Set up response handler if expecting a response
			let responsePromise: Promise<BackgroundToSidepanelMessage> | undefined;
			if (responseType) {
				responsePromise = new Promise<BackgroundToSidepanelMessage>((resolve, reject) => {
					const timeoutId = setTimeout(() => {
						responseHandlers.delete(responseType);
						reject(new Error(`[Port] Timeout waiting for response: ${responseType}`));
					}, timeoutMs);

					responseHandlers.set(responseType, (msg: BackgroundToSidepanelMessage) => {
						clearTimeout(timeoutId);
						responseHandlers.delete(responseType);
						resolve(msg);
					});
				});
			}

			// Try to send the message
			// This can throw if port disconnected between our check and this call
			port.postMessage(message);

			// Wait for response if needed
			if (responsePromise) {
				return (await responsePromise) as ResponseForRequest<TRequest>;
			}
			return;
		} catch (err) {
			// Clean up response handler if we set one up
			if (responseType) {
				responseHandlers.delete(responseType);
			}

			// If this was our last attempt, give up
			if (attempt === 2) {
				throw new Error(`[Port] Failed to send message after ${attempt} attempts: ${err}`);
			}

			// Retry: disconnect and loop will reconnect
			console.warn(`[Port] Send attempt ${attempt} failed, will retry...`, err);
			disconnect();
		}
	}
}

/**
 * Check if port is currently connected.
 * Note: This is best-effort - port can disconnect immediately after this check.
 */
export function isConnected(): boolean {
	return port !== null;
}
