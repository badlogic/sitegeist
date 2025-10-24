import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import type { EmailSignup } from "../shared/types.js";
import { createApiRouter } from "./api-server.js";
import { createAuthMiddleware } from "./auth-middleware.js";
import { createHandlers } from "./handlers.js";
import { SettingsManager } from "./settings.js";
import { FileStore } from "./storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const DATA_DIR = process.env.DATA_DIR || "./data";
const isDevelopment = process.env.NODE_ENV !== "production";

async function startServer() {
	// Initialize email storage
	const signupsPath = path.join(DATA_DIR, "signups.json");
	const signupsStore = new FileStore<EmailSignup[] | string>(signupsPath);

	// Initialize signups array if it doesn't exist
	if (!signupsStore.getItem("signups")) {
		signupsStore.setItem("signups", []);
	}

	console.log(`✓ Initialized email storage at ${signupsPath}`);

	// Initialize settings
	const settingsPath = path.join(DATA_DIR, "settings.json");
	const settings = new SettingsManager(settingsPath);

	if (settings.isSetupRequired()) {
		console.log("⚠ Setup required - visit /admin to set password");
	} else {
		console.log("✓ Settings loaded");
	}

	// Create API handlers
	const handlers = createHandlers(signupsStore, settings);

	// Create Express app
	const app = express();

	// Trust proxy - we're behind Caddy reverse proxy
	app.set("trust proxy", 1);

	// Middleware
	app.use(cors());
	app.use(cookieParser());
	app.use(express.json());

	// Rate limiter for login endpoint
	const loginLimiter = rateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 5, // Limit each IP to 5 requests per windowMs
		message: "Too many login attempts. Please try again in 15 minutes.",
		standardHeaders: true,
		legacyHeaders: false,
	});

	// Apply rate limiter to login endpoint
	app.use("/api/login", loginLimiter);

	// Auth middleware (protects admin routes) - uses lazy evaluation
	app.use(
		"/api",
		createAuthMiddleware(() => settings.getIronSecret()),
	);

	// API routes (auto-generated from handlers)
	const apiRouter = express.Router();
	createApiRouter(apiRouter, handlers);

	app.use("/api", apiRouter);

	// In production, serve static files from dist/frontend
	if (!isDevelopment) {
		const staticPath = path.resolve(__dirname, "../../dist/frontend");
		console.log(`✓ Serving static files from ${staticPath}`);

		app.use(express.static(staticPath));

		// Admin SPA fallback
		app.get(/^\/admin(\/.*)?$/, (_req, res) => {
			res.sendFile(path.join(staticPath, "admin/index.html"));
		});

		// Landing page SPA fallback - serve index.html for all other non-API routes
		app.use((_req, res) => {
			res.sendFile(path.join(staticPath, "index.html"));
		});
	} else {
		// 404 handler for dev mode (API only)
		app.use((_req, res) => {
			res.status(404).json({ error: "Not found" });
		});
	}

	// Start server
	app.listen(PORT, () => {
		console.log(`✓ Server listening on port ${PORT}`);
		console.log(`  Health: http://localhost:${PORT}/api/health`);
		if (isDevelopment) {
			console.log(`  API: http://localhost:${PORT}/api`);
		} else {
			console.log(`  Frontend: http://localhost:${PORT}`);
		}
	});

	// Instant shutdown for fast redeploys
	const shutdown = () => {
		console.log("\n✓ Shutting down...");
		process.exit(0);
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}

startServer().catch((err) => {
	console.error("Failed to start server:", err);
	process.exit(1);
});
