import type { SandboxRuntimeProvider } from "@mariozechner/pi-web-ui";
import { RUNTIME_MESSAGE_ROUTER, RuntimeMessageBridge } from "@mariozechner/pi-web-ui";

export interface UserScriptsCheckResult {
	available: boolean;
	message?: string;
	shouldRetry?: boolean;
}

/**
 * Check and request userScripts permission.
 * Must be called from a user gesture (e.g., button click) in Firefox.
 * IMPORTANT: In Firefox, browser.permissions.request() must be called synchronously
 * (without any await before it) to preserve the user gesture context.
 */
export async function requestUserScriptsPermission(): Promise<{
	granted: boolean;
	message?: string;
}> {
	const chromeVersion = Number(navigator.userAgent.match(/(Chrome|Chromium)\/([0-9]+)/)?.[2]);
	const isChrome = chromeVersion > 0;
	const isFirefox = !isChrome;

	// Check if API is already available
	if (chrome.userScripts) {
		return { granted: true };
	}

	// Firefox: Request userScripts permission
	if (isFirefox && chrome.permissions) {
		try {
			// CRITICAL: Call request() synchronously (no await before it) to preserve user gesture context!
			// Any async operation before this call will break the user gesture chain.
			const grantedPromise = chrome.permissions.request({
				permissions: ["userScripts"],
			});

			// Now we can await the promise result
			const granted = await grantedPromise;
			if (granted) {
				return {
					granted: true,
					message: "Permission granted. If the tool still doesn't work, please reload the extension.",
				};
			} else {
				return {
					granted: false,
					message:
						"userScripts permission denied. The browserjs() runtime requires this permission to execute code safely.",
				};
			}
		} catch (error) {
			console.error("Failed to request userScripts permission:", error);
			return {
				granted: false,
				message: `Failed to request permission: ${error}`,
			};
		}
	}

	// Chrome: userScripts not available
	if (isChrome) {
		if (chromeVersion >= 138) {
			return {
				granted: false,
				message: `Chrome ${chromeVersion} detected. To enable User Scripts:\n\n1. Go to chrome://extensions/\n2. Find this extension and click 'Details'\n3. Enable the 'Allow User Scripts' toggle\n4. Refresh the page and try again`,
			};
		} else if (chromeVersion >= 120) {
			return {
				granted: false,
				message: `Chrome ${chromeVersion} detected. The userScripts API requires Chrome 120+ with experimental features enabled.`,
			};
		} else {
			return {
				granted: false,
				message: `Chrome ${chromeVersion} detected. The userScripts API requires Chrome 120 or higher. Please update Chrome.`,
			};
		}
	}

	return {
		granted: false,
		message: "userScripts API not available in this browser.",
	};
}

/**
 * Check if userScripts API is available, and provide helpful error messages if not.
 * For Firefox, attempts to request the permission if not granted.
 */
export async function checkUserScriptsAvailability(): Promise<UserScriptsCheckResult> {
	if (chrome.userScripts) {
		return { available: true };
	}

	const chromeVersion = Number(navigator.userAgent.match(/(Chrome|Chromium)\/([0-9]+)/)?.[2]);

	let errorMessage = "Error: browser.userScripts API is not available.\n\n";

	if (chromeVersion >= 138) {
		errorMessage += `Chrome ${chromeVersion} detected. To enable User Scripts:\n\n`;
		errorMessage += "1. Go to chrome://extensions/\n";
		errorMessage += "2. Find this extension and click 'Details'\n";
		errorMessage += "3. Enable the 'Allow User Scripts' toggle\n";
		errorMessage += "4. Refresh the page and try again";
	} else if (chromeVersion >= 120) {
		errorMessage += `Chrome ${chromeVersion} detected. To enable User Scripts:\n\n`;
		errorMessage += "1. Go to chrome://extensions/\n";
		errorMessage += "2. Enable 'Developer mode' toggle in the top right\n";
		errorMessage += "3. Refresh the page and try again";
	} else {
		errorMessage += `Chrome ${chromeVersion} detected, but User Scripts requires Chrome 120+.\n`;
		errorMessage += "Please update Chrome or use a different browser.";
	}

	return {
		available: false,
		message: errorMessage,
	};
}

/**
 * Validates browser JavaScript code for navigation commands.
 * Navigation should use the navigate tool instead.
 */
export function validateBrowserJavaScript(code: string): {
	valid: boolean;
	error?: string;
} {
	// Check if code contains navigation patterns
	const patterns = [
		/\bwindow\.location\s*=\s*["'`]/,
		/\blocation\.href\s*=\s*["'`]/,
		/\bdocument\.location\s*=\s*["'`]/,
		/\bwindow\.location\.href\s*=\s*["'`]/,
		/\blocation\.assign\s*\(/,
		/\blocation\.replace\s*\(/,
		/\bwindow\.location\.assign\s*\(/,
		/\bwindow\.location\.replace\s*\(/,
		/\bhistory\.back\s*\(/,
		/\bhistory\.forward\s*\(/,
		/\bhistory\.go\s*\(/,
	];

	for (const pattern of patterns) {
		if (pattern.test(code)) {
			return {
				valid: false,
				error: "Use navigate tool instead. Navigation in code breaks execution context.",
			};
		}
	}

	return { valid: true };
}

// Wrapper function that executes user code - will be converted to string with .toString()
// Will be wrapped as IIFE to avoid top-level await (not supported in userScripts context)
async function wrapperIIFE() {
	let timeoutId: number;

	// Injection marker (survives .toString())
	("__INJECT_PROVIDERS_HERE__");

	// Inject cancellation flag for cooperative cancellation
	// @ts-expect-error
	window.__sitegeist_cancelled = false;

	// Save original Promise constructor before wrapping
	// @ts-expect-error
	const OriginalPromise = window.Promise;

	// Wrap Promise constructor to inject cancellation checks into all async operations
	// This makes ANY await statement a potential cancellation point
	// @ts-expect-error
	window.Promise = (executor) =>
		new OriginalPromise((resolve, reject) => {
			// Check cancellation before starting the executor
			// @ts-expect-error
			if (window.__sitegeist_cancelled) {
				reject(new Error("Script execution was cancelled"));
				return;
			}

			// Wrap resolve to check cancellation before resolving
			const wrappedResolve = (value: any) => {
				// @ts-expect-error
				if (window.__sitegeist_cancelled) {
					reject(new Error("Script execution was cancelled"));
				} else {
					resolve(value);
				}
			};

			// Wrap reject to pass through
			const wrappedReject = (reason: any) => {
				reject(reason);
			};

			try {
				executor(wrappedResolve, wrappedReject);
			} catch (e) {
				reject(e);
			}
		});

	// Copy static methods from original Promise
	// @ts-expect-error
	window.Promise.resolve = OriginalPromise.resolve.bind(OriginalPromise);
	// @ts-expect-error
	window.Promise.reject = OriginalPromise.reject.bind(OriginalPromise);
	// @ts-expect-error
	window.Promise.all = OriginalPromise.all.bind(OriginalPromise);
	// @ts-expect-error
	window.Promise.race = OriginalPromise.race.bind(OriginalPromise);
	// @ts-expect-error
	window.Promise.allSettled = OriginalPromise.allSettled.bind(OriginalPromise);
	// @ts-expect-error
	window.Promise.any = OriginalPromise.any.bind(OriginalPromise);

	// Inject yield helper for explicit cancellation points (still useful for tight loops)
	// @ts-expect-error
	window.__sitegeist_yield = () => {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				// @ts-expect-error
				if (window.__sitegeist_cancelled) {
					reject(new Error("Script execution was cancelled"));
				} else {
					resolve();
				}
			}, 0);
		});
	};

	const cleanup = () => {
		if (timeoutId) clearTimeout(timeoutId);
		// @ts-expect-error
		delete window.__sitegeist_yield;
		// @ts-expect-error
		delete window.__sitegeist_cancelled;
		// Restore original Promise constructor
		// @ts-expect-error
		window.Promise = OriginalPromise;
		// Runtime provider cleanup will be handled automatically
	};

	// Execute the user code directly (no setTimeout wrapper)
	// The Promise returned here will keep the execution tracked in Chromium's map
	// until it resolves, allowing terminate() to work properly
	return (async () => {
		try {
			// Set execution timeout (30 seconds)
			const timeoutPromise = new Promise((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(new Error("Execution timeout: Code did not complete within 30 seconds"));
				}, 30000) as unknown as number;
			});

			// Execute user code and capture the last expression value
			// USER_CODE_PLACEHOLDER will be replaced with the actual async function containing user code
			// @ts-expect-error
			const userCodeFunc = USER_CODE_PLACEHOLDER;
			const codePromise = userCodeFunc();

			// Race between execution and timeout
			const lastValue = await Promise.race([codePromise, timeoutPromise]);

			// Call completion callbacks before returning (success path)
			if (
				// @ts-expect-error
				window.__completionCallbacks &&
				// @ts-expect-error
				window.__completionCallbacks.length > 0
			) {
				try {
					await Promise.race([
						// @ts-expect-error
						Promise.all(window.__completionCallbacks.map((cb) => cb(true))),
						new Promise((_, reject) => setTimeout(() => reject(new Error("Completion timeout")), 5000)),
					]);
				} catch (e) {
					console.error("Completion callback error:", e);
				}
			}

			cleanup();
			return {
				success: true,
				lastValue: lastValue,
			};
		} catch (error: any) {
			// Call completion callbacks before returning (error path)
			if (
				// @ts-expect-error
				window.__completionCallbacks &&
				// @ts-expect-error
				window.__completionCallbacks.length > 0
			) {
				try {
					await Promise.race([
						// @ts-expect-error
						Promise.all(window.__completionCallbacks.map((cb) => cb(false))),
						new Promise((_, reject) => setTimeout(() => reject(new Error("Completion timeout")), 5000)),
					]);
				} catch (e) {
					console.error("Completion callback error:", e);
				}
			}

			cleanup();
			return {
				success: false,
				error: error.message,
				stack: error.stack,
			};
		}
	})();
}

/**
 * Build the wrapper code by combining safeguards, skill library, providers, and user code
 */
export function buildWrapperCode(
	userCode: string,
	skillLibrary: string,
	_enableSafeguards: boolean,
	providers: SandboxRuntimeProvider[],
	sandboxId: string,
	args?: any[],
): string {
	// Start with wrapper function (will be made into IIFE below)
	let code = wrapperIIFE.toString();

	// Inject safeguards at the beginning if enabled (not implemented yet)
	// if (enableSafeguards) { ... }

	// Build provider injections (bridge + data + runtimes)
	const bridgeCode = RuntimeMessageBridge.generateBridgeCode({
		context: "user-script",
		sandboxId: sandboxId,
	});

	let providerInjections = `${bridgeCode}\n`;

	// Register sandbox with RUNTIME_MESSAGE_ROUTER
	RUNTIME_MESSAGE_ROUTER.registerSandbox(sandboxId, providers, []);

	// Inject data from providers (e.g., window.artifacts = {...})
	for (const provider of providers) {
		const data = provider.getData();
		for (const [key, value] of Object.entries(data)) {
			providerInjections += `window.${key} = ${JSON.stringify(value)};\n`;
		}
	}

	// Inject runtime functions from providers
	for (const provider of providers) {
		const runtimeFunc = provider.getRuntime();
		providerInjections += `(${runtimeFunc.toString()})(${JSON.stringify(sandboxId)});\n`;
	}

	// Inject skills AFTER providers
	if (skillLibrary) {
		providerInjections += `\n// Skills auto-injected for domain\n${skillLibrary}\n`;
	}

	// Inject everything at the marker (providers + skills)
	// Replace the string literal marker with our injections
	code = code.replace(/"__INJECT_PROVIDERS_HERE__";/, providerInjections);

	// If args are provided, inject them before user code
	if (args && args.length > 0) {
		// Wrap user code with argument injection
		const argsCode = `const __args__ = ${JSON.stringify(args)};\n`;
		const wrappedUserCode = `${argsCode}const __func__ = ${userCode};\nreturn __func__(...__args__);`;
		code = code.replace(/USER_CODE_PLACEHOLDER/, `async () => { ${wrappedUserCode} }`);
	} else {
		// No args - just wrap user code
		code = code.replace(/USER_CODE_PLACEHOLDER/, userCode);
	}

	// CRITICAL: Wrap as IIFE (Immediately Invoked Function Expression)
	// Pattern: (async function() {...})() - returns Promise that chrome.userScripts.execute() waits for
	// NO top-level await needed - userScripts context doesn't support it
	return `(${code})()`;
}
