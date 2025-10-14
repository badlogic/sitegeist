import { Button, icon, Switch } from "@mariozechner/mini-lit";
import { getModel } from "@mariozechner/pi-ai";
import { setAppStorage } from "@mariozechner/pi-web-ui";
import { html, render } from "lit";
import { ArrowLeft, Bug, MousePointer2, Play, Sparkles } from "lucide";
import "./debug/BrowserReplPanel.js";
import "./debug/ReplPanel.js";
import { SitegeistAppStorage } from "./storage/app-storage.js";
import { selectElementTool } from "./tools/select-element.js";

interface TestPrompt {
	name: string;
	steps: string[];
}

const models = [
	getModel("anthropic", "claude-sonnet-4-5-20250929"),
	getModel("openai", "gpt-5-codex"),
	getModel("google", "gemini-2.5-pro"),
	getModel("openrouter", "z-ai/glm-4.6")
]

// Initialize AppStorage so tools relying on Sitegeist storage can operate in debug page
const storage = new SitegeistAppStorage();
setAppStorage(storage);

const TEST_PROMPTS: TestPrompt[] = [
	{
		name: "Multi-step calculation",
		steps: ["Calculate the sum of numbers from 1 to 100", "Now multiply that result by 3", "Create a bar chart showing the original sum and the multiplied value"],
	},
	{
		name: "HTML artifact iteration",
		steps: [
			"Create an HTML artifact with a red background and 'Hello World' text",
			"Change the background to blue",
			"Add a button that shows an alert when clicked",
		],
	},
	{
		name: "Data processing multi-step",
		steps: [
			"Generate an array of 20000 random numbers between 1 and 100. Calculate the mean, median, and standard deviation. Create a Chart.js visualization showing the distribution. Use a separate tool call for each step.",
		],
	},
	{
		name: "Data processing single step",
		steps: [
			"Generate an array of 20000 random numbers between 1 and 100. Calculate the mean, median, and standard deviation. Create a Chart.js visualization showing the distribution.",
		],
	},
	{
		name: "Web scraping workflow",
		steps: [
			"Search Google for 'JavaScript tutorials'",
			"Extract the first 3 result titles",
			"Write them to a tutorials.md artifact with proper markdown formatting",
		],
	},
];

const renderDebugPage = async () => {
	// Get current debugger mode state
	const stored = await chrome.storage.local.get("debuggerMode");
	let debuggerMode = stored.debuggerMode || false;

	const updateDebuggerMode = async (enabled: boolean) => {
		debuggerMode = enabled;
		await chrome.storage.local.set({ debuggerMode: enabled });
		renderDebugPage(); // Re-render to update UI
	};

	const triggerSelectElement = async () => {
		try {
			const result = await selectElementTool.execute("debug-test", {});
			console.log("[debug] Select element result:", result);
			alert(`Selected element:\n${result.output}`);
		} catch (error) {
			console.error("[debug] Select element error:", error);
			alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
		}
	};

	const debugHtml = html`
		<div class="w-full h-full flex flex-col bg-background text-foreground overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
				<div class="flex items-center gap-2">
					${Button({
						variant: "ghost",
						size: "sm",
						children: icon(ArrowLeft, "sm"),
						onClick: () => {
							window.location.href = "./sidepanel.html";
						},
						title: "Back to chat",
					})}
					<span class="text-sm font-semibold">Debug</span>
					${Button({
						variant: "ghost",
						size: "sm",
						children: html`<span class="flex items-center gap-1.5">${icon(Sparkles, "xs")} <span class="text-xs">Icons</span></span>`,
						onClick: () => {
							window.location.href = "./icons.html";
						},
						title: "Generate extension icons",
					})}
				</div>
				<div class="flex items-center gap-2">
					${icon(Bug, "sm")}
					<span class="text-xs text-muted-foreground">Debugger Tool</span>
					${Switch(
						debuggerMode,
						(checked: boolean) => {
							updateDebuggerMode(checked);
						},
						undefined,
						false,
						"",
					)}
				</div>
			</div>

			<!-- Debug content -->
			<div class="flex-1 overflow-auto p-4">
				<div class="space-y-6">
					<!-- Element Picker Tool Section -->
					<div>
						<h2 class="text-lg font-semibold mb-3">Element Picker Tool</h2>
						<div class="border border-border rounded-lg bg-card p-4">
							<p class="text-sm text-muted-foreground mb-3">
								Manually trigger the select_element tool to test element picking on the active tab.
							</p>
							${Button({
								variant: "outline",
								size: "md",
								children: html`<span class="flex items-center gap-2"
									>${icon(MousePointer2, "sm")} <span>Launch Element Picker</span></span
								>`,
								onClick: triggerSelectElement,
								title: "Open element picker on active tab",
							})}
						</div>
					</div>

					<!-- REPL Panel Section -->
					<div>
						<h2 class="text-lg font-semibold mb-3">JavaScript REPL</h2>
						<div class="border border-border rounded-lg overflow-hidden" style="height: 600px;">
							<repl-panel></repl-panel>
						</div>
					</div>

					<!-- Browser JavaScript Panel Section -->
					<div>
						<h2 class="text-lg font-semibold mb-3">Browser JavaScript</h2>
						<div class="border border-border rounded-lg overflow-hidden" style="height: 600px;">
							<browser-repl-panel></browser-repl-panel>
						</div>
					</div>

					<!-- Test Prompts Section -->
					<div>
						<h2 class="text-lg font-semibold mb-3">Test Prompts</h2>
						<div class="space-y-3">
							${TEST_PROMPTS.map(
								(test) => html`
									<div class="border border-border rounded-lg bg-card overflow-hidden">
										<div class="p-3 bg-accent/30">
											<div class="font-medium text-sm">${test.name}</div>
										</div>
										<div class="p-3 space-y-2">
											${test.steps.map(
												(step, i) => html`
													<div class="flex gap-2 text-sm text-muted-foreground">
														<span class="text-xs font-mono shrink-0">${i + 1}.</span>
														<span>${step}</span>
													</div>
												`,
											)}
										</div>
										<div class="p-3 pt-0 flex gap-2 flex-wrap">
											${models.map(
														(model) => html`
															${Button({
																variant: "outline",
																size: "sm",
																children: html`<span class="flex items-center gap-1.5"
																	>${icon(Play, "xs")} <span class="text-xs">${model.name}</span></span
																>`,
																onClick: () => {
																	const encodedSteps = encodeURIComponent(JSON.stringify(test.steps));
																	window.location.href = `./sidepanel.html?teststeps=${encodedSteps}&provider=${encodeURIComponent(
																		model.provider,
																	)}&model=${encodeURIComponent(model.id)}`;
																},
																title: `Run with ${model.name}`,
															})}
														`,
													)
												}
										</div>
									</div>
								`,
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	`;

	render(debugHtml, document.body);
};

// Keyboard shortcut to go back
window.addEventListener("keydown", (e) => {
	if ((e.metaKey || e.ctrlKey) && e.key === "u") {
		e.preventDefault();
		window.location.href = "./sidepanel.html";
	}
});

renderDebugPage();
