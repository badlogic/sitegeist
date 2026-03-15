#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

SERVER=slayer.marioslab.io
SERVER_DIR=/home/badlogic/sitegeist.ai

case "$1" in
dev)
    echo "Starting dev server at http://localhost:8080"
    npx vite --config infra/vite.config.ts
    ;;

build)
    echo "Building static site..."
    npx vite build --config infra/vite.config.ts
    echo "Done. Output in dist/"
    ;;

deploy)
    npm install
    npx vite build --config infra/vite.config.ts

    echo "Uploading to $SERVER..."
    ssh $SERVER "mkdir -p $SERVER_DIR/uploads"
    rsync -avz --delete dist/ $SERVER:$SERVER_DIR/dist/
    echo "Deployed."
    ;;

*)
    echo "Usage: $0 {dev|build|deploy}"
    exit 1
    ;;
esac
