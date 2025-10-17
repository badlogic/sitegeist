import type { MessageRenderer } from "@mariozechner/pi-web-ui";
import { registerMessageRenderer } from "@mariozechner/pi-web-ui";
import { html, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SkillPill } from "../components/SkillPill.js";
import { getSitegeistStorage } from "../storage/app-storage.js";
import type { Skill } from "../storage/stores/skills-store.js";

// ============================================================================
// NAVIGATION MESSAGE TYPE
// ============================================================================

export interface NavigationMessage {
	role: "navigation";
	url: string;
	title: string;
	favicon?: string;
	tabId?: number;
}

// Extend CustomMessages interface via declaration merging
declare module "@mariozechner/pi-web-ui" {
	interface CustomMessages {
		navigation: NavigationMessage;
	}
}

// ============================================================================
// NAVIGATION MESSAGE ELEMENT
// ============================================================================

function getFallbackFavicon(url: string): string {
	try {
		const urlObj = new URL(url);
		return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
	} catch {
		return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23999' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'/%3E%3C/svg%3E";
	}
}

@customElement("navigation-message")
export class NavigationMessageElement extends LitElement {
	@property() url!: string;
	@property() title!: string;
	@property() favicon?: string;
	@state() private skills: Skill[] = [];

	protected createRenderRoot() {
		return this; // light DOM
	}

	override async connectedCallback() {
		super.connectedCallback();
		// Load skills for this URL
		const skillsRepo = getSitegeistStorage().skills;
		this.skills = await skillsRepo.getSkillsForUrl(this.url);
	}

	override render(): TemplateResult {
		const faviconUrl = this.favicon || getFallbackFavicon(this.url);

		return html`
			<div class="mx-4 my-2 space-y-2">
				<button
					class="inline-flex items-center gap-2 px-3 py-2 text-sm text-card-foreground bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors max-w-full cursor-pointer shadow-lg"
					@click=${() => {
						chrome.tabs.create({ url: this.url });
					}}
					title="Click to open: ${this.url}"
				>
					<img
						src="${faviconUrl}"
						alt=""
						class="w-4 h-4 flex-shrink-0"
						@error=${(e: Event) => {
							const target = e.target as HTMLImageElement;
							target.style.display = "none";
						}}
					/>
					<span class="truncate font-medium">${this.title}</span>
				</button>
				${
					this.skills.length > 0
						? html`
						<div class="flex flex-wrap gap-2">
							${this.skills.map((skill) => SkillPill(skill, true))}
						</div>
					`
						: ""
				}
			</div>
		`;
	}
}

// ============================================================================
// RENDERER
// ============================================================================

const navigationRenderer: MessageRenderer<NavigationMessage> = {
	render: (nav) => {
		return html`<navigation-message .url=${nav.url} .title=${nav.title} .favicon=${nav.favicon}></navigation-message>`;
	},
};

// ============================================================================
// REGISTER
// ============================================================================

export function registerNavigationRenderer() {
	registerMessageRenderer("navigation", navigationRenderer);
}

// ============================================================================
// HELPER
// ============================================================================

export function createNavigationMessage(
	url: string,
	title: string,
	favicon?: string,
	tabId?: number,
): NavigationMessage {
	return {
		role: "navigation",
		url,
		title,
		favicon,
		tabId,
	};
}
