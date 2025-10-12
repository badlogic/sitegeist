import { Button, Input, icon } from "@mariozechner/mini-lit";
import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import { type AgentTool, getModel } from "@mariozechner/pi-ai";
import * as port from "./port.js";
import {
	Agent,
	type AgentState,
	ApiKeyPromptDialog,
	ApiKeysTab,
	type AppMessage,
	ChatPanel,
	createExtractDocumentTool,
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
import { registerUserMessageRenderer } from "./messages/UserMessageRenderer.js";
import {
	createWelcomeMessage,
	registerWelcomeRenderer,
} from "./messages/WelcomeMessage.js";
import { SYSTEM_PROMPT } from "./prompts/tool-prompts.js";
import { SitegeistAppStorage } from "./storage/app-storage.js";
import { BrowserJavaScriptTool, skillTool } from "./tools/index.js";
import { isToolNavigating, NavigateTool } from "./tools/navigate.js";
import { DebuggerTool } from "./tools/debugger.js";
import "./utils/i18n-extension.js";
import "./utils/live-reload.js";

const welcomeMessages = [
	{
		label: "What is Sitegeist?",
		prompt: `You are about to help a non-technical user understand Sitegeist through an interactive tutorial. Guide them step-by-step through Sitegeist's capabilities.

**CRITICAL RULES:**
- Keep explanations SHORT (2-3 sentences max)
- After EACH step, STOP and wait for them to say continue
- When clicking or typing, ALWAYS scroll element into view first
- Never move to next step until they confirm

**START:** First tell them to drag this panel wider by its left edge to see outputs better. STOP and wait for them to confirm.

**PHASE 1: Browse & Extract**
Step 1: Navigate to google.com, explain what happened. STOP.
Step 2: Type "chocolate chip cookie recipe" in search box, tell them what happened, ask if they see it. STOP.
Step 3: Click search button, explain. STOP.
Step 4: Extract top results using your google search skill (don't explain skills yet), show them the results. STOP.

Then ask if they're ready for Phase 2. STOP.

**PHASE 2: Multi-Step Automation**
Step 1: Explain that recipe sites are awful (ads everywhere) and manually compiling recipes is tedious. I can navigate multiple sites, collect info, and output clean documents (markdown, PDF, Word, HTML). You'll demonstrate by collecting 2 recipes from top results. STOP.
Step 2: Wait for their go-ahead, then visit 2 recipe sites, extract data from each, create a markdown artifact with both recipes formatted nicely. Explain each step as you go. STOP.

Then ask if they're ready for Phase 3. STOP.

**PHASE 3: Output Formats**
Step 1: Explain that now you have the recipe data, you can output in any format they want. STOP.
Step 2: Create artifacts in this order, explaining each after creation:
- Markdown (already done)
- PDF version (STOP after creating)
- Word document version (STOP after creating)
- Interactive HTML with ingredient calculator for each recipe (they can input how many cookies they want, ingredients scale automatically) (STOP after creating)
Step 3: After all artifacts, explain that markdown/HTML are best for iterative work since you can update them fastest (unlike PDF/Word which must be regenerated). STOP.

Then ask if they're ready for Phase 4. STOP.

**PHASE 4: Skills**
Step 1: Explain that doing everything ad-hoc works but is slow. Better to teach you about a site collaboratively, then save that knowledge as a "skill". Next time that site is visited, you instantly know how to interact with it. (Give relatable example like: "Instead of figuring out Amazon's search every time, a skill remembers it"). STOP.
Step 2: Demo an existing skill - the YouTube skill. Search for latest Veritasium video, get transcript using YouTube skill, create markdown with video beats (each beat: title, start/end timestamp, summary). STOP.

Then ask if they're ready for Phase 5. STOP.

**PHASE 5: Sky's the Limit**
Explain that this is just scratching the surface. I can:
- Research topics/companies/people and compile living dossiers
- Automate form filling across multiple sites
- Monitor prices and track changes over time
- Extract data from dozens of pages automatically
- Combine data from multiple sources into custom reports

STOP.

**File Attachments:**
Explain: "I currently can't see images on web pages, but you can attach files to our chat that I can read and work with. This is useful for showing me what you see on a page - just take a screenshot and attach it!"

List what you can work with:
- **Images/Screenshots**: See what's on your screen, extract text (OCR), describe content, guide interactions
- **PDFs, Word, Excel**: Read, extract data, cross-reference with web data
- **Code files**: Analyze any text-based files

Tell them: "Use the attachment button in the chat input to attach files."

STOP.

**Interface Overview:**
Explain the UI elements:

**Header (top, left to right):**
- Session history icon → Find and resume old chat sessions
- New session icon → Start fresh
- Session title field → Click to rename the current session
- Theme toggle → Switch between system/light/dark theme
- Settings icon → Configure API keys, skills, proxy settings

**Message Editor (bottom):**
- Attachment icon → Attach files to chat
- Thinking settings (if model supports it) → Off/minimal/low/medium/high. When on, I think before acting, which improves results but takes longer and costs more
- Model selector → Pick different AI models. If you have Ollama running locally (https://ollama.com), you can select from your local models, so everything is truly local
- Submit/Stop button → Send message or stop me (can also press ESCAPE key while focused on message editor)

STOP.

**Data Privacy:**
Explain where data is stored and who gets what:
- **Settings & API keys**: Stored locally on your computer only
- **Sessions & attachments**: Stored locally on your computer only
- **When you send messages**: All text and attachments in the chat session are sent to the LLM provider (default: Anthropic). They're configured to not retain your data or use it for training
- **CORS proxy** (off by default): If enabled in settings, requests to the LLM go through the proxy. Default is corsproxy.io which does not retain or log data

STOP.

Ask what they'd like to try or explore next.`,
	},
	{
		label: "Research Profile",
		prompt:
			"Research Mario Zechner - all I know is that he does stuff with computers. Search Google to find his social media, academic history, professional work history, personal interests, passions, family life, birth date, contact details, location, news articles, and whatever else you can think of. Whatever page you find, read it in full. Add links so I can check sources. Create a profile artifact with what would work in a cold email and what to avoid. I need a personal hook, something he'll react to, not corporate slop.",
	},
	{
		label: "Analyze YouTube Video",
		prompt:
			"Find the newest Veritasium video. Identify beats and their start and end timestamp, and summarize each beat. Then give me an executive summary for the whole video. Finally, ask me if i want to jump to a specific beat or if I want an explanation what's currently being said in the video.",
	},
	{
		label: "Compare Prices",
		prompt:
			"Create skills for shop.billa.at and spar.at to search for products. Follow the skills workflow - break it down into small steps we test together: 1) Find search input field, add text, and confirm with me the text is there. Use 'Schokolade' as the search term, so we get many results later when we try to figure out paging. 2) Try submitting (enter key or button click), and ask me if it worked. 3) Extract product name/image URL/packaging/price from results. 4) Page through results using UI. Iterate based on my feedback. Once each skill works, save it. Then use both skills to search for Mikado and create an artifact comparing prices across both stores.",
	},
];

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
let currentWindowId: number;

// Debug function to dump session metadata
(window as any).dumpSessionMetadata = async () => {
	const metadata = await storage.sessions.getAllMetadata();
	console.log("=== SESSION METADATA ===");
	console.log("Total sessions:", metadata.length);
	console.table(
		metadata.map((m) => ({
			id: m.id,
			title: m.title,
			lastModified: m.lastModified,
			createdAt: m.createdAt,
			messageCount: m.messageCount,
			totalCost: m.usage.cost.total,
		})),
	);
	return metadata;
};

// One-time migration: recalculate usage for all sessions
(window as any).migrateSessionUsage = async () => {
	const metadata = await storage.sessions.getAllMetadata();
	console.log(`Migrating ${metadata.length} sessions...`);

	let migrated = 0;
	for (const meta of metadata) {
		try {
			const session = await storage.sessions.get(meta.id);
			if (!session) continue;

			// Recalculate usage
			const usage = {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			};

			for (const msg of session.messages) {
				if (msg.role === "assistant" && "usage" in msg && msg.usage) {
					usage.input += msg.usage.input || 0;
					usage.output += msg.usage.output || 0;
					usage.cacheRead += msg.usage.cacheRead || 0;
					usage.cacheWrite += msg.usage.cacheWrite || 0;
					if (msg.usage.cost) {
						usage.cost.input += msg.usage.cost.input || 0;
						usage.cost.output += msg.usage.cost.output || 0;
						usage.cost.cacheRead += msg.usage.cost.cacheRead || 0;
						usage.cost.cacheWrite += msg.usage.cost.cacheWrite || 0;
						usage.cost.total += msg.usage.cost.total || 0;
					}
				}
			}

			// Generate preview
			let preview = "";
			for (const msg of session.messages) {
				if (preview.length >= 2048) break;
				if (msg.role === "user") {
					const text =
						typeof msg.content === "string"
							? msg.content
							: (msg.content.find((c: any) => c.type === "text") as any)?.text || "";
					preview += text + "\n";
				} else if (msg.role === "assistant" && "content" in msg) {
					const text = (msg.content.find((c: any) => c.type === "text") as any)?.text || "";
					preview += text + "\n";
				}
			}
			preview = preview.substring(0, 2048);

			const updatedMetadata = {
				...meta,
				usage,
				preview,
			};

			await storage.sessions.saveSession(session.id, session, updatedMetadata, session.title);
			migrated++;
		} catch (err) {
			console.error(`Failed to migrate session ${meta.id}:`, err);
		}
	}

	console.log(`✅ Migrated ${migrated}/${metadata.length} sessions`);
};

// ============================================================================
// HELPERS
// ============================================================================

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
		// Calculate cumulative usage from all assistant messages
		const usage = {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		};

		for (const msg of state.messages) {
			if (msg.role === "assistant" && "usage" in msg && msg.usage) {
				usage.input += msg.usage.input || 0;
				usage.output += msg.usage.output || 0;
				usage.cacheRead += msg.usage.cacheRead || 0;
				usage.cacheWrite += msg.usage.cacheWrite || 0;
				if (msg.usage.cost) {
					usage.cost.input += msg.usage.cost.input || 0;
					usage.cost.output += msg.usage.cost.output || 0;
					usage.cost.cacheRead += msg.usage.cost.cacheRead || 0;
					usage.cost.cacheWrite += msg.usage.cost.cacheWrite || 0;
					usage.cost.total += msg.usage.cost.total || 0;
				}
			}
		}

		// Generate preview text (first 2KB of user + assistant text)
		let preview = "";
		for (const msg of state.messages) {
			if (preview.length >= 2048) break;
			if (msg.role === "user") {
				const text =
					typeof msg.content === "string"
						? msg.content
						: (msg.content.find((c: any) => c.type === "text") as any)?.text || "";
				preview += text + "\n";
			} else if (msg.role === "assistant" && "content" in msg) {
				const text = (msg.content.find((c: any) => c.type === "text") as any)?.text || "";
				preview += text + "\n";
			}
		}
		preview = preview.substring(0, 2048);

		// Preserve createdAt if session already exists
		const existingMetadata = await storage.sessions.getMetadata(currentSessionId);
		const createdAt = existingMetadata?.createdAt || new Date().toISOString();

		const metadata = {
			id: currentSessionId,
			title: currentTitle,
			createdAt,
			lastModified: new Date().toISOString(),
			messageCount: state.messages.length,
			usage,
			modelId: state.model.id,
			thinkingLevel: state.thinkingLevel,
			preview,
		};

		await storage.sessions.saveSession(
			currentSessionId,
			state,
			metadata,
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

const createAgent = async (
	initialState?: Partial<AgentState>,
	shouldSave = true,
) => {
	if (agentUnsubscribe) {
		agentUnsubscribe();
	}

	// Load debugger mode setting
	const stored = await browserAPI.storage.local.get("debuggerMode");
	const debuggerModeEnabled = stored.debuggerMode || false;

	// Load CORS proxy settings for extract_document tool
	const corsProxyEnabled = await storage.settings.get<boolean>("proxy.enabled");
	const corsProxyUrl = await storage.settings.get<string>("proxy.url");

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

					// Acquire lock for newly created session
					port.sendMessage(
						{
							type: "acquireLock",
							sessionId: currentSessionId,
							windowId: currentWindowId,
						},
						"lockResult",
					).then((lockResponse: any) => {
						if (!lockResponse.success) {
							console.warn(
								"Failed to acquire lock for newly created session",
								currentSessionId,
							);
						}
					});
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

			// Create extract_document tool with CORS proxy from settings (loaded above)
			const extractDocumentTool = createExtractDocumentTool();
			if (corsProxyEnabled && corsProxyUrl) {
				extractDocumentTool.corsProxyUrl = `${corsProxyUrl}/?`;
			}

			const tools: AgentTool<any, any>[] = [navigateTool, browserJavaScriptTool, skillTool, extractDocumentTool];

			// Conditionally add debugger tool if enabled
			if (debuggerModeEnabled) {
				const debuggerTool = new DebuggerTool(agent);
				tools.push(debuggerTool);
			}

			return tools;
		},
	});

	// Register custom message renderers after agentInterface is available
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
					const hasUserMsg = event.state.messages.some(
						(m) => m.role === "user",
					);
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
								new SkillsTab(),
								new ApiKeysTab(),
								new ProxyTab(),
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
	if (!currentWindow.id) {
		throw new Error("Failed to get current window ID");
	}
	currentWindowId = currentWindow.id;

	// Initialize port communication system
	port.initialize(currentWindowId);

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
			const testSteps = JSON.parse(
				decodeURIComponent(testStepsParam),
			) as string[];

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
			const lockResponse = await port.sendMessage(
				{
					type: "acquireLock",
					sessionId: latestSessionId,
					windowId: currentWindowId,
				},
				"lockResult",
			);

			if (lockResponse.success) {
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
			const lockResponse = await port.sendMessage(
				{
					type: "acquireLock",
					sessionId: sessionIdFromUrl,
					windowId: currentWindowId,
				},
				"lockResult",
			);

			if (!lockResponse.success) {
				// Session is locked in another window - show landing page instead
				await createAgent();
				if (agent) {
					const welcomeMessage = createWelcomeMessage(welcomeMessages);
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
		const welcomeMessage = createWelcomeMessage(welcomeMessages);
		agent.appendMessage(welcomeMessage);
	}

	renderApp();
}

// Register custom user message renderer early, before any session loads
registerUserMessageRenderer();

initApp();
