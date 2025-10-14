import { html, type TemplateResult } from "@mariozechner/mini-lit";
import type { TabInfo } from "../tools/navigate.js";

export function TabPill(tab: TabInfo, clickable = true): TemplateResult {
	const handleClick = async () => {
		if (!clickable) return;
		try {
			// Activate the tab
			await chrome.tabs.update(tab.id, { active: true });
			// Focus the window containing the tab
			if (tab.active === false) {
				const tabs = await chrome.tabs.query({});
				const foundTab = tabs.find((t: chrome.tabs.Tab) => t.id === tab.id);
				if (foundTab?.windowId) {
					await chrome.windows.update(foundTab.windowId, { focused: true });
				}
			}
		} catch (err) {
			console.error("Failed to switch to tab:", err);
		}
	};

	const getFallbackFavicon = (url: string): string => {
		try {
			const urlObj = new URL(url);
			return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
		} catch {
			return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23999' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'/%3E%3C/svg%3E";
		}
	};

	const faviconUrl = tab.favicon || getFallbackFavicon(tab.url);

	return html`
		<div
			class="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-card border border-border rounded-lg ${
				clickable ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""
			}"
			@click=${clickable ? handleClick : null}
			title="${tab.url}"
		>
			<img src="${faviconUrl}" alt="" class="w-4 h-4 flex-shrink-0" />
			<span class="text-foreground truncate max-w-[200px]">${tab.title}</span>
			${tab.active ? html`<span class="text-green-600 dark:text-green-500 text-[10px] font-medium">●</span>` : ""}
		</div>
	`;
}
