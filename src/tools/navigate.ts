import { html, i18n, icon } from "@mariozechner/mini-lit";
import type { AgentTool, ToolResultMessage } from "@mariozechner/pi-ai";
import { StringEnum } from "@mariozechner/pi-ai";
import { registerToolRenderer, type ToolRenderer, type ToolRenderResult } from "@mariozechner/pi-web-ui";
import { type Static, Type } from "@sinclair/typebox";
import { Loader2 } from "lucide";
import { SkillPill } from "../components/SkillPill.js";
import { TabPill } from "../components/TabPill.js";
import { NAVIGATE_TOOL_DESCRIPTION } from "../prompts/prompts.js";
import { getSitegeistStorage } from "../storage/app-storage.js";
import type { Skill } from "../storage/stores/skills-store.js";
import "../utils/i18n-extension.js";

// Track tool-initiated navigations to filter out duplicate navigation messages
let isNavigating = false;

export function isToolNavigating(): boolean {
	return isNavigating;
}

function markNavigationStart() {
	isNavigating = true;
}

function markNavigationEnd() {
	isNavigating = false;
}

// ============================================================================
// TYPES
// ============================================================================

const navigateSchema = Type.Object({
	url: Type.Optional(Type.String({ description: "URL to navigate to (in current tab or new tab if newTab is true)" })),
	newTab: Type.Optional(Type.Boolean({ description: "Set to true to open URL in a new tab instead of current tab" })),
	history: Type.Optional(
		StringEnum(["back", "forward"], {
			description: "Navigate browser history (back or forward)",
		}),
	),
	listTabs: Type.Optional(Type.Boolean({ description: "Set to true to list all open tabs" })),
	switchToTab: Type.Optional(Type.Number({ description: "Tab ID to switch to (get IDs from listTabs)" })),
});

export type NavigateParams = Static<typeof navigateSchema>;

export interface TabInfo {
	id: number;
	url: string;
	title: string;
	active: boolean;
	favicon?: string;
}

export interface NavigateResult {
	finalUrl?: string;
	title?: string;
	favicon?: string;
	tabId?: number;
	skills?: Array<{ name: string; shortDescription: string }>;
	tabs?: TabInfo[];
	switchedToTab?: number;
}

// ============================================================================
// TOOL
// ============================================================================

export class NavigateTool implements AgentTool<typeof navigateSchema, NavigateResult> {
	label = "Navigate";
	name = "navigate";
	description = NAVIGATE_TOOL_DESCRIPTION;
	parameters = navigateSchema;

	async execute(
		_toolCallId: string,
		args: NavigateParams,
		signal?: AbortSignal,
	): Promise<{ output: string; details: NavigateResult }> {
		if (signal?.aborted) {
			throw new Error("Navigation aborted");
		}

		// Handle list tabs action
		if ("listTabs" in args) {
			return this.listTabs();
		}

		// Handle switch tab action
		if ("switchToTab" in args && args.switchToTab !== undefined) {
			markNavigationStart();
			try {
				return await this.switchToTab(args.switchToTab);
			} finally {
				markNavigationEnd();
			}
		}

		// Get active tab for navigation actions
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});

		if (!tab || !tab.id) {
			throw new Error("No active tab found");
		}

		let finalUrl: string;
		let targetTabId = tab.id;

		markNavigationStart();
		try {
			if ("url" in args && args.url !== undefined) {
				// Check if opening in new tab
				if ("newTab" in args && args.newTab) {
					finalUrl = await this.openInNewTab(args.url, signal);
					// Get the newly created tab
					const tabs = await chrome.tabs.query({});
					const newTab = tabs.find((t: chrome.tabs.Tab) => t.url === finalUrl);
					if (newTab?.id) {
						targetTabId = newTab.id;
					}
				} else {
					// Navigate to URL in current tab
					finalUrl = await this.navigateToUrl(tab.id, args.url, signal);
				}
			} else if ("history" in args && args.history !== undefined) {
				// Navigate history
				finalUrl = await this.navigateHistory(tab.id, args.history as "back" | "forward", signal);
			} else {
				throw new Error("Invalid navigation parameters");
			}
		} finally {
			markNavigationEnd();
		}

		// Get updated tab info using query (better cross-browser support)
		const updatedTabs = await chrome.tabs.query({});
		const updatedTab = updatedTabs.find((t: chrome.tabs.Tab) => t.id === targetTabId);
		const title = updatedTab?.title || "Untitled";
		const favicon = updatedTab?.favIconUrl;

		// Get skills for the final URL
		const skillsRepo = getSitegeistStorage().skills;
		const matchingSkills = await skillsRepo.getSkillsForUrl(finalUrl);
		const skills = matchingSkills.map((s) => ({
			name: s.name,
			shortDescription: s.shortDescription,
		}));

		const details: NavigateResult = {
			finalUrl,
			title,
			favicon,
			tabId: targetTabId,
			skills,
		};

		// Build output message
		let output = "";
		if ("newTab" in args && args.newTab) {
			output = `Opened in new tab: ${finalUrl} (tab ${targetTabId})\n`;
		} else {
			output = `Navigated to: ${finalUrl} (tab ${targetTabId})\n`;
		}

		if (skills.length > 0) {
			output += "Available skills:\n";
			for (const skill of skills) {
				output += `  - ${skill.name}: ${skill.shortDescription}\n`;
			}
		} else {
			output += "No skills found for domain";
		}

		return { output, details };
	}

	private async navigateToUrl(tabId: number, url: string, signal?: AbortSignal): Promise<string> {
		return new Promise((resolve, reject) => {
			if (signal?.aborted) {
				reject(new Error("Aborted"));
				return;
			}

			// Set up DOMContentLoaded listener (fires when DOM is ready, more reliable than onCompleted)
			const listener = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
				if (details.tabId === tabId && details.frameId === 0) {
					chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
					if (abortListener) signal?.removeEventListener("abort", abortListener);
					resolve(details.url);
				}
			};

			// Set up abort listener
			const abortListener = () => {
				if (chrome.webNavigation?.onDOMContentLoaded) {
					chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
				}
				reject(new Error("Aborted"));
			};

			if (signal) {
				signal.addEventListener("abort", abortListener);
			}

			chrome.webNavigation.onDOMContentLoaded.addListener(listener);

			// Trigger navigation
			chrome.tabs.update(tabId, { url }).catch((err: Error) => {
				if (chrome.webNavigation?.onDOMContentLoaded) {
					chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
				}
				if (abortListener) signal?.removeEventListener("abort", abortListener);
				reject(err);
			});
		});
	}

	private async navigateHistory(tabId: number, direction: "back" | "forward", signal?: AbortSignal): Promise<string> {
		if (signal?.aborted) {
			throw new Error("Aborted");
		}

		// First check if there's history available in that direction
		const [result] = await chrome.scripting.executeScript({
			target: { tabId: tabId },
			func: (dir: "back" | "forward") => {
				const canNavigate = dir === "back" ? history.length > 1 : false; // Can't reliably detect forward
				return { canNavigate, currentUrl: location.href };
			},
			args: [direction],
		});

		const { canNavigate, currentUrl } = result.result as { canNavigate: boolean; currentUrl: string };

		// For back navigation, we can check. For forward, we can't know for sure, so we try anyway
		if (direction === "back" && !canNavigate) {
			// No history to go back to, return current URL immediately
			return currentUrl;
		}

		// Attempt navigation
		return new Promise((resolve, reject) => {
			if (signal?.aborted) {
				reject(new Error("Aborted"));
				return;
			}

			// Set up navigation completion listener
			const listener = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
				if (details.tabId === tabId && details.frameId === 0) {
					chrome.webNavigation.onCompleted.removeListener(listener);
					if (abortListener) signal?.removeEventListener("abort", abortListener);
					if (timeout) clearTimeout(timeout);
					resolve(details.url);
				}
			};

			// Set up abort listener
			const abortListener = () => {
				if (chrome.webNavigation?.onCompleted) {
					chrome.webNavigation.onCompleted.removeListener(listener);
				}
				if (timeout) clearTimeout(timeout);
				reject(new Error("Aborted"));
			};

			if (signal) {
				signal.addEventListener("abort", abortListener);
			}

			chrome.webNavigation.onCompleted.addListener(listener);

			// Set a timeout to detect if navigation didn't happen (no history available for forward)
			const timeout = setTimeout(() => {
				chrome.webNavigation.onCompleted.removeListener(listener);
				if (abortListener) signal?.removeEventListener("abort", abortListener);
				// Navigation didn't happen, return current URL
				resolve(currentUrl);
			}, 1000); // 1 second timeout

			// Execute history navigation in the page
			chrome.scripting
				.executeScript({
					target: { tabId: tabId },
					func: (dir: "back" | "forward") => {
						history[dir]();
					},
					args: [direction],
				})
				.catch((err: Error) => {
					chrome.webNavigation.onCompleted.removeListener(listener);
					if (abortListener) signal?.removeEventListener("abort", abortListener);
					if (timeout) clearTimeout(timeout);
					reject(err);
				});
		});
	}

	private async openInNewTab(url: string, signal?: AbortSignal): Promise<string> {
		if (signal?.aborted) {
			throw new Error("Aborted");
		}

		const newTab = await chrome.tabs.create({ url, active: true });

		if (!newTab.id) {
			throw new Error("Failed to create new tab");
		}

		// Wait for the tab to load
		return new Promise((resolve, reject) => {
			if (signal?.aborted) {
				reject(new Error("Aborted"));
				return;
			}

			const listener = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
				if (details.tabId === newTab.id && details.frameId === 0) {
					chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
					if (abortListener) signal?.removeEventListener("abort", abortListener);
					resolve(details.url);
				}
			};

			const abortListener = () => {
				if (chrome.webNavigation?.onDOMContentLoaded) {
					chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
				}
				reject(new Error("Aborted"));
			};

			if (signal) {
				signal.addEventListener("abort", abortListener);
			}

			chrome.webNavigation.onDOMContentLoaded.addListener(listener);
		});
	}

	private async listTabs(): Promise<{ output: string; details: NavigateResult }> {
		const tabs = await chrome.tabs.query({});

		const tabInfos: TabInfo[] = tabs
			.filter(
				(t: chrome.tabs.Tab): t is chrome.tabs.Tab & { id: number; url: string } =>
					t.id !== undefined && t.url !== undefined,
			)
			.map((t: chrome.tabs.Tab & { id: number; url: string }) => ({
				id: t.id,
				url: t.url,
				title: t.title || "Untitled",
				active: t.active || false,
				favicon: t.favIconUrl,
			}));

		const details: NavigateResult = {
			tabs: tabInfos,
		};

		let output = `Found ${tabInfos.length} open tabs:\n`;
		for (const tab of tabInfos) {
			const activeMarker = tab.active ? " [ACTIVE]" : "";
			output += `  - Tab ${tab.id}: ${tab.title}${activeMarker}\n`;
			output += `    URL: ${tab.url}\n`;
		}

		return { output, details };
	}

	private async switchToTab(tabId: number): Promise<{ output: string; details: NavigateResult }> {
		// Ensure tabId is a number (in case it comes through as string)
		const numericTabId = typeof tabId === "string" ? parseInt(tabId, 10) : tabId;

		// Query for the tab to get its details
		const tabs = await chrome.tabs.query({});
		const tab = tabs.find((t: chrome.tabs.Tab) => t.id === numericTabId);

		if (!tab) {
			throw new Error(`Tab ${numericTabId} not found`);
		}

		// Activate the tab
		await chrome.tabs.update(numericTabId, { active: true });

		// Focus the window containing the tab
		if (tab.windowId) {
			await chrome.windows.update(tab.windowId, { focused: true });
		}

		const finalUrl = tab.url || "";
		const title = tab.title || "Untitled";
		const favicon = tab.favIconUrl;

		// Get skills for the tab's URL
		const skillsRepo = getSitegeistStorage().skills;
		const matchingSkills = finalUrl ? await skillsRepo.getSkillsForUrl(finalUrl) : [];
		const skills = matchingSkills.map((s) => ({
			name: s.name,
			shortDescription: s.shortDescription,
		}));

		const details: NavigateResult = {
			finalUrl,
			title,
			favicon,
			tabId: numericTabId,
			skills,
			switchedToTab: numericTabId,
		};

		let output = `Switched to tab ${numericTabId}: ${title}\n`;
		output += `URL: ${finalUrl}\n`;

		if (skills.length > 0) {
			output += "Available skills:\n";
			for (const skill of skills) {
				output += `  - ${skill.name}: ${skill.shortDescription}\n`;
			}
		} else {
			output += "No skills found for domain";
		}

		return { output, details };
	}
}

// ============================================================================
// RENDERER
// ============================================================================

function getFallbackFavicon(url: string): string {
	try {
		const urlObj = new URL(url);
		return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
	} catch {
		return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23999' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'/%3E%3C/svg%3E";
	}
}

export const navigateRenderer: ToolRenderer<NavigateParams, NavigateResult> = {
	render(
		params: NavigateParams | undefined,
		result: ToolResultMessage<NavigateResult> | undefined,
		_isStreaming?: boolean,
	): ToolRenderResult {
		// Loading state (params but no result)
		if (params && !result) {
			let displayText = "";
			if ("url" in params && params.url) {
				displayText = params.url;
			} else if ("history" in params && params.history) {
				displayText = `history.${params.history}()`;
			} else if ("listTabs" in params) {
				displayText = "Listing tabs...";
			} else if ("switchToTab" in params) {
				displayText = `Switching to tab ${params.switchToTab}`;
			}

			return {
				content: html`
					<div class="my-2">
						<div
							class="inline-flex items-center gap-2 px-3 py-2 text-sm text-card-foreground bg-card border border-border rounded-lg max-w-full shadow-lg"
						>
							<div class="w-4 h-4 flex-shrink-0 flex items-center justify-center">
								${icon(Loader2, "sm", "animate-spin")}
							</div>
							<span class="truncate font-medium">${i18n("Navigating to")} ${displayText}</span>
						</div>
					</div>
				`,
				isCustom: true,
			};
		}

		// Complete state (with result)
		if (result && !result.isError && result.details) {
			const { finalUrl, title, favicon, skills, tabs } = result.details;

			// Handle tab listing
			if (tabs) {
				return {
					content: html`
						<div class="flex items-center gap-2 flex-wrap">
							<span class="text-sm text-muted-foreground">${i18n("Open tabs")}</span>
							${tabs.map((tab) => TabPill(tab, true))}
						</div>
					`,
					isCustom: false,
				};
			}

			// Handle navigation/switch results
			if (finalUrl && title) {
				const faviconUrl = favicon || getFallbackFavicon(finalUrl);

				// Convert skills to Skill objects for SkillPill
				const skillObjects: Skill[] = (skills || []).map((s) => ({
					name: s.name,
					shortDescription: s.shortDescription,
					description: "",
					examples: "",
					library: "",
					domainPatterns: [],
					createdAt: new Date().toISOString(),
					lastUpdated: new Date().toISOString(),
				}));

				return {
					content: html`
						<div class="my-2 space-y-2">
							<button
								class="inline-flex items-center gap-2 px-3 py-2 text-sm text-card-foreground bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors max-w-full cursor-pointer shadow-lg"
								@click=${() => chrome.tabs.create({ url: finalUrl })}
								title="${i18n("Click to open")}: ${finalUrl}"
							>
								<img src="${faviconUrl}" alt="" class="w-4 h-4 flex-shrink-0" />
								<span class="truncate font-medium">${title}</span>
							</button>
							${
								skillObjects.length > 0
									? html`
										<div class="flex flex-wrap gap-2">
											${skillObjects.map((s) => SkillPill(s, true))}
										</div>
								  `
									: ""
							}
						</div>
					`,
					isCustom: true,
				};
			}
		}

		// Error state
		if (result?.isError) {
			return {
				content: html`
					<div class="my-2">
						<div class="text-sm text-destructive">${result.output}</div>
					</div>
				`,
				isCustom: true,
			};
		}

		// Waiting state
		return {
			content: html`<div class="my-2 text-sm text-muted-foreground">${i18n("Waiting...")}</div>`,
			isCustom: true,
		};
	},
};

// Auto-register renderer
registerToolRenderer("navigate", navigateRenderer);
