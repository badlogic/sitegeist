import { ConsoleRuntimeProvider, RUNTIME_MESSAGE_ROUTER, type SandboxRuntimeProvider } from "@mariozechner/pi-web-ui";
import {
	BROWSERJS_RUNTIME_PROVIDER_DESCRIPTION,
	NAVIGATE_RUNTIME_PROVIDER_DESCRIPTION,
} from "../../prompts/prompts.js";
import { getSitegeistStorage } from "../../storage/app-storage.js";
import type { NavigateParams, NavigateTool } from "../navigate.js";
import { buildWrapperCode, checkUserScriptsAvailability } from "./userscripts-helpers.js";

/**
 * BrowserJsRuntimeProvider
 *
 * Provides the browserjs() helper to REPL scripts, which executes code
 * in the active browser tab's page context via userScripts API.
 *
 * Usage in REPL:
 *   const title = await browserjs(() => document.title);
 *   const count = await browserjs((sel) => document.querySelectorAll(sel).length, '.product');
 */
export class BrowserJsRuntimeProvider implements SandboxRuntimeProvider {
	private activeSandboxIds: Set<string> = new Set();
	private activeExecutions = new Map<
		string,
		{
			tabId: number;
			executionId: string;
			abortSignal?: AbortSignal;
		}
	>();
	private sandboxAbortSignals = new Map<string, AbortSignal>();

	constructor(private sharedProviders: SandboxRuntimeProvider[]) {}

	getData(): Record<string, any> {
		return {};
	}

	getRuntime(): (sandboxId: string) => void {
		// This function will be stringified and injected into the REPL iframe
		return (_sandboxId: string) => {
			const sendRuntimeMessage = (window as any).sendRuntimeMessage;
			if (typeof sendRuntimeMessage !== "function") {
				throw new Error("sendRuntimeMessage is not available in this context");
			}

			// Inject browserjs() helper
			(window as any).browserjs = async (func: () => any, ...args: any[]): Promise<any> => {
				if (typeof func !== "function") {
					throw new Error("First argument to browserjs() must be a function");
				}

				const response = await sendRuntimeMessage({
					type: "browser-js",
					code: func.toString(),
					args: JSON.stringify(args),
				});

				// Log console output from browserjs() execution to REPL's console
				// BEFORE throwing errors, so console logs are visible even on failure
				if (response.console && Array.isArray(response.console)) {
					for (const log of response.console) {
						const method = log.type || "log";
						const message = `[browserjs] ${log.text}`;
						if (method === "error") {
							console.error(message);
						} else if (method === "warn") {
							console.warn(message);
						} else if (method === "info") {
							console.info(message);
						} else {
							console.log(message);
						}
					}
				}

				if (!response.success) {
					throw new Error(response.error || "browserjs() execution failed");
				}

				return response.result;
			};
		};
	}

	onExecutionStart(sandboxId: string, signal?: AbortSignal): void {
		if (signal) {
			this.sandboxAbortSignals.set(sandboxId, signal);
		}
	}

	onExecutionEnd(sandboxId: string): void {
		// Clean up the abort signal when REPL execution ends
		this.sandboxAbortSignals.delete(sandboxId);
	}

	async handleMessage(message: any, respond: (response: any) => void): Promise<void> {
		if (message.type !== "browser-js") {
			return;
		}

		console.log("[BrowserJsRuntimeProvider] Received message:", message);

		// Get the REPL sandbox's abort signal (if available)
		const replSandboxId = message.sandboxId;
		const abortSignal = replSandboxId ? this.sandboxAbortSignals.get(replSandboxId) : undefined;

		// Check if userScripts API is available
		const apiCheck = await checkUserScriptsAvailability();
		if (!apiCheck.available) {
			respond({
				success: false,
				error: apiCheck.message || "userScripts API not available",
			});
			return;
		}

		// Get current tab
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});

		if (!tab || !tab.id) {
			respond({
				success: false,
				error: "No active tab found",
			});
			return;
		}

		// Validate tab URL (reject chrome://, chrome-extension://, about: URLs)
		if (
			tab.url?.startsWith("chrome://") ||
			tab.url?.startsWith("chrome-extension://") ||
			tab.url?.startsWith("moz-extension://") ||
			tab.url?.startsWith("about:")
		) {
			respond({
				success: false,
				error: `Cannot execute scripts on ${tab.url}. Extension pages and internal URLs are protected.`,
			});
			return;
		}

		// Load skills for current tab URL
		const skillsRepo = getSitegeistStorage().skills;
		let skillLibrary = "";

		if (tab.url) {
			const matchingSkills = await skillsRepo.getSkillsForUrl(tab.url);
			if (matchingSkills.length > 0) {
				skillLibrary = `${matchingSkills.map((s) => s.library).join("\n\n")}\n\n`;
			}
		}

		// Generate unique sandbox ID for this execution
		const sandboxId = `browserjs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

		// Parse args (passed as JSON string)
		let parsedArgs: any[] = [];
		if (message.args) {
			try {
				parsedArgs = JSON.parse(message.args);
			} catch (e) {
				respond({
					success: false,
					error: `Failed to parse arguments: ${e}`,
				});
				return;
			}
		}

		// Track this sandbox for cleanup
		this.activeSandboxIds.add(sandboxId);

		// Create a dedicated ConsoleRuntimeProvider for this browserjs() execution
		const pageConsoleProvider = new ConsoleRuntimeProvider();

		// Build wrapper code with skills, providers (including dedicated console provider), and args
		const wrapperCode = buildWrapperCode(
			message.code,
			skillLibrary,
			false, // disable safeguards for now
			[pageConsoleProvider, ...this.sharedProviders],
			sandboxId,
			parsedArgs,
		);

		// Use fixed worldId for all executions
		const FIXED_WORLD_ID = "sitegeist-browser-script";

		// Check if terminate API is available (Chrome 138+)
		// @ts-expect-error - terminate is not yet in the type definitions
		const supportsTerminate = typeof chrome.userScripts?.terminate === "function";

		// Generate execution ID for cancellation support (only if terminate is available)
		const executionId = supportsTerminate ? crypto.randomUUID() : undefined;

		console.log(
			`[BrowserJsRuntimeProvider] Cancellation mode: ${supportsTerminate ? "Hybrid (cooperative + V8 termination)" : "Cooperative only (Chrome < 138)"}`,
		);

		// Track this execution for potential cancellation
		if (executionId) {
			this.activeExecutions.set(sandboxId, {
				tabId: tab.id,
				executionId: executionId,
				abortSignal: abortSignal,
			});
		}

		// Set up abort handler with hybrid approach:
		// 1. Cooperative cancellation (Promise wrapping) - always works
		// 2. V8 termination (Chrome API) - works now that execution stays tracked
		let abortHandler: (() => Promise<void>) | undefined;
		if (abortSignal) {
			abortHandler = async () => {
				console.log(`[BrowserJsRuntimeProvider] Aborting execution (hybrid approach)`);
				try {
					// Step 1: Set cooperative cancellation flag (guaranteed to work)
					await chrome.userScripts.execute({
						js: [{ code: "window.__sitegeist_cancelled = true;" }],
						target: { tabId: tab.id!, allFrames: false },
						world: "USER_SCRIPT",
						worldId: FIXED_WORLD_ID,
						injectImmediately: true,
					});
					console.log(`[BrowserJsRuntimeProvider] Set cancellation flag`);

					// Step 2: Try V8 termination if available (Chrome 138+)
					// This is a backup method - cooperative cancellation above is primary
					if (executionId && supportsTerminate) {
						try {
							// @ts-expect-error - terminate is not yet in the type definitions
							await chrome.userScripts.terminate(tab.id!, executionId);
							console.log(`[BrowserJsRuntimeProvider] V8 termination called for ${executionId}`);
						} catch (e) {
							// Expected errors:
							// - "execution_id not found in map" (cooperative cancellation was faster)
							// - Script already completed naturally
							console.debug(`[BrowserJsRuntimeProvider] V8 termination not needed (script already stopped):`, e);
						}
					} else if (!supportsTerminate) {
						console.debug(
							`[BrowserJsRuntimeProvider] V8 termination not available (Chrome < 138), using cooperative cancellation only`,
						);
					}
				} catch (e) {
					console.error(`[BrowserJsRuntimeProvider] Failed to abort:`, e);
				}
			};

			abortSignal.addEventListener("abort", abortHandler);
		}

		try {
			// Execute via userScripts API
			if (chrome.userScripts && typeof chrome.userScripts.execute === "function") {
				// Configure the fixed world with CSP
				try {
					await chrome.userScripts.configureWorld({
						worldId: FIXED_WORLD_ID,
						messaging: true,
						csp: "script-src 'unsafe-eval' 'unsafe-inline'; connect-src 'none'; img-src 'none'; media-src 'none'; frame-src 'none'; font-src 'none'; object-src 'none'; default-src 'none';",
					});
				} catch (e) {
					console.warn("[BrowserJsRuntimeProvider] Failed to configure userScripts world:", e);
				}

				const injectionConfig: any = {
					js: [{ code: wrapperCode }],
					target: { tabId: tab.id, allFrames: false },
					world: "USER_SCRIPT",
					worldId: FIXED_WORLD_ID,
					injectImmediately: true,
				};

				// Only add executionId if terminate API is available
				if (executionId) {
					injectionConfig.executionId = executionId;
				}

				const results = await chrome.userScripts.execute(injectionConfig);

				const result = results[0]?.result as
					| {
							success: boolean;
							lastValue?: unknown;
							error?: string;
							stack?: string;
					  }
					| undefined;

				// Get console output from the dedicated ConsoleRuntimeProvider for this execution
				const consoleLogs = pageConsoleProvider.getLogs();

				if (!result) {
					respond({
						success: true,
						error: "No result returned from script execution",
						console: consoleLogs,
					});
					return;
				}

				if (!result.success) {
					respond({
						success: false,
						error: result.error,
						stack: result.stack,
						console: consoleLogs,
					});
					return;
				}

				respond({
					success: true,
					result: result.lastValue,
					console: consoleLogs,
				});
			} else {
				// Firefox fallback
				respond({
					success: false,
					error: 'Firefox is currently not supported for browserjs(). Use Chrome 138+ with "Allow User Scripts" enabled.',
				});
			}
		} catch (error: any) {
			console.error("[BrowserJsRuntimeProvider] Error:", error);

			// Check if this was a cancellation
			const wasCancelled = abortSignal?.aborted;

			respond({
				success: false,
				error: wasCancelled ? "Script execution was cancelled" : error.message || String(error),
				cancelled: wasCancelled,
			});
		} finally {
			// Cleanup abort handler
			if (abortSignal && abortHandler) {
				abortSignal.removeEventListener("abort", abortHandler);
			}

			// Cleanup execution tracking
			if (executionId) {
				this.activeExecutions.delete(sandboxId);
			}

			// Cleanup sandbox registration
			this.cleanup(sandboxId);
		}
	}

	getDescription(): string {
		return BROWSERJS_RUNTIME_PROVIDER_DESCRIPTION;
	}

	/**
	 * Cleanup a specific sandbox registration
	 */
	private cleanup(sandboxId: string) {
		if (this.activeSandboxIds.has(sandboxId)) {
			RUNTIME_MESSAGE_ROUTER.unregisterSandbox(sandboxId);
			this.activeSandboxIds.delete(sandboxId);
		}
	}

	/**
	 * Cleanup all active sandboxes (call when provider is destroyed)
	 */
	public cleanupAll() {
		for (const sandboxId of this.activeSandboxIds) {
			RUNTIME_MESSAGE_ROUTER.unregisterSandbox(sandboxId);
		}
		this.activeSandboxIds.clear();
	}
}

/**
 * NavigateRuntimeProvider
 *
 * Provides the navigate() helper to REPL scripts, which wraps the NavigateTool.
 *
 * Usage in REPL:
 *   await navigate({ url: 'https://example.com' });
 *   await navigate({ history: 'back' });
 */
export class NavigateRuntimeProvider implements SandboxRuntimeProvider {
	constructor(private navigateTool: NavigateTool) {}

	getData(): Record<string, any> {
		return {};
	}

	getRuntime(): (sandboxId: string) => void {
		// This function will be stringified and injected into the REPL iframe
		return (_sandboxId: string) => {
			const sendRuntimeMessage = (window as any).sendRuntimeMessage;
			if (typeof sendRuntimeMessage !== "function") {
				throw new Error("sendRuntimeMessage is not available in this context");
			}

			// Inject navigate() helper
			(window as any).navigate = async (args: any): Promise<any> => {
				const response = await sendRuntimeMessage({
					type: "navigate",
					args,
				});

				if (!response.success) {
					throw new Error(response.error || "navigate() execution failed");
				}

				return response.result;
			};
		};
	}

	async handleMessage(message: any, respond: (response: any) => void): Promise<void> {
		if (message.type !== "navigate") {
			return;
		}

		console.log("[NavigateRuntimeProvider] Received message:", message);

		try {
			// Call the navigate tool
			const result = await this.navigateTool.execute(`navigate_${Date.now()}`, message.args as NavigateParams);

			respond({
				success: true,
				result: {
					finalUrl: result.details.finalUrl,
					title: result.details.title,
					skills: result.details.skills,
				},
			});
		} catch (error: any) {
			console.error("[NavigateRuntimeProvider] Error:", error);
			respond({
				success: false,
				error: error.message || String(error),
			});
		}
	}

	getDescription(): string {
		return NAVIGATE_RUNTIME_PROVIDER_DESCRIPTION;
	}
}
