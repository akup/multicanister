#!/bin/bash

# Development server with auto-reload
# Usage: ./dev.sh

echo "🚀 Starting development server with auto-reload..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating one..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/upgrade dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Start development server
echo "🔥 Starting auto-reload server..."
python dev_server.py 