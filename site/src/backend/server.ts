import cors from "cors";
import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EmailSignup, ErrorResponse, SignupRequest, SignupResponse } from "../shared/types.js";
import { FileStore } from "./storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const DATA_DIR = process.env.DATA_DIR || "./data";
const isDevelopment = process.env.NODE_ENV !== "production";

// Email validation regex (basic)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function startServer() {
	// Initialize email storage
	const signupsPath = path.join(DATA_DIR, "signups.json");
	const signupsStore = new FileStore<EmailSignup[] | string>(signupsPath);

	// Initialize signups array if it doesn't exist
	if (!signupsStore.getItem("signups")) {
		signupsStore.setItem("signups", []);
	}

	console.log(`✓ Initialized email storage at ${signupsPath}`);

	// Create Express app
	const app = express();

	// Middleware
	app.use(cors());
	app.use(express.json());

	// API routes

	// Health check
	app.get("/api/health", (_req, res) => {
		res.json({
			status: "healthy",
			timestamp: new Date().toISOString(),
		});
	});

	// Email signup
	app.post("/api/signup", (req: Request<unknown, SignupResponse | ErrorResponse, SignupRequest>, res: Response<SignupResponse | ErrorResponse>) => {
		try {
			const { email } = req.body;

			// Validate email format
			if (!email || typeof email !== "string") {
				res.status(400).json({ error: "Email is required" });
				return;
			}

			if (!EMAIL_REGEX.test(email)) {
				res.status(400).json({ error: "Invalid email format" });
				return;
			}

			// Get current signups array
			const signups = (signupsStore.getItem("signups") as EmailSignup[]) || [];

			// Check if email already exists
			const existingSignup = signups.find((signup) => signup.email.toLowerCase() === email.toLowerCase());

			if (existingSignup) {
				// Don't reveal that email is already registered - return success
				console.log(`✓ Duplicate signup attempt: ${email}`);
				res.json({
					success: true,
				});
				return;
			}

			// Create new signup
			const signup: EmailSignup = {
				email: email.toLowerCase(),
				timestamp: new Date().toISOString(),
				notified: false,
			};

			// Add to array and save
			signups.push(signup);
			signupsStore.setItem("signups", signups);

			console.log(`✓ New signup: ${signup.email}`);

			res.json({
				success: true,
			});
		} catch (error) {
			console.error("Signup error:", error);
			res.status(500).json({ error: "Internal server error" });
		}
	});

	// In production, serve static files from dist/frontend
	if (!isDevelopment) {
		const staticPath = path.resolve(__dirname, "../../dist/frontend");
		console.log(`✓ Serving static files from ${staticPath}`);

		app.use(express.static(staticPath));

		// SPA fallback - serve index.html for all non-API routes
		app.use((_req, res) => {
			res.sendFile(path.join(staticPath, "index.html"));
		});
	} else {
		// 404 handler for dev mode (API only)
		app.use((_req: Request, res: Response) => {
			res.status(404).json({ error: "Not found" });
		});
	}

	// Start server
	const server = app.listen(PORT, () => {
		console.log(`✓ Server listening on port ${PORT}`);
		console.log(`  Health: http://localhost:${PORT}/api/health`);
		if (isDevelopment) {
			console.log(`  API: http://localhost:${PORT}/api`);
		} else {
			console.log(`  Frontend: http://localhost:${PORT}`);
		}
	});

	// Graceful shutdown
	const shutdown = () => {
		console.log("\n✓ Shutting down gracefully...");
		server.close(() => {
			console.log("✓ Server closed");
			process.exit(0);
		});

		// Force shutdown after 5 seconds
		setTimeout(() => {
			console.error("✗ Forced shutdown");
			process.exit(1);
		}, 5000);
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}

startServer().catch((err) => {
	console.error("Failed to start server:", err);
	process.exit(1);
});
