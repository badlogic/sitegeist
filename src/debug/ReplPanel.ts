import { Button, icon } from "@mariozechner/mini-lit";
import { ArtifactsPanel, ArtifactsRuntimeProvider, createJavaScriptReplTool } from "@mariozechner/pi-web-ui";
import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Play, Square } from "lucide";

@customElement("repl-panel")
export class ReplPanel extends LitElement {
	@state() private code = "";
	@state() private output = "";
	@state() private isExecuting = false;

	private artifactsPanel: ArtifactsPanel;
	private replTool: ReturnType<typeof createJavaScriptReplTool>;
	private abortController?: AbortController;

	constructor() {
		super();

		// Create artifacts panel with sandbox URL provider for extension CSP
		this.artifactsPanel = new ArtifactsPanel();
		this.artifactsPanel.sandboxUrlProvider = () => chrome.runtime.getURL("sandbox.html");

		// Create REPL tool with runtime providers and sandbox URL provider for extension CSP
		this.replTool = createJavaScriptReplTool();
		this.replTool.runtimeProvidersFactory = () => [
			new ArtifactsRuntimeProvider(this.artifactsPanel),
		];
		this.replTool.sandboxUrlProvider = () => chrome.runtime.getURL("sandbox.html");
	}

	createRenderRoot() {
		return this;
	}

	private async executeCode() {
		if (!this.code.trim() || this.isExecuting) return;

		this.isExecuting = true;
		this.output = "Executing...";
		this.abortController = new AbortController();

		try {
			const result = await this.replTool.execute("", { code: this.code, title: "Debug REPL" }, this.abortController.signal);
			this.output = result.output || "No output";
		// biome-ignore lint/suspicious/noExplicitAny: fine
		} catch (error: any) {
			if (error.message === "Execution aborted") {
				this.output = "Execution aborted by user";
			} else {
				this.output = `Error: ${error.message}`;
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
								<label class="text-sm font-medium">JavaScript Code</label>
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
								placeholder="Enter JavaScript code here...&#10;&#10;Example:&#10;await createOrUpdateArtifact('test.md', '# Hello World');"
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
							<pre
								class="flex-1 p-3 font-mono text-sm bg-card border border-border rounded-lg overflow-auto whitespace-pre-wrap"
							>${this.output || "No output yet"}</pre>
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
