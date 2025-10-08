import { html, Input, Button } from "@mariozechner/mini-lit";
import { SettingsTab } from "@mariozechner/pi-web-ui";
import { getSitegeistStorage } from "../storage/app-storage.js";
import type { Skill } from "../storage/skills-repository.js";
import { getFaviconUrl } from "../utils/favicon.js";

export class SkillsTab extends SettingsTab {
	label = "Skills";
	private skills: Skill[] = [];
	private filteredSkills: Skill[] = [];
	private searchQuery = "";
	private editingSkill: Skill | null = null;
	private importConflicts: { skill: Skill; selected: boolean }[] = [];
	private importedSkills: Skill[] = [];

	getTabName(): string {
		return this.label;
	}

	async connectedCallback() {
		super.connectedCallback();
		await this.loadSkills();
	}

	async loadSkills() {
		const storage = getSitegeistStorage();
		this.skills = await storage.skills.listSkills().then(list =>
			Promise.all(list.map(s => storage.skills.getSkill(s.name))).then(skills => skills.filter(Boolean) as Skill[])
		);
		this.filterSkills();
	}

	filterSkills() {
		const query = this.searchQuery.toLowerCase();
		this.filteredSkills = this.skills.filter(
			s =>
				s.name.toLowerCase().includes(query) ||
				s.domainPatterns.some(p => p.toLowerCase().includes(query)) ||
				s.shortDescription.toLowerCase().includes(query)
		);
		this.requestUpdate();
	}

	onSearchInput(e: Event) {
		this.searchQuery = (e.target as HTMLInputElement).value;
		this.filterSkills();
	}

	async deleteSkill(skill: Skill) {
		if (!confirm(`Delete skill "${skill.name}"?`)) return;

		const storage = getSitegeistStorage();
		await storage.skills.deleteSkill(skill.name);
		await this.loadSkills();
	}

	editSkill(skill: Skill) {
		this.editingSkill = { ...skill };
		this.requestUpdate();
	}

	cancelEdit() {
		this.editingSkill = null;
		this.requestUpdate();
	}

	async saveEdit() {
		if (!this.editingSkill) return;
		const storage = getSitegeistStorage();
		const toSave: Skill = {
			...this.editingSkill,
			lastUpdated: new Date().toISOString(),
		};
		await storage.skills.saveSkill(toSave);
		this.editingSkill = null;
		await this.loadSkills();
	}

	updateEditField(field: keyof Skill, value: string | string[]) {
		if (!this.editingSkill) return;
		this.editingSkill = { ...this.editingSkill, [field]: value };
		this.requestUpdate();
	}

	async exportSkills() {
		const storage = getSitegeistStorage();
		const allSkills = await storage.skills.listSkills().then(list =>
			Promise.all(list.map(s => storage.skills.getSkill(s.name))).then(skills => skills.filter(Boolean) as Skill[])
		);

		const json = JSON.stringify(allSkills, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `sitegeist-skills-${new Date().toISOString().split("T")[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async importSkills() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "application/json,.json";
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;

			try {
				const text = await file.text();
				const imported = JSON.parse(text) as Skill[];

				if (!Array.isArray(imported)) {
					alert("Invalid skills file: expected an array of skills");
					return;
				}

				// Store imported skills for later
				this.importedSkills = imported;

				// Check for conflicts
				const storage = getSitegeistStorage();
				const conflicts: { skill: Skill; selected: boolean }[] = [];

				for (const skill of imported) {
					const existing = await storage.skills.getSkill(skill.name);
					if (existing) {
						conflicts.push({ skill, selected: true });
					}
				}

				if (conflicts.length > 0) {
					// Show conflict resolution UI
					this.importConflicts = conflicts;
					this.requestUpdate();
				} else {
					// No conflicts, import all
					await this.performImport(imported);
				}
			} catch (error) {
				alert(`Failed to import skills: ${(error as Error).message}`);
			}
		};
		input.click();
	}

	async performImport(skills: Skill[]) {
		const storage = getSitegeistStorage();

		// Filter out skills that are in conflicts and not selected
		const conflictNames = new Set(this.importConflicts.filter(c => !c.selected).map(c => c.skill.name));
		const toImport = skills.filter(s => !conflictNames.has(s.name));

		let imported = 0;
		for (const skill of toImport) {
			await storage.skills.saveSkill(skill);
			imported++;
		}

		this.importConflicts = [];
		await this.loadSkills();
		alert(`Imported ${imported} skill(s)`);
	}

	toggleConflictSelection(index: number) {
		this.importConflicts[index].selected = !this.importConflicts[index].selected;
		this.requestUpdate();
	}

	cancelImport() {
		this.importConflicts = [];
		this.importedSkills = [];
		this.requestUpdate();
	}

	renderSkillInfo(skill: Skill) {
		return html`
			<div class="border border-border rounded-lg p-4 bg-card">
				<div class="flex items-start gap-3">
					<img src=${getFaviconUrl(skill.domainPatterns[0])} width="24" height="24" alt="" class="rounded mt-1" />
					<div class="flex-1 space-y-2">
						<h3 class="font-semibold text-foreground">${skill.name}</h3>
						<div class="text-xs text-muted-foreground font-mono">
							${skill.domainPatterns.join(', ')}
						</div>
						<p class="text-sm text-muted-foreground">${skill.shortDescription}</p>
						<div class="flex gap-2 pt-2">
							${Button({
								variant: "outline",
								size: "sm",
								onClick: () => this.editSkill(skill),
								children: "Edit"
							})}
							${Button({
								variant: "destructive",
								size: "sm",
								onClick: () => this.deleteSkill(skill),
								children: "Delete"
							})}
						</div>
					</div>
				</div>
			</div>
		`;
	}

	renderSkillEditor(skill: Skill) {
		return html`
			<div class="border border-border rounded-lg p-4 bg-card space-y-4">
				<h3 class="font-semibold text-foreground">Edit Skill: ${skill.name}</h3>

				${Input({
					label: "Name (cannot be changed)",
					type: "text",
					value: skill.name,
					disabled: true
				})}

				${Input({
					label: "Domain Patterns (comma-separated)",
					type: "text",
					value: skill.domainPatterns.join(', '),
					onInput: (e) => {
						const value = (e.target as HTMLInputElement).value;
						const patterns = value.split(',').map(p => p.trim()).filter(p => p.length > 0);
						this.updateEditField("domainPatterns", patterns);
					}
				})}

				${Input({
					label: "Short Description",
					type: "text",
					value: skill.shortDescription,
					onInput: (e) => this.updateEditField("shortDescription", (e.target as HTMLInputElement).value)
				})}

				<div class="space-y-2">
					<label class="text-sm font-medium text-foreground">Description (Markdown)</label>
					<textarea
						class="w-full min-h-[100px] px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
						.value=${skill.description}
						@input=${(e: Event) => this.updateEditField("description", (e.target as HTMLTextAreaElement).value)}
					></textarea>
				</div>

				<div class="space-y-2">
					<label class="text-sm font-medium text-foreground">Examples (JavaScript)</label>
					<textarea
						class="w-full min-h-[100px] px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono"
						.value=${skill.examples}
						@input=${(e: Event) => this.updateEditField("examples", (e.target as HTMLTextAreaElement).value)}
					></textarea>
				</div>

				<div class="space-y-2">
					<label class="text-sm font-medium text-foreground">Library Code</label>
					<textarea
						class="w-full min-h-[200px] px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono"
						.value=${skill.library}
						@input=${(e: Event) => this.updateEditField("library", (e.target as HTMLTextAreaElement).value)}
					></textarea>
				</div>

				<div class="flex justify-end gap-2">
					${Button({
						variant: "outline",
						onClick: () => this.cancelEdit(),
						children: "Cancel"
					})}
					${Button({
						variant: "default",
						onClick: () => this.saveEdit(),
						children: "Save"
					})}
				</div>
			</div>
		`;
	}

	renderConflictResolution() {
		return html`
			<div class="border border-border rounded-lg p-4 bg-card space-y-4">
				<h3 class="font-semibold text-foreground">Import Conflicts</h3>
				<p class="text-sm text-muted-foreground">
					The following skills already exist. Check the skills you want to overwrite:
				</p>

				<div class="space-y-2">
					${this.importConflicts.map((conflict, index) => html`
						<label class="flex items-start gap-3 p-3 border border-border rounded cursor-pointer hover:bg-muted/50">
							<input
								type="checkbox"
								.checked=${conflict.selected}
								@change=${() => this.toggleConflictSelection(index)}
								class="mt-1"
							/>
							<div class="flex-1">
								<div class="font-medium text-foreground">${conflict.skill.name}</div>
								<div class="text-xs text-muted-foreground">${conflict.skill.domainPatterns.join(", ")}</div>
								<div class="text-sm text-muted-foreground mt-1">${conflict.skill.shortDescription}</div>
							</div>
						</label>
					`)}
				</div>

				<div class="flex justify-end gap-2">
					${Button({
						variant: "outline",
						onClick: () => this.cancelImport(),
						children: "Cancel"
					})}
					${Button({
						variant: "default",
						onClick: () => this.performImport(this.importedSkills),
						children: "Import Selected"
					})}
				</div>
			</div>
		`;
	}

	render() {
		// Show conflict resolution UI if there are conflicts
		if (this.importConflicts.length > 0) {
			return html`
				<div class="flex flex-col gap-6">
					${this.renderConflictResolution()}
				</div>
			`;
		}

		return html`
			<div class="flex flex-col gap-6">
				<p class="text-sm text-muted-foreground">
					Manage site skills - reusable JavaScript libraries for domain-specific automation.
				</p>

				<div class="flex gap-2">
					${Button({
						variant: "outline",
						onClick: () => this.exportSkills(),
						children: "Export Skills"
					})}
					${Button({
						variant: "outline",
						onClick: () => this.importSkills(),
						children: "Import Skills"
					})}
				</div>

				${Input({
					type: "text",
					placeholder: "Search skills by name, domain, or description...",
					value: this.searchQuery,
					onInput: (e) => this.onSearchInput(e)
				})}

				${this.filteredSkills.length === 0
					? html`<div class="text-center text-muted-foreground py-8">
							${this.searchQuery ? "No skills match your search" : "No skills created yet"}
						</div>`
					: html`<div class="flex flex-col gap-3">
							${this.filteredSkills.map(skill =>
								this.editingSkill && this.editingSkill.name === skill.name
									? this.renderSkillEditor(this.editingSkill)
									: this.renderSkillInfo(skill)
							)}
						</div>`}
			</div>
		`;
	}
}

customElements.define("skills-tab", SkillsTab);
