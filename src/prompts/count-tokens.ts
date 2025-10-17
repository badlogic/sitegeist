#!/usr/bin/env tsx
/**
 * Count tokens in system prompts using Anthropic's token counter API
 */
import {
	ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RO,
	ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RW,
	ARTIFACTS_TOOL_DESCRIPTION,
	ATTACHMENTS_RUNTIME_DESCRIPTION,
	EXTRACT_DOCUMENT_DESCRIPTION,
} from "../../../pi-mono/packages/web-ui/dist/prompts/prompts.js";
import {
	ASK_USER_WHICH_ELEMENT_TOOL_DESCRIPTION,
	BROWSERJS_RUNTIME_PROVIDER_DESCRIPTION,
	NATIVE_INPUT_EVENTS_DESCRIPTION,
	NAVIGATE_RUNTIME_PROVIDER_DESCRIPTION,
	NAVIGATE_TOOL_DESCRIPTION,
	REPL_TOOL_DESCRIPTION,
	SKILL_TOOL_DESCRIPTION,
	SYSTEM_PROMPT,
} from "./prompts.js";

// Runtime provider descriptions with labels for logging
const runtimeProviders = [
	{ name: "ARTIFACTS_RW", description: ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RW },
	{ name: "ARTIFACTS_RO", description: ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RO },
	{ name: "ATTACHMENTS", description: ATTACHMENTS_RUNTIME_DESCRIPTION },
	{ name: "NATIVE_INPUT_EVENTS", description: NATIVE_INPUT_EVENTS_DESCRIPTION },
	{ name: "BROWSERJS", description: BROWSERJS_RUNTIME_PROVIDER_DESCRIPTION },
	{ name: "NAVIGATE", description: NAVIGATE_RUNTIME_PROVIDER_DESCRIPTION },
];

// @ts-expect-error: ensure env var exists
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
	console.error("Error: ANTHROPIC_API_KEY environment variable not set");
	// @ts-expect-error: exit process
	process.exit(1);
}

// Tool definitions matching sidepanel.ts
export const TOOL_DEFINITIONS = [
	{
		name: "artifacts",
		description: ARTIFACTS_TOOL_DESCRIPTION([
			ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RO,
			ATTACHMENTS_RUNTIME_DESCRIPTION,
		]),
		input_schema: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: ["createOrUpdate", "get", "delete", "list"],
					description: "Action to perform",
				},
				filename: {
					type: "string",
					description: "Filename of the artifact",
				},
				content: {
					type: "string",
					description: "Content of the artifact. For binary files, provide a base64-encoded string.",
				},
				mimeType: {
					type: "string",
					description: "MIME type of the artifact (e.g., 'image/png' for PNG images). Required for binary files.",
				},
			},
			required: ["action"],
		},
	},
	{
		name: "navigate",
		description: NAVIGATE_TOOL_DESCRIPTION,
		input_schema: {
			type: "object",
			properties: {
				url: {
					type: "string",
					description: "URL to navigate to (in current tab or new tab if newTab is true)",
				},
				newTab: {
					type: "boolean",
					description: "Set to true to open URL in a new tab instead of current tab",
				},
				history: {
					type: "string",
					enum: ["back", "forward"],
					description: "Navigate browser history (back or forward)",
				},
				listTabs: {
					type: "boolean",
					description: "Set to true to list all open tabs",
				},
				switchToTab: {
					type: "number",
					description: "Tab ID to switch to (get IDs from listTabs)",
				},
			},
		},
	},
	{
		name: "ask_user_which_element",
		description: ASK_USER_WHICH_ELEMENT_TOOL_DESCRIPTION,
		input_schema: {
			type: "object",
			properties: {
				message: {
					type: "string",
					description:
						"Optional message to show the user while they select the element (e.g., 'Please click the table you want to extract')",
				},
			},
		},
	},
	{
		name: "repl",
		description: REPL_TOOL_DESCRIPTION(runtimeProviders.map((p) => p.description)),
		input_schema: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description:
						"Brief title describing what the code snippet tries to achieve in active form, e.g. 'Calculating sum'",
				},
				code: {
					type: "string",
					description: "JavaScript code to execute",
				},
			},
			required: ["title", "code"],
		},
	},
	{
		name: "skill",
		description: SKILL_TOOL_DESCRIPTION,
		input_schema: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: ["get", "list", "create", "update", "patch", "delete"],
					description: "Action to perform",
				},
				name: {
					type: "string",
					description: "Skill name",
				},
				url: {
					type: "string",
					description: "URL to filter skills by (for list action)",
				},
				includeLibraryCode: {
					type: "boolean",
					description: "Include library code in response (for get action)",
				},
				data: {
					type: "object",
					description: "Skill data (for create/update actions)",
				},
				patches: {
					type: "object",
					description: "Patches to apply (for patch action)",
				},
			},
			required: ["action"],
		},
	},
	{
		name: "extract_document",
		description: EXTRACT_DOCUMENT_DESCRIPTION,
		input_schema: {
			type: "object",
			properties: {
				url: {
					type: "string",
					description: "URL of the document to extract text from (PDF, DOCX, XLSX, or PPTX)",
				},
			},
			required: ["url"],
		},
	},
];

interface TokenCountResponse {
	input_tokens: number;
}

async function countTokens(system: string, message?: string, tools?: any[]): Promise<number> {
	const body: any = {
		model: "claude-3-5-sonnet-20241022",
		system,
		messages: [
			{
				role: "user",
				content: message || "test",
			},
		],
	};

	if (tools && tools.length > 0) {
		body.tools = tools;
	}

	const response = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": ANTHROPIC_API_KEY,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`API error: ${response.status} ${error}`);
	}

	const data = (await response.json()) as TokenCountResponse;
	return data.input_tokens;
}

async function main() {
	console.log("Counting tokens in prompts...\n");
	console.log("NOTE: These counts reflect base token usage.");
	console.log("Actual production usage may be higher due to:");
	console.log("- Prompt caching overhead (reported as cache writes)");
	console.log("- Additional message context and metadata\n");

	// Tool definitions match actual tools used in sidepanel.ts
	const tools = TOOL_DEFINITIONS;

	console.log("=== System Prompt ===");
	const systemTokens = await countTokens(SYSTEM_PROMPT);
	console.log(`SYSTEM_PROMPT: ${systemTokens.toLocaleString()} tokens\n`);

	console.log("=== System + Tools ===");
	const systemPlusToolsTokens = await countTokens(SYSTEM_PROMPT, "hi", tools);
	console.log(`SYSTEM_PROMPT + all tools: ${systemPlusToolsTokens.toLocaleString()} tokens`);
	console.log(`Tools overhead: ${(systemPlusToolsTokens - systemTokens).toLocaleString()} tokens\n`);

	console.log("=== Individual Tool Descriptions ===");
	for (const tool of tools) {
		const tokens = await countTokens(tool.description);
		console.log(`${tool.name}: ${tokens.toLocaleString()} tokens`);
	}

	console.log("\n=== Runtime Provider Descriptions ===");
	for (const provider of runtimeProviders) {
		const tokens = await countTokens(provider.description);
		console.log(`${provider.name}: ${tokens.toLocaleString()} tokens`);
	}

	console.log(`\n=== Total ===`);
	console.log(`Complete agent setup: ${systemPlusToolsTokens.toLocaleString()} tokens`);
}

main();
