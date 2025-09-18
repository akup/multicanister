#!/bin/bash

# Server Manager Script for Cluster API Configuration Server
# Usage: ./server_manager.sh {start|stop|restart|status}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/server.pid"
LOG_FILE="$SCRIPT_DIR/server.log"
VENV_DIR="$SCRIPT_DIR/venv"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if server is running
is_server_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            # PID file exists but process is dead
            rm -f "$PID_FILE"
        fi
    fi
    return 1
}

# Function to start the server
start_server() {
    if is_server_running; then
        print_warning "Server is already running (PID: $(cat $PID_FILE))"
        return 1
    fi

    print_status "Starting server..."

    # Check if virtual environment exists
    if [ ! -d "$VENV_DIR" ]; then
        print_error "Virtual environment not found. Please run: python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
        return 1
    fi

    # Activate virtual environment and start server
    cd "$SCRIPT_DIR"
    source "$VENV_DIR/bin/activate"
    
    # Start server in background and capture PID
    nohup python server.py > "$LOG_FILE" 2>&1 &
    local pid=$!
    
    # Save PID to file
    echo $pid > "$PID_FILE"
    
    # Wait a moment to check if server started successfully
    sleep 2
    if ps -p "$pid" > /dev/null 2>&1; then
        print_status "Server started successfully (PID: $pid)"
        print_status "Logs: $LOG_FILE"
        print_status "Server URL: http://localhost:8080"
    else
        print_error "Failed to start server. Check logs: $LOG_FILE"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Function to stop the server
stop_server() {
    if ! is_server_running; then
        print_warning "Server is not running"
        return 0
    fi

    local pid=$(cat "$PID_FILE")
    print_status "Stopping server (PID: $pid)..."
    
    # Try graceful shutdown first
    kill "$pid" 2>/dev/null
    
    # Wait for graceful shutdown
    local count=0
    while [ $count -lt 10 ] && ps -p "$pid" > /dev/null 2>&1; do
        sleep 1
        ((count++))
    done
    
    # Force kill if still running
    if ps -p "$pid" > /dev/null 2>&1; then
        print_warning "Server didn't stop gracefully, forcing shutdown..."
        kill -9 "$pid" 2>/dev/null
        sleep 1
    fi
    
    # Remove PID file
    rm -f "$PID_FILE"
    print_status "Server stopped"
}

# Function to restart the server
restart_server() {
    print_status "Restarting server..."
    stop_server
    sleep 2
    start_server
}

# Function to show server status
show_status() {
    if is_server_running; then
        local pid=$(cat "$PID_FILE")
        print_status "Server is running (PID: $pid)"
        print_status "Logs: $LOG_FILE"
        print_status "Server URL: http://localhost:8080"
        
        # Show recent log entries
        if [ -f "$LOG_FILE" ]; then
            echo ""
            print_status "Recent log entries:"
            tail -n 5 "$LOG_FILE" | sed 's/^/  /'
        fi
    else
        print_warning "Server is not running"
    fi
}

# Function to show logs
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        print_status "Showing server logs (press Ctrl+C to exit):"
        tail -f "$LOG_FILE"
    else
        print_warning "No log file found"
    fi
}

# Main script logic
case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the server"
        echo "  stop    - Stop the server"
        echo "  restart - Restart the server"
        echo "  status  - Show server status and recent logs"
        echo "  logs    - Show live server logs"
        echo ""
        echo "Files:"
        echo "  PID file: $PID_FILE"
        echo "  Log file: $LOG_FILE"
        exit 1
        ;;
esac 