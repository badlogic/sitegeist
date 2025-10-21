import { defineConfig } from 'vite';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';

const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? process.env.PORT ?? 8080);
const API_PORT = Number(process.env.API_PORT ?? 3000);

export default defineConfig({
  plugins: [tailwindcss()],
  root: path.resolve(__dirname, '../src/frontend'),
  publicDir: path.resolve(__dirname, '../src/frontend/public'),
  envDir: path.resolve(__dirname, '..'),
  server: {
    port: FRONTEND_PORT,
    host: '0.0.0.0',
    proxy: {
      '^/api/': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: FRONTEND_PORT,
    host: '0.0.0.0',
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/frontend'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, '../src/frontend/index.html'),
    },
  },
});
