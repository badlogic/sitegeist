import { Button, Input, icon } from "@mariozechner/mini-lit";
import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import { getModel } from "@mariozechner/pi-ai";
import {
	Agent,
	type AgentState,
	ApiKeyPromptDialog,
	ApiKeysTab,
	type AppMessage,
	ChatPanel,
	// PersistentStorageDialog,
	ProviderTransport,
	ProxyTab,
	SettingsDialog,
	setAppStorage,
} from "@mariozechner/pi-web-ui";
import { html, render } from "lit";
import { History, Plus, Settings } from "lucide";
import { SitegeistSessionListDialog } from "./dialogs/SessionListDialog.js";
import { SkillsTab } from "./dialogs/SkillsTab.js";
import { UserScriptsPermissionDialog } from "./dialogs/UserScriptsPermissionDialog.js";
import { browserMessageTransformer } from "./message-transformer.js";
import {
	createNavigationMessage,
	type NavigationMessage,
	registerNavigationRenderer,
} from "./messages/NavigationMessage.js";
import { createWelcomeMessage, registerWelcomeRenderer } from "./messages/WelcomeMessage.js";
import { SYSTEM_PROMPT } from "./prompts/tool-prompts.js";
import { SitegeistAppStorage } from "./storage/app-storage.js";
import { BrowserJavaScriptTool, skillTool } from "./tools/index.js";
import { isToolNavigating, NavigateTool } from "./tools/navigate.js";
import "./utils/i18n-extension.js";
import "./utils/live-reload.js";

// Register custom message renderers
registerNavigationRenderer();

// Cross-browser API compatibility
// @ts-expect-error - browser global exists in Firefox, chrome in Chrome
const browserAPI = globalThis.browser || globalThis.chrome;

// Get sandbox URL for extension CSP restrictions
const getSandboxUrl = () => {
	return browserAPI.runtime.getURL("sandbox.html");
};

const systemPrompt = SYSTEM_PROMPT;

// ============================================================================
// STORAGE SETUP
// ============================================================================
const storage = new SitegeistAppStorage();
setAppStorage(storage);

// ============================================================================
// APP STATE
// ============================================================================
let currentSessionId: string | undefined;
let currentTitle = "";
let isEditingTitle = false;
let agent: Agent;
let chatPanel: ChatPanel;
let agentUnsubscribe: (() => void) | undefined;
let currentWindowId: number | undefined;
let port: chrome.runtime.Port;

// Export port getter for other modules (e.g., SessionListDialog)
export function getPort(): chrome.runtime.Port {
	return port;
}

// ============================================================================
// HELPERS
// ============================================================================

// Global message handler for port responses
const portResponseHandlers = new Map<string, (msg: any) => void>();

function setupPortMessageHandler() {
	port.onMessage.addListener((msg) => {
		// Handle close-yourself command
		if (msg.type === "close-yourself") {
			window.close();
			return;
		}

		// Handle responses for sendPortMessage
		if (msg.type === "lockResult" || msg.type === "lockedSessions") {
			const handler = portResponseHandlers.get(msg.type);
			if (handler) {
				handler(msg);
			}
		}
	});
}

// Send message via port and wait for response
function sendPortMessage<T = any>(message: any, responseType: string): Promise<T> {
	return new Promise((resolve) => {
		portResponseHandlers.set(responseType, (msg: any) => {
			portResponseHandlers.delete(responseType);
			resolve(msg);
		});
		port.postMessage(message);
	});
}

const generateTitle = (messages: AppMessage[]): string => {
	const firstUserMsg = messages.find((m) => m.role === "user");
	if (!firstUserMsg || firstUserMsg.role !== "user") return "";

	let text = "";
	const content = firstUserMsg.content;

	if (typeof content === "string") {
		text = content;
	} else {
		const textBlocks = content.filter((c: any) => c.type === "text");
		text = textBlocks.map((c: any) => c.text || "").join(" ");
	}

	text = text.trim();
	if (!text) return "";

	const sentenceEnd = text.search(/[.!?]/);
	if (sentenceEnd > 0 && sentenceEnd <= 50) {
		return text.substring(0, sentenceEnd + 1);
	}
	return text.length <= 50 ? text : `${text.substring(0, 47)}...`;
};

const shouldSaveSession = (messages: AppMessage[]): boolean => {
	const hasUserMsg = messages.some((m: any) => m.role === "user");
	const hasAssistantMsg = messages.some((m: any) => m.role === "assistant");
	return hasUserMsg && hasAssistantMsg;
};

const saveSession = async () => {
	if (!storage.sessions || !currentSessionId || !agent || !currentTitle) return;

	const state = agent.state;
	if (!shouldSaveSession(state.messages)) return;

	try {
		await storage.sessions.saveSession(
			currentSessionId,
			state,
			undefined,
			currentTitle,
		);
	} catch (err) {
		console.error("Failed to save session:", err);
	}
};

const updateUrl = (sessionId: string) => {
	const url = new URL(window.location.href);
	url.searchParams.set("session", sessionId);
	window.history.replaceState({}, "", url);
};

const createAgent = async (initialState?: Partial<AgentState>, shouldSave = true) => {
	if (agentUnsubscribe) {
		agentUnsubscribe();
	}

	const transport = new ProviderTransport();

	agent = new Agent({
		initialState: initialState || {
			systemPrompt,
			model: getModel("anthropic", "claude-sonnet-4-5-20250929"),
			thinkingLevel: "off",
			messages: [],
			tools: [],
		},
		transport,
		messageTransformer: browserMessageTransformer,
	});

	if (shouldSave) {
		agentUnsubscribe = agent.subscribe((event: any) => {
			if (event.type === "state-update") {
				const messages = event.state.messages;

				// Generate title after first successful response
				if (!currentTitle && shouldSaveSession(messages)) {
					currentTitle = generateTitle(messages);
				}

				// Create session ID on first successful save
				if (!currentSessionId && shouldSaveSession(messages)) {
					currentSessionId = crypto.randomUUID();
					updateUrl(currentSessionId);
				}

				// Auto-save
				if (currentSessionId) {
					saveSession();
				}

				renderApp();
			} else if (event.type === "completed") {
				// Check if last assistant message has empty content - if so, auto-continue
				const messages = agent.state.messages;
				const lastMessage = messages[messages.length - 1];

				// TODO this if cfucked, need to find a better way.
				/*if (lastMessage?.role === "assistant" && Array.isArray(lastMessage.content) && lastMessage.content.length === 0) {
					console.log("Empty assistant response detected - auto-continuing");

					// Remove the empty assistant message
					agent.state.messages.pop();

					// Append a ContinueMessage (invisible to user, converted to "continue" prompt in transformer)
					console.log("Injecting ContinueMessage to prompt LLM to continue");
					agent.appendMessage({
						type: "continue",
						role: "user",
					} as any);

					// Trigger the agent to continue with empty prompt (will use ContinueMessage)
					agent.prompt("");
				}*/
			}
		});
	}

	await chatPanel.setAgent(agent, {
		sandboxUrlProvider: getSandboxUrl,
		onApiKeyRequired: async (provider: string) => {
			return await ApiKeyPromptDialog.prompt(provider);
		},
		onBeforeSend: async () => {
			if (!agent) return;

			// Get current tab info
			const [tab] = await browserAPI.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (
				!tab?.url ||
				tab.url.startsWith("chrome-extension://") ||
				tab.url.startsWith("moz-extension://")
			)
				return;

			// Find most recent navigation message (reverse iteration for compatibility)
			let lastNav: NavigationMessage | undefined;
			for (let i = agent.state.messages.length - 1; i >= 0; i--) {
				if (agent.state.messages[i].role === "navigation") {
					lastNav = agent.state.messages[i] as NavigationMessage;
					break;
				}
			}

			// Only add if URL changed
			if (!lastNav || lastNav.url !== tab.url) {
				const navMessage = createNavigationMessage(
					tab.url,
					tab.title || "Untitled",
					tab.favIconUrl,
					tab.index,
				);
				agent.appendMessage(navMessage);
			}
		},
		toolsFactory: (agent, _agentInterface, artifactsPanel) => {
			const navigateTool = new NavigateTool(agent);
			const browserJavaScriptTool = new BrowserJavaScriptTool(
				artifactsPanel,
				agent,
			);
			return [navigateTool, browserJavaScriptTool, skillTool];
		},
	});

	// Register welcome renderer after agentInterface is available
	if (chatPanel.agentInterface) {
		registerWelcomeRenderer(agent, chatPanel.agentInterface);

		// Only disable auto-scroll for new sessions with welcome message
		// Check if this is a fresh session (only has welcome message, no user messages)
		const hasUserMessage = agent.state.messages.some((m) => m.role === "user");
		if (!hasUserMessage) {
			chatPanel.agentInterface.setAutoScroll(false);

			// Re-enable auto-scroll on first user message
			// biome-ignore lint: Need let for closure to avoid temporal dead zone
			let unsubscribe: (() => void) | undefined;
			unsubscribe = agent.subscribe((event) => {
				if (event.type === "state-update") {
					const hasUserMsg = event.state.messages.some((m) => m.role === "user");
					if (hasUserMsg && unsubscribe) {
						chatPanel.agentInterface?.setAutoScroll(true);
						unsubscribe();
					}
				}
			});
		}
	}
};

const loadSession = (sessionId: string) => {
	// Navigation will disconnect port and auto-release locks
	const url = new URL(window.location.href);
	url.searchParams.set("session", sessionId);
	window.location.href = url.toString();
};

const newSession = () => {
	// Navigation will disconnect port and auto-release locks
	const url = new URL(window.location.href);
	url.search = "?new=true";
	window.location.href = url.toString();
};

// ============================================================================
// RENDER
// ============================================================================
const renderApp = () => {
	const appHtml = html`
		<div class="w-full h-full flex flex-col bg-background text-foreground overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-border shrink-0">
				<div class="flex items-center gap-2 px-3 py-2">
					${Button({
						variant: "ghost",
						size: "sm",
						children: icon(History, "sm"),
						onClick: () => {
							SitegeistSessionListDialog.open(
								(sessionId: string) => {
									loadSession(sessionId);
								},
								(deletedSessionId: string) => {
									// Only reload if the current session was deleted
									if (deletedSessionId === currentSessionId) {
										newSession();
									}
								},
							);
						},
						title: "Sessions",
					})}
					${Button({
						variant: "ghost",
						size: "sm",
						children: icon(Plus, "sm"),
						onClick: newSession,
						title: "New Session",
					})}

					${
						currentTitle
							? isEditingTitle
								? html`<div class="flex items-center gap-2">
									${Input({
										type: "text",
										value: currentTitle,
										className: "text-sm w-48",
										/*
										TODO need to add this in Input in mini-lit
										onBlur: async (e: Event) => {
											const newTitle = (e.target as HTMLInputElement).value.trim();
											if (newTitle && newTitle !== currentTitle && storage.sessions && currentSessionId) {
												await storage.sessions.updateTitle(currentSessionId, newTitle);
												currentTitle = newTitle;
											}
											isEditingTitle = false;
											renderApp();
										},*/
										onKeyDown: async (e: KeyboardEvent) => {
											if (e.key === "Enter") {
												const newTitle = (
													e.target as HTMLInputElement
												).value.trim();
												if (
													newTitle &&
													newTitle !== currentTitle &&
													storage.sessions &&
													currentSessionId
												) {
													await storage.sessions.updateTitle(
														currentSessionId,
														newTitle,
													);
													currentTitle = newTitle;
												}
												isEditingTitle = false;
												renderApp();
											} else if (e.key === "Escape") {
												isEditingTitle = false;
												renderApp();
											}
										},
									})}
								</div>`
								: html`<button
									class="px-2 py-1 text-xs text-foreground hover:bg-secondary rounded transition-colors truncate max-w-[150px]"
									@click=${() => {
										isEditingTitle = true;
										renderApp();
										requestAnimationFrame(() => {
											const input = document.body.querySelector(
												'input[type="text"]',
											) as HTMLInputElement;
											if (input) {
												input.focus();
												input.select();
											}
										});
									}}
									title="Click to edit title"
								>
									${currentTitle}
								</button>`
							: html``
					}
				</div>
				<div class="flex items-center gap-1 px-2">
					<theme-toggle></theme-toggle>
					${Button({
						variant: "ghost",
						size: "sm",
						children: icon(Settings, "sm"),
						onClick: () =>
							SettingsDialog.open([
								new ApiKeysTab(),
								new ProxyTab(),
								new SkillsTab(),
							]),
						title: "Settings",
					})}
				</div>
			</div>

			<!-- Chat Panel -->
			${chatPanel}
		</div>
	`;

	render(appHtml, document.body);
};

// ============================================================================
// TAB NAVIGATION TRACKING
// ============================================================================

// Listen for tab updates and insert navigation messages only when agent is running
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
	// Only care about URL changes on the active tab while agent is working
	// Ignore chrome-extension:// URLs (extension internal pages)
	// Ignore tool-initiated navigations (handled by the navigate tool itself)
	// Ignore tabs from other windows
	if (
		changeInfo.url &&
		tab.active &&
		tab.url &&
		tab.windowId === currentWindowId &&
		agent?.state.isStreaming &&
		!tab.url.startsWith("chrome-extension://") &&
		!tab.url.startsWith("moz-extension://") &&
		!isToolNavigating()
	) {
		const navMessage = createNavigationMessage(
			tab.url,
			tab.title || "Untitled",
			tab.favIconUrl,
			tab.index,
		);
		agent.queueMessage(navMessage);
		console.log("Queued navigation message for tab switch to", tab.url);
	}
});

// Listen for tab activation (user switches tabs) only when agent is running
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	// Ignore tab activations from other windows
	if (activeInfo.windowId !== currentWindowId) return;

	const tab = await chrome.tabs.get(activeInfo.tabId);
	// Ignore chrome-extension:// URLs (extension internal pages)
	// Ignore tool-initiated navigations (handled by the navigate tool itself)
	if (
		tab.url &&
		agent?.state.isStreaming &&
		!tab.url.startsWith("chrome-extension://") &&
		!tab.url.startsWith("moz-extension://") &&
		!isToolNavigating()
	) {
		const navMessage = createNavigationMessage(
			tab.url,
			tab.title || "Untitled",
			tab.favIconUrl,
			tab.index,
		);
		agent.queueMessage(navMessage);
		console.log("Queued navigation message for tab switch to", tab.url);
	}
});

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================
window.addEventListener("keydown", (e) => {
	// Cmd+U (Mac) or Ctrl+U (Windows/Linux) to open debug page
	if ((e.metaKey || e.ctrlKey) && e.key === "u") {
		e.preventDefault();
		window.location.href = "./debug.html";
	}
});

// Note: Lock cleanup handled automatically by port disconnect on close/navigation/crash
// No manual beforeunload handler needed - port.onDisconnect does it all

// ============================================================================
// INIT
// ============================================================================
async function initApp() {
	// Show loading
	render(
		html`
			<div class="w-full h-full flex items-center justify-center bg-background text-foreground">
				<div class="text-muted-foreground">Loading...</div>
			</div>
		`,
		document.body,
	);

	// Get current window ID for filtering tab events
	const currentWindow = await browserAPI.windows.getCurrent();
	currentWindowId = currentWindow.id;

	// Create port connection for lock management
	port = browserAPI.runtime.connect({ name: `sidepanel:${currentWindowId}` });

	// Set up message handler for port
	setupPortMessageHandler();

	// Request persistent storage
	// if (storage.sessions) {
	// 	await PersistentStorageDialog.request();
	// }

	// Request userScripts permission if not available
	// @ts-expect-error - browser global exists in Firefox, chrome in Chrome
	const browserAPIForPermissions = globalThis.browser || globalThis.chrome;
	if (!browserAPIForPermissions.userScripts) {
		await UserScriptsPermissionDialog.request();
	}

	// Initialize default skills
	const { initializeDefaultSkills } = await import("./tools/skill.js");
	await initializeDefaultSkills();

	// Initialize default proxy settings if not set
	const proxyEnabled = await storage.settings.get<boolean>("proxy.enabled");
	if (proxyEnabled === null) {
		await storage.settings.set("proxy.enabled", true);
		await storage.settings.set("proxy.url", "https://corsproxy.io");
	}

	// Create ChatPanel
	chatPanel = new ChatPanel();

	// Check for session in URL
	const urlParams = new URLSearchParams(window.location.search);
	let sessionIdFromUrl = urlParams.get("session");
	const isNewSession = urlParams.get("new") === "true";
	const testStepsParam = urlParams.get("teststeps");
	const testProvider = urlParams.get("provider");
	const testModel = urlParams.get("model");

	// Handle test prompts - create temporary session without saving
	if (testStepsParam) {
		try {
			const testSteps = JSON.parse(decodeURIComponent(testStepsParam)) as string[];

			// Set model if specified
			let initialState: Partial<AgentState> | undefined;
			if (testProvider && testModel) {
				const model = getModel(testProvider as any, testModel);
				if (model) {
					initialState = {
						systemPrompt,
						model,
					};
				}
			}

			await createAgent(initialState, false);
			renderApp();

			// Wait for UI to render
			await new Promise((resolve) => requestAnimationFrame(resolve));

			// Submit prompts sequentially
			for (let i = 0; i < testSteps.length; i++) {
				const step = testSteps[i];
				if (!chatPanel?.agentInterface) break;

				// Send the prompt
				await chatPanel.agentInterface.sendMessage(step);

				// Wait for agent to finish (not streaming anymore)
				if (i < testSteps.length - 1) {
					// Wait for response to complete before sending next step
					await new Promise<void>((resolve) => {
						const checkComplete = () => {
							if (!chatPanel.agent?.state.isStreaming) {
								resolve();
							} else {
								setTimeout(checkComplete, 100);
							}
						};
						checkComplete();
					});
				}
			}
			return;
		} catch (err) {
			console.error("Failed to run test steps:", err);
		}
	}

	// If no session in URL and not explicitly creating new, try to load the most recent session
	if (!sessionIdFromUrl && !isNewSession && storage.sessions) {
		const latestSessionId = await storage.sessions.getLatestSessionId();
		if (latestSessionId) {
			// Try to acquire lock for latest session
			const lockResponse = await sendPortMessage<{ success: boolean }>(
				{
					type: "acquireLock",
					sessionId: latestSessionId,
					windowId: currentWindowId,
				},
				"lockResult",
			);

			if (lockResponse?.success) {
				sessionIdFromUrl = latestSessionId;
				// Update URL to include the latest session
				updateUrl(latestSessionId);
			}
			// If lock fails, fall through to create new session
		}
	}

	if (sessionIdFromUrl && storage.sessions) {
		const sessionData = await storage.sessions.loadSession(sessionIdFromUrl);
		if (sessionData) {
			// Try to acquire lock if we don't already have it (in case user navigated directly via URL)
			const lockResponse = await sendPortMessage<{ success: boolean }>(
				{
					type: "acquireLock",
					sessionId: sessionIdFromUrl,
					windowId: currentWindowId,
				},
				"lockResult",
			);

			if (!lockResponse?.success) {
				// Session is locked in another window - show landing page instead
				await createAgent();
				if (agent) {
					const welcomeMessage = createWelcomeMessage([
						{ label: "What is Sitegeist?", prompt: "I'm not technical - walk me through what you can do step by step. Show me use cases like web scraping, automation, research, etc. by actually demonstrating them. Explain everything in detail as you go, and let's work together - you show something, explain it, then let me try. Don't be afraid to try creative things! But start with the basics." },
						{ label: "Analyze YouTube Video", prompt: "Find the newest Veritasium video and summarize its beats. Give me timestamps for each beat. Then give me an executive summary for the whole video. Then collect the titles, links, likes and views of their last 20 videos and create a graph for liks and views." },
						{ label: "Compare Prices", prompt: "Create skills for shop.billa.at and spar.at to search for products. Follow the skills workflow - break it down into small steps we test together: 1) Find search input field, add text, confirm with me the text is there. 2) Try submitting (enter key or button click), ask me if it worked. 3) Extract product name/packaging/price from results. 4) Page through results using UI. Iterate based on my feedback. Once each skill works, save it. Then use both skills to search for Mikado Schokolade and create an artifact comparing prices across both stores." },
						{ label: "Research Profile", prompt: "Research Mario Zechner - all I know is that he does stuff with computers. Search Google to find his social media, academic history, professional work history, personal interests, passions, family life, birth date, contact details, location, news articles, and whatever else you can think of. Whatever page you find, read it in full. Add links so I can check sources. Create a profile artifact with what would work in a cold email and what to avoid. I need a personal hook, something he'll react to, not corporate slop." },
					]);
					agent.appendMessage(welcomeMessage);
				}
				renderApp();
				return;
			}

			currentSessionId = sessionIdFromUrl;
			const metadata = await storage.sessions.getMetadata(sessionIdFromUrl);
			currentTitle = metadata?.title || "";

			await createAgent({
				systemPrompt,
				model: sessionData.model,
				thinkingLevel: sessionData.thinkingLevel,
				messages: sessionData.messages,
				tools: [],
			});

			renderApp();
			return;
		} else {
			// Session doesn't exist, redirect to new session
			newSession();
			return;
		}
	}

	// No session - create new agent with welcome message
	await createAgent();

	// Add welcome message for new sessions
	if (agent) {
		const welcomeMessage = createWelcomeMessage([
			{ label: "What is Sitegeist?", prompt: "I'm not technical - walk me through what you can do step by step. Show me use cases like web scraping, automation, research, etc. by actually demonstrating them. Explain everything in detail as you go, and let's work together - you show something, explain it, then let me try. Don't be afraid to try creative things! But start with the basics." },
			{ label: "Analyze YouTube Video", prompt: "Find the newest Veritasium video and summarize its beats. Give me timestamps for each beat. Then give me an executive summary for the whole video. Then collect the titles, links, likes and views of their last 20 videos and create a graph for liks and views." },
			{ label: "Compare Prices", prompt: "Create skills for shop.billa.at and spar.at to search for products. Follow the skills workflow - break it down into small steps we test together: 1) Find search input field, add text, confirm with me the text is there. 2) Try submitting (enter key or button click), ask me if it worked. 3) Extract product name/packaging/price from results. 4) Page through results using UI. Iterate based on my feedback. Once each skill works, save it. Then use both skills to search for Mikado Schokolade and create an artifact comparing prices across both stores." },
			{ label: "Research Profile", prompt: "Research Mario Zechner - all I know is that he does stuff with computers. Search Google to find his social media, academic history, professional work history, personal interests, passions, family life, birth date, contact details, location, news articles, and whatever else you can think of. Whatever page you find, read it in full. Add links so I can check sources. Create a profile artifact with what would work in a cold email and what to avoid. I need a personal hook, something he'll react to, not corporate slop." },
		]);
		agent.appendMessage(welcomeMessage);
	}

	renderApp();
}

initApp();
