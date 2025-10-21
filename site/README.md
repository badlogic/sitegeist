# Sitegeist Landing Page

Email signup landing page for Sitegeist with backend storage.

## Features

- 🎨 Beautiful landing page with orb animation (from docs/sitegeist.html)
- 📧 Email signup form with backend storage
- 🗄️ FileStore-based JSON storage (from doxietwo scaffold)
- ⚡ Vite for fast frontend development
- 🔧 TypeScript backend and frontend

## Development

```bash
# Install dependencies
npm install

# Start development server (backend + frontend with HMR)
npm run dev
```

- Backend API: http://localhost:3000
- Frontend: http://localhost:8080

## Production Build

```bash
# Build for production
npm run build

# Run production server (serves static files + API)
npm run prod
```

Production server runs on http://localhost:3000 (serves both frontend and API)

## Project Structure

```
site/
├── src/
│   ├── backend/
│   │   ├── server.ts          # Express server with signup endpoint
│   │   └── storage.ts         # FileStore for email storage
│   ├── frontend/
│   │   ├── index.html         # Landing page with orb animation
│   │   ├── main.ts            # Form handling
│   │   └── styles.css         # Tailwind imports
│   └── shared/
│       └── types.ts           # Shared TypeScript types
├── infra/
│   ├── build.js               # Build script
│   └── vite.config.ts         # Vite configuration
├── data/                      # Created at runtime
│   └── signups.json          # Email signups storage
└── dist/                      # Build output
    ├── backend/              # Compiled backend
    └── frontend/             # Built frontend assets
```

## API Endpoints

### POST /api/signup
Submit email for signup.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "id": "1730000000000-abc123"
}
```

**Error Responses:**
- 400: Invalid email format
- 409: Email already registered
- 500: Internal server error

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-21T..."
}
```

## Data Storage

Emails are stored in `data/signups.json`:

```json
{
  "1730000000000-abc123": {
    "id": "1730000000000-abc123",
    "email": "user@example.com",
    "timestamp": "2025-10-21T12:00:00.000Z"
  }
}
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `DATA_DIR` - Data directory for storage (default: ./data)
- `NODE_ENV` - Environment mode (production/development)

## Tech Stack

- **Frontend:** Vite, TypeScript, Tailwind CSS v4, Three.js (orb animation)
- **Backend:** Express, TypeScript, CORS
- **Storage:** FileStore (JSON-based)
- **Build:** esbuild (via Vite), TypeScript compiler

## Adapted from doxietwo scaffold

This project uses a simplified version of the doxietwo scaffold:
- Kept: FileStore, build scripts, Vite config, run.sh structure
- Removed: JNN, DirectoryStore, API auto-generation, complex business logic
- Added: Email signup form, landing page design from docs/sitegeist.html
