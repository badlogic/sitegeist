import {
	Badge,
	DialogBase,
	DialogContent,
	DialogHeader,
	html,
	i18n,
} from "@mariozechner/mini-lit";
import { type SessionMetadata, formatUsage } from "@mariozechner/pi-web-ui";
import { customElement, state } from "lit/decorators.js";
import { getAppStorage } from "@mariozechner/pi-web-ui";
import * as port from "../port.js";
import Fuse from "fuse.js";

// Cross-browser API compatibility
// @ts-expect-error - browser global exists in Firefox, chrome in Chrome
const browserAPI = globalThis.browser || globalThis.chrome;

@customElement("sitegeist-session-list-dialog")
export class SitegeistSessionListDialog extends DialogBase {
	@state() private sessions: SessionMetadata[] = [];
	@state() private loading = true;
	@state() private sessionLocks: Record<string, number> = {}; // sessionId -> windowId
	@state() private currentWindowId: number | undefined;
	@state() private searchQuery = "";
	@state() private showDeleteMenu = false;

	private onSelectCallback?: (sessionId: string) => void;
	private onDeleteCallback?: (sessionId: string) => void;
	private deletedSessions = new Set<string>();
	private closedViaSelection = false;

	protected modalWidth = "min(600px, 90vw)";
	protected modalHeight = "min(700px, 90vh)";

	connectedCallback(): void {
		super.connectedCallback();
		// Close delete menu when clicking outside
		document.addEventListener("click", this.handleDocumentClick);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("click", this.handleDocumentClick);
	}

	private handleDocumentClick = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		// Close menu if clicking outside the delete button and menu
		if (!target.closest(".delete-menu-container")) {
			this.showDeleteMenu = false;
		}
	};

	static async open(
		onSelect: (sessionId: string) => void,
		onDelete?: (sessionId: string) => void,
	) {
		const dialog = new SitegeistSessionListDialog();
		dialog.onSelectCallback = onSelect;
		dialog.onDeleteCallback = onDelete;
		dialog.open();
		await dialog.loadSessionsAndLocks();
	}

	private async loadSessionsAndLocks() {
		this.loading = true;
		try {
			// Get current window ID
			const currentWindow = await browserAPI.windows.getCurrent();
			this.currentWindowId = currentWindow.id;

			// Load sessions (already sorted by lastModified index)
			const storage = getAppStorage();
			this.sessions = await storage.sessions.getAllMetadata();

			// Get lock information from background via port
			const lockResponse = await port.sendMessage(
				{ type: "getLockedSessions" },
				"lockedSessions"
			);
			this.sessionLocks = lockResponse.locks || {};
		} catch (err) {
			console.error("Failed to load sessions:", err);
			this.sessions = [];
			this.sessionLocks = {};
		} finally {
			this.loading = false;
		}
	}

	private async handleDelete(sessionId: string, event: Event) {
		event.stopPropagation();

		if (!confirm(i18n("Delete this session?"))) {
			return;
		}

		try {
			const storage = getAppStorage();
			if (!storage.sessions) return;

			await storage.sessions.deleteSession(sessionId);
			await this.loadSessionsAndLocks();

			// Track deleted session
			this.deletedSessions.add(sessionId);
		} catch (err) {
			console.error("Failed to delete session:", err);
		}
	}

	override close() {
		super.close();

		// Only notify about deleted sessions if dialog wasn't closed via selection
		if (
			!this.closedViaSelection &&
			this.onDeleteCallback &&
			this.deletedSessions.size > 0
		) {
			for (const sessionId of this.deletedSessions) {
				this.onDeleteCallback(sessionId);
			}
		}
	}

	private handleSelect(sessionId: string) {
		this.closedViaSelection = true;
		if (this.onSelectCallback) {
			this.onSelectCallback(sessionId);
		}
		this.close();
	}

	private formatDate(isoString: string): string {
		const date = new Date(isoString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) {
			return i18n("Today");
		}
		if (days === 1) {
			return i18n("Yesterday");
		}
		if (days < 7) {
			return i18n("{days} days ago").replace("{days}", days.toString());
		}
		return date.toLocaleDateString();
	}

	private isSessionLocked(sessionId: string): boolean {
		const lockWindowId = this.sessionLocks[sessionId];
		return (
			lockWindowId !== undefined && lockWindowId !== this.currentWindowId
		);
	}

	private isCurrentSession(sessionId: string): boolean {
		const lockWindowId = this.sessionLocks[sessionId];
		return (
			lockWindowId !== undefined && lockWindowId === this.currentWindowId
		);
	}

	private async handleExport(sessionId?: string) {
		try {
			const storage = getAppStorage();
			if (!storage.sessions) return;

			const allSessions = [];

			if (sessionId) {
				// Export single session
				const session = await storage.sessions.loadSession(sessionId);
				const metadata = this.sessions.find(s => s.id === sessionId);
				if (session && metadata) {
					allSessions.push({
						id: metadata.id,
						title: metadata.title,
						lastModified: metadata.lastModified,
						state: session,
					});
				}
			} else {
				// Export all sessions
				for (const metadata of this.sessions) {
					const session = await storage.sessions.loadSession(metadata.id);
					if (session) {
						allSessions.push({
							id: metadata.id,
							title: metadata.title,
							lastModified: metadata.lastModified,
							state: session,
						});
					}
				}
			}

			const exportData = {
				version: 1,
				exportDate: new Date().toISOString(),
				sessions: allSessions,
			};

			const blob = new Blob([JSON.stringify(exportData, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			const filename = sessionId
				? `sitegeist-session-${allSessions[0]?.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'export'}.json`
				: `sitegeist-sessions-${new Date().toISOString().split("T")[0]}.json`;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Failed to export sessions:", err);
			alert(i18n("Export failed. Check console for details."));
		}
	}

	private getFilteredSessions(): SessionMetadata[] {
		if (!this.searchQuery.trim()) {
			return this.sessions;
		}

		// Use Fuse.js for fuzzy search
		const fuse = new Fuse(this.sessions, {
			keys: ["title", "preview"],
			threshold: 0.4, // 0 = exact match, 1 = match anything
			ignoreLocation: true,
			minMatchCharLength: 2,
		});

		const results = fuse.search(this.searchQuery);
		return results.map((result) => result.item);
	}

	private getTotalStats(): { totalCost: number; totalMessages: number; totalSessions: number } {
		const filtered = this.getFilteredSessions();
		return {
			totalSessions: filtered.length,
			totalCost: filtered.reduce((sum, s) => sum + s.usage.cost.total, 0),
			totalMessages: filtered.reduce((sum, s) => sum + s.messageCount, 0),
		};
	}

	private async handleDeleteOlderThan(days: number) {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);
		const cutoffISO = cutoffDate.toISOString();

		const oldSessions = this.sessions.filter(
			(s) => s.lastModified < cutoffISO,
		);

		if (oldSessions.length === 0) {
			alert(i18n(`No sessions older than {days} days`).replace("{days}", days.toString()));
			return;
		}

		const confirmed = confirm(
			i18n(`Delete {count} sessions older than {days} days?`)
				.replace("{count}", oldSessions.length.toString())
				.replace("{days}", days.toString()),
		);

		if (!confirmed) return;

		try {
			const storage = getAppStorage();
			if (!storage.sessions) return;

			for (const session of oldSessions) {
				await storage.sessions.deleteSession(session.id);
				this.deletedSessions.add(session.id);
			}

			await this.loadSessionsAndLocks();
		} catch (err) {
			console.error("Failed to delete old sessions:", err);
			alert(i18n("Failed to delete sessions. Check console for details."));
		}
	}

	private async handleImport() {
		try {
			const input = document.createElement("input");
			input.type = "file";
			input.accept = "application/json";
			input.onchange = async (e: Event) => {
				const file = (e.target as HTMLInputElement).files?.[0];
				if (!file) return;

				const text = await file.text();
				const importData = JSON.parse(text);

				// Handle both array format (legacy) and object format with version
				let sessionsToImport = [];
				if (Array.isArray(importData)) {
					sessionsToImport = importData;
				} else if (importData.version && importData.sessions) {
					sessionsToImport = importData.sessions;
				} else {
					alert(i18n("Invalid import file format"));
					return;
				}

				const storage = getAppStorage();
				if (!storage.sessions) return;

				// Check for duplicates
				const existingIds = new Set(this.sessions.map(s => s.id));
				const duplicates = sessionsToImport.filter((s: any) => existingIds.has(s.id));

				let duplicateAction: 'skip' | 'overwrite' | null = null;
				if (duplicates.length > 0) {
					const choice = confirm(
						i18n(`Found {count} duplicate sessions. Click OK to overwrite, Cancel to skip duplicates.`)
							.replace("{count}", duplicates.length.toString())
					);
					duplicateAction = choice ? 'overwrite' : 'skip';
				}

				let imported = 0;
				let skipped = 0;
				for (const sessionData of sessionsToImport) {
					try {
						const isDuplicate = existingIds.has(sessionData.id);

						if (isDuplicate && duplicateAction === 'skip') {
							skipped++;
							continue;
						}

						// Use original ID if not duplicate, or if overwriting
						await storage.sessions.saveSession(
							sessionData.id,
							sessionData.state,
							undefined,
							sessionData.title,
						);
						imported++;
					} catch (err) {
						console.error(`Failed to import session ${sessionData.title}:`, err);
					}
				}

				const message = skipped > 0
					? i18n(`Imported {imported} sessions, skipped {skipped} duplicates`)
						.replace("{imported}", imported.toString())
						.replace("{skipped}", skipped.toString())
					: i18n(`Imported {count} sessions`).replace("{count}", imported.toString());

				alert(message);
				await this.loadSessionsAndLocks();
			};
			input.click();
		} catch (err) {
			console.error("Failed to import sessions:", err);
			alert(i18n("Import failed. Check console for details."));
		}
	}

	protected override renderContent() {
		const filteredSessions = this.getFilteredSessions();
		const stats = this.getTotalStats();

		return html`
			${DialogContent({
				className: "h-full flex flex-col",
				children: html`
					${DialogHeader({
						title: i18n("Sessions"),
						description: i18n("Load a previous conversation"),
					})}

					<!-- Action buttons -->
					<div class="flex gap-2 mt-4">
						<button
							class="flex-1 px-3 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-secondary transition-colors"
							@click=${() => this.handleImport()}
						>
							${i18n("Import")}
						</button>
						<button
							class="flex-1 px-3 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-secondary transition-colors"
							@click=${() => this.handleExport()}
						>
							${i18n("Export All")}
						</button>
						<div class="relative delete-menu-container">
							<button
								class="px-3 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-secondary transition-colors"
								@click=${() => (this.showDeleteMenu = !this.showDeleteMenu)}
							>
								${i18n("Delete Old")}
							</button>
							${
								this.showDeleteMenu
									? html`
										<div class="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-background shadow-lg z-50">
											<button
												class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary transition-colors rounded-t-md"
												@click=${() => {
													this.showDeleteMenu = false;
													this.handleDeleteOlderThan(7);
												}}
											>
												${i18n("Older than 7 days")}
											</button>
											<button
												class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary transition-colors"
												@click=${() => {
													this.showDeleteMenu = false;
													this.handleDeleteOlderThan(30);
												}}
											>
												${i18n("Older than 30 days")}
											</button>
											<button
												class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary transition-colors border-t border-border rounded-b-md"
												@click=${() => {
													this.showDeleteMenu = false;
													this.handleDeleteOlderThan(90);
												}}
											>
												${i18n("Older than 90 days")}
											</button>
										</div>
									`
									: ""
							}
						</div>
					</div>

					<!-- Search bar -->
					<div class="mt-3">
						<input
							type="text"
							placeholder=${i18n("Search sessions...")}
							.value=${this.searchQuery}
							@input=${(e: InputEvent) => {
								this.searchQuery = (e.target as HTMLInputElement).value;
							}}
							class="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>

					<!-- Stats pills -->
					<div class="flex items-center gap-2 mt-3">
						${Badge({ children: `${stats.totalSessions} ${i18n("Sessions").toLowerCase()}`, variant: "secondary" })}
						${Badge({ children: `${stats.totalMessages} ${i18n("messages")}`, variant: "secondary" })}
						${Badge({
							children: `$${stats.totalCost.toFixed(4)}`,
							variant: "secondary",
							className: stats.totalCost > 0.01 ? "text-orange-500" : "text-green-600"
						})}
					</div>

					<div class="flex-1 overflow-y-auto mt-4 space-y-2">
						${
							this.loading
								? html`<div class="text-center py-8 text-muted-foreground">${i18n("Loading...")}</div>`
								: filteredSessions.length === 0
									? html`<div class="text-center py-8 text-muted-foreground">
											${this.searchQuery ? "No matching sessions" : i18n("No sessions yet")}
										</div>`
									: filteredSessions.map((session) => {
											const isLocked = this.isSessionLocked(session.id);
											const isCurrent = this.isCurrentSession(session.id);
											const cost = session.usage.cost.total;
											return html`
											<div
												class="group flex items-start gap-3 p-4 rounded-lg border border-border ${
													isLocked
														? "opacity-50 cursor-not-allowed"
														: "hover:bg-secondary/50 cursor-pointer"
												} ${isCurrent ? "bg-secondary/30 border-primary/30" : ""} transition-colors"
												@click=${() => !isLocked && this.handleSelect(session.id)}
											>
												<div class="flex-1 min-w-0">
													<!-- Title and badges -->
													<div class="flex items-center gap-2 mb-2">
														<div class="font-semibold text-foreground truncate">${session.title}</div>
														${
															isCurrent
																? html`<span class="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary font-medium shrink-0">
																	${i18n("Current")}
																</span>`
																: isLocked
																	? html`<span class="px-2 py-0.5 text-xs rounded-full bg-destructive/20 text-destructive font-medium shrink-0">
																		${i18n("Locked")}
																	</span>`
																	: ""
														}
													</div>

													<!-- Stats row -->
													<div class="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
														<span class="font-medium">${this.formatDate(session.lastModified)}</span>
														<span>${session.messageCount} ${i18n("messages")}</span>
														<span>${formatUsage(session.usage)}</span>
														<span class="font-semibold ${cost > 0.01 ? "text-orange-500" : "text-green-600"}">
															$${cost.toFixed(4)}
														</span>
													</div>

													<!-- Preview text - always show if available -->
													${
														session.preview
															? html`<div class="text-xs text-muted-foreground mt-2 line-clamp-2">
																	${session.preview}
																</div>`
															: ""
													}
												</div>
												<div class="flex gap-1">
													<button
														class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary text-foreground transition-opacity"
														@click=${(e: Event) => {
															e.stopPropagation();
															this.handleExport(session.id);
														}}
														title=${i18n("Export")}
													>
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
															<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
															<polyline points="7 10 12 15 17 10"></polyline>
															<line x1="12" y1="15" x2="12" y2="3"></line>
														</svg>
													</button>
													<button
														class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive transition-opacity"
														@click=${(e: Event) => this.handleDelete(session.id, e)}
														title=${i18n("Delete")}
													>
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
															<path d="M3 6h18"></path>
															<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
															<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
														</svg>
													</button>
												</div>
											</div>
										`;
										})
						}
					</div>
				`,
			})}
		`;
	}
}
