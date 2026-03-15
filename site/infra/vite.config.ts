import { defineConfig } from "vite";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [tailwindcss()],
	root: path.resolve(__dirname, "../src/frontend"),
	publicDir: path.resolve(__dirname, "../src/frontend/public"),
	server: {
		port: 8080,
		host: "0.0.0.0",
		fs: {
			allow: [path.resolve(__dirname, "..")],
		},
	},
	build: {
		outDir: path.resolve(__dirname, "../dist"),
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: path.resolve(__dirname, "../src/frontend/index.html"),
				install: path.resolve(__dirname, "../src/frontend/install.html"),
			},
		},
	},
});
