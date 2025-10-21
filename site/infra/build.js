import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function build() {
	// Build frontend (this clears dist/)
	console.log("Building frontend...");
	await execAsync("npx vite build -c infra/vite.config.ts");

	// Build backend (into dist/backend + dist/shared)
	console.log("Building backend...");
	await execAsync("npx tsc -p tsconfig.backend.json");

	console.log("✓ Build complete");
}

build().catch((err) => {
	console.error("Build failed:", err);
	process.exit(1);
});
