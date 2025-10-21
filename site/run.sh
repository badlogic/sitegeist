#!/bin/bash

sync_files() {
    echo "Syncing files to $SERVER..."
    rsync -avz \
      --include="dist/***" \
      --include="infra/***" \
      --include="run.sh" \
      --include="package-lock.json" \
      --include="package.json" \
      --exclude="*" \
      --delete \
      ./ $SERVER:$SERVER_DIR/
}

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

SERVER=slayer.marioslab.io
SERVER_DIR=/home/badlogic/sitegeist.ai

case "$1" in
dev)
    echo "Starting development environment..."
    echo "Backend API: http://localhost:3000"
    echo "Frontend: http://localhost:8080"
    echo ""

    # Create data directory if it doesn't exist
    mkdir -p data

    # Start backend in background
    npx tsx watch src/backend/server.ts &
    BACKEND_PID=$!

    # Start frontend dev server
    npx vite --config infra/vite.config.ts --port 8080 --clearScreen false &
    VITE_PID=$!

    # Cleanup function
    cleanup() {
        echo -e "\nStopping development servers..."

        # Kill backend
        kill $BACKEND_PID 2>/dev/null || true

        # Kill frontend
        kill $VITE_PID 2>/dev/null || true

        exit 0
    }

    trap cleanup INT TERM

    # Wait for either process (compatible with macOS bash)
    wait
    ;;

build)
    echo "Building for production..."

    # Build frontend
    echo "Building frontend with Vite..."
    npx vite build --config infra/vite.config.ts

    # Build backend
    echo "Building backend with TypeScript..."
    npx tsc --project tsconfig.backend.json

    echo "✅ Build complete!"
    ;;

deploy)
    echo "Building for production..."

    # Install dependencies
    npm install

    # Build frontend
    echo "Building frontend with Vite..."
    npx vite build --config infra/vite.config.ts

    # Build backend
    echo "Building backend with TypeScript..."
    npx tsc --project tsconfig.backend.json

    sync_files

    echo "Restarting services on remote server..."
    ssh $SERVER "cd $SERVER_DIR && ./run.sh stop && ./run.sh prod"

    echo "✅ Deployed successfully!"
    echo ""
    echo "Streaming logs from remote server (Ctrl+C to exit)..."
    ssh -t $SERVER "cd $SERVER_DIR && ./run.sh logs"
    ;;

prod)
    echo "Starting production server..."
    docker compose -f infra/docker-compose.yml up -d --build
    ;;

stop)
    echo "Stopping services..."
    docker compose -f infra/docker-compose.yml down
    ;;

logs)
    docker compose -f infra/docker-compose.yml logs -f
    ;;
logs-remote)
    echo "Streaming logs from remote server..."
    ssh -t $SERVER "cd $SERVER_DIR && ./run.sh logs"
    ;;
sync)
    echo "Syncing files to remote server..."
    sync_files
    echo "✅ Synced successfully"
    ;;

*)
    echo "Usage: $0 {dev|build|deploy|prod|stop|logs|logs-remote|sync}"
    echo ""
    echo "  dev          - Start local development (backend + frontend with hot reload)"
    echo "  build        - Build frontend and backend for production (locally)"
    echo "  deploy       - Build, deploy to server, and stream logs"
    echo "  prod         - Start production Docker containers (on server)"
    echo "  stop         - Stop Docker containers"
    echo "  logs         - Show Docker logs (local)"
    echo "  logs-remote  - Stream logs from remote server"
    echo "  sync         - Sync files to remote server (no restart)"
    exit 1
    ;;
esac
