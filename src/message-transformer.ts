import type { Message } from "@mariozechner/pi-ai";
import type { AppMessage } from "@mariozechner/pi-web-ui";
import type { NavigationMessage } from "./messages/NavigationMessage.js";
import { getSitegeistStorage } from "./storage/app-storage.js";

// Helper: Check if a message has toolCall blocks
function hasToolCalls(msg: Message): boolean {
	if (msg.role !== "assistant") return false;
	return msg.content.some((block) => block.type === "toolCall");
}

// Helper: Get all toolCall IDs from an assistant message
function getToolCallIds(msg: Message): Set<string> {
	const ids = new Set<string>();
	if (msg.role !== "assistant") return ids;

	for (const block of msg.content) {
		if (block.type === "toolCall") {
			ids.add(block.id);
		}
	}
	return ids;
}

// Helper: Check if a toolResult message matches the given tool call IDs
function isToolResultFor(msg: Message, toolCallIds: Set<string>): boolean {
	if (msg.role !== "toolResult") return false;
	return toolCallIds.has(msg.toolCallId);
}

// Reorder messages so assistant tool calls are immediately followed by their tool results
// This moves navigation and other user messages after the tool results
function reorderMessages(messages: Message[]): Message[] {
	const result: Message[] = [];
	let i = 0;

	while (i < messages.length) {
		const msg = messages[i];

		if (msg.role === "assistant" && hasToolCalls(msg)) {
			// Found assistant with tool calls
			result.push(msg);
			i++;

			// Collect tool call IDs from this assistant message
			const toolCallIds = getToolCallIds(msg);

			// Scan forward and collect messages until next assistant or end
			const toolResultMessages: Message[] = [];
			const otherMessages: Message[] = [];

			while (i < messages.length && messages[i].role !== "assistant") {
				const nextMsg = messages[i];

				if (isToolResultFor(nextMsg, toolCallIds)) {
					toolResultMessages.push(nextMsg);
				} else {
					otherMessages.push(nextMsg);
				}
				i++;
			}

			// Add tool result messages first, then other messages (like nav)
			result.push(...toolResultMessages);
			result.push(...otherMessages);
		} else {
			// Not an assistant with tool calls, just add it
			result.push(msg);
			i++;
		}
	}

	return result;
}

// Custom message transformer for browser extension
// Handles navigation messages and app-specific message types
export async function browserMessageTransformer(messages: AppMessage[]): Promise<Message[]> {
	const skillsRepo = getSitegeistStorage().skills;
	const transformed = [];

	for (const m of messages) {
		// Filter out UI-only messages
		if (m.role === "artifact" || m.role === "welcome") {
			continue;
		}

		// Filter non-LLM messages
		if (m.role !== "user" && m.role !== "assistant" && m.role !== "toolResult" && m.role !== "navigation") {
			continue;
		}

		if (m.role === "navigation") {
			const nav = m as NavigationMessage;
			const tabInfo = nav.tabId !== undefined ? ` (tab id: ${nav.tabId})` : "";

			// Load skills matching this navigation URL
			const skills = await skillsRepo.getSkillsForUrl(nav.url);
			let skillsInfo = "";
			if (skills.length > 0) {
				const skillNames = skills.map((s) => `${s.name}: ${s.shortDescription}`).join("\n");
				skillsInfo = `\nSkills: ${skillNames}`;
			} else {
				skillsInfo = "\nSkills: none found";
			}

			transformed.push({
				role: "user",
				content: `<browser-context>
✓ Navigation succeeded: ${nav.title}${tabInfo}
✓ URL: ${nav.url}
</browser-context>

<skills>
${skillsInfo}
</skills>

<instructions>
- READ THE SKILLS IMMEDIATELY BEFORE ANSWERING THE USER IF YOU HAVE NOT DONE SO ALREADY!
- DO NOT STOP - This is informational only. CONTINUE IMMEDIATELY with the next step of your multi-step workflow. This message does NOT mean you should wait for user input.
- DO NOT REPEAT THIS MESSAGE BACK TO THE USER!
</instructions>`,
			} as Message);
		} else if (m.role === "user") {
			const { attachments, ...rest } = m as any;
			transformed.push(rest as Message);
		} else {
			transformed.push(m as Message);
		}
	}

	return reorderMessages(transformed);
}
