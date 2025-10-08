import type { StorageBackend } from "@mariozechner/pi-web-ui";
import { minimatch } from "minimatch";

// Skill interface - just TypeScript, no TypeBox needed for internal data structures
export interface Skill {
	name: string;
	domainPatterns: string[]; // Array of glob patterns
	shortDescription: string;
	description: string;
	createdAt: string;
	lastUpdated: string;
	examples: string;
	library: string;
}

/**
 * Repository for managing site skills.
 */
export class SkillsRepository {
	private backend: StorageBackend;
	private readonly prefix = "skills:";

	constructor(backend: StorageBackend) {
		this.backend = backend;
	}

	/**
	 * Get skill by name.
	 */
	async getSkill(name: string): Promise<Skill | null> {
		const key = `${this.prefix}${name}`;
		return await this.backend.get<Skill>(key);
	}

	/**
	 * Save or update a skill.
	 */
	async saveSkill(skill: Skill): Promise<void> {
		const key = `${this.prefix}${skill.name}`;
		await this.backend.set(key, skill);
	}

	/**
	 * List all skills matching current URL (or all if no URL provided).
	 */
	async listSkills(currentUrl?: string): Promise<Array<{ name: string; domainPatterns: string[]; shortDescription: string }>> {
		const keys = await this.backend.keys();
		const skillKeys = keys.filter((k) => k.startsWith(this.prefix));

		const skills = [];
		for (const key of skillKeys) {
			const skill = await this.backend.get<Skill>(key);
			if (skill) {
				// Filter by domain if URL provided
				if (currentUrl && !this.matchesAnyPattern(currentUrl, skill.domainPatterns)) {
					continue;
				}
				skills.push({
					name: skill.name,
					domainPatterns: skill.domainPatterns,
					shortDescription: skill.shortDescription,
				});
			}
		}
		return skills;
	}

	/**
	 * Get all skills matching a URL.
	 */
	async getSkillsForUrl(url: string): Promise<Skill[]> {
		const keys = await this.backend.keys();
		const skillKeys = keys.filter((k) => k.startsWith(this.prefix));

		const matchingSkills = [];
		for (const key of skillKeys) {
			const skill = await this.backend.get<Skill>(key);
			if (skill && this.matchesAnyPattern(url, skill.domainPatterns)) {
				matchingSkills.push(skill);
			}
		}
		return matchingSkills;
	}

	/**
	 * Delete skill by name.
	 */
	async deleteSkill(name: string): Promise<void> {
		const key = `${this.prefix}${name}`;
		await this.backend.delete(key);
	}

	/**
	 * Check if URL matches any of the domain patterns using glob matching.
	 * Patterns support:
	 * - youtube.com (exact domain)
	 * - youtube.com/* (domain with any path)
	 * - youtube.com/watch* (specific path prefix)
	 * - *.youtube.com (any subdomain)
	 * - youtu.be (short URL domain)
	 */
	matchesAnyPattern(url: string, patterns: string[]): boolean {
		try {
			const urlObj = new URL(url);
			const hostname = urlObj.hostname;
			const path = urlObj.pathname;

			// Test against all patterns
			for (const pattern of patterns) {
				// Split pattern into domain and path parts
				const parts = pattern.split("/");
				const domainPattern = parts[0];
				const pathPattern = parts.length > 1 ? "/" + parts.slice(1).join("/") : "";

				// Normalize both hostname and pattern by removing www. prefix
				const normalizedHostname = hostname.replace(/^www\./, "");
				const normalizedPattern = domainPattern.replace(/^www\./, "");

				// Match domain part
				const domainMatches = minimatch(normalizedHostname, normalizedPattern, { nocase: true });

				// If no path pattern specified, just match domain
				if (!pathPattern || pathPattern === "/") {
					if (domainMatches) return true;
				} else {
					// Match both domain and path
					const pathMatches = minimatch(path, pathPattern, { nocase: true });
					if (domainMatches && pathMatches) return true;
				}
			}

			return false;
		} catch {
			return false;
		}
	}
}
