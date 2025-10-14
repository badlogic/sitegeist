import { Button, icon } from "@mariozechner/mini-lit";
import type { Agent } from "@mariozechner/pi-web-ui";
import { ArtifactsPanel } from "@mariozechner/pi-web-ui";
import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Play, Square } from "lucide";
import { BrowserJavaScriptTool, requestUserScriptsPermission } from "../tools/browser-javascript.js";

@customElement("browser-repl-panel")
export class BrowserReplPanel extends LitElement {
	@state() private code = "";
	@state() private output = "";
	@state() private isExecuting = false;

	private readonly artifactsPanel: ArtifactsPanel;
	private readonly browserTool: BrowserJavaScriptTool;
	private abortController?: AbortController;

	constructor() {
		super();

		this.artifactsPanel = new ArtifactsPanel();
		this.artifactsPanel.sandboxUrlProvider = () => chrome.runtime.getURL("sandbox.html");

		const agentStub = {
			appendMessage: () => {},
		} as unknown as Agent;

		this.browserTool = new BrowserJavaScriptTool(this.artifactsPanel, agentStub);
	}

	createRenderRoot() {
		return this;
	}

	private async executeCode() {
		if (!this.code.trim() || this.isExecuting) return;

		this.isExecuting = true;
		this.output = "Checking permissions...";
		this.abortController = new AbortController();

		try {
			const permission = await requestUserScriptsPermission();
			if (!permission.granted) {
				this.output = permission.message || "userScripts permission is required.";
				return;
			}

			this.output = "Executing...";
			const result = await this.browserTool.execute(
				"",
				{
					code: this.code,
					title: "Debug Browser JavaScript",
				},
				this.abortController.signal,
			);

			this.output = result.output || "No output";
		} catch (error: any) {
			if (error?.message === "Aborted" || error?.message === "Tool execution was aborted") {
				this.output = "Execution aborted by user";
			} else {
				this.output = `Error: ${error?.message || error}`;
			}
		} finally {
			this.isExecuting = false;
			this.abortController = undefined;
		}
	}

	private abortExecution() {
		if (this.abortController) {
			this.abortController.abort();
		}
	}

	render() {
		return html`
			<div class="flex flex-col h-full bg-background">
				<div class="flex-1 flex gap-4 p-4 overflow-hidden">
					<!-- Left: Code Editor + Output -->
					<div class="flex-1 flex flex-col gap-4 min-w-0">
						<!-- Code Input -->
						<div class="flex-1 flex flex-col gap-2 min-h-0">
							<div class="flex items-center justify-between">
								<label class="text-sm font-medium">Browser JavaScript Code</label>
								${this.isExecuting
									? Button({
										variant: "destructive",
										size: "sm",
										children: html`<span class="flex items-center gap-1.5">${icon(Square, "sm")} Abort</span>`,
										onClick: () => this.abortExecution(),
									})
								: Button({
									variant: "default",
									size: "sm",
									children: html`<span class="flex items-center gap-1.5">${icon(Play, "sm")} Run</span>`,
									onClick: () => this.executeCode(),
									disabled: !this.code.trim(),
								})}
							</div>
							<textarea
								class="flex-1 p-3 font-mono text-sm bg-card border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
								placeholder="Enter JavaScript code to run in the active tab..."
								.value=${this.code}
								@input=${(e: Event) => {
									this.code = (e.target as HTMLTextAreaElement).value;
								}}
								@keydown=${(e: KeyboardEvent) => {
									if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
										e.preventDefault();
										this.executeCode();
									}
								}}
							></textarea>
						</div>

						<!-- Output -->
						<div class="flex-1 flex flex-col gap-2 min-h-0">
							<label class="text-sm font-medium">Output</label>
							<pre class="flex-1 p-3 font-mono text-sm bg-card border border-border rounded-lg overflow-auto whitespace-pre-wrap">${
								this.output || "No output yet"
							}</pre>
						</div>
					</div>

					<!-- Right: Artifacts Panel -->
					<div class="flex-1 border-l border-border pl-4 min-w-0">
						<div class="h-full flex flex-col gap-2">
							<label class="text-sm font-medium">Artifacts</label>
							<div class="flex-1 border border-border rounded-lg overflow-hidden">
								${this.artifactsPanel}
							</div>
						</div>
					</div>
				</div>
			</div>
		`;
	}
}
