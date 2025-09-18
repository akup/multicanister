#!/usr/bin/env python3
"""
Development server with auto-reload functionality
Monitors file changes and restarts the server automatically
"""

import os
import sys
import time
import signal
import subprocess
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ServerReloader(FileSystemEventHandler):
    """Handles file system events and restarts the server"""
    
    def __init__(self, server_script="server.py"):
        self.server_script = server_script
        self.server_process = None
        self.restart_pending = False
        self.start_server()
    
    def start_server(self):
        """Start the server process"""
        if self.server_process:
            self.stop_server()
        
        logger.info("Starting server...")
        try:
            self.server_process = subprocess.Popen(
                [sys.executable, self.server_script],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True
            )
            logger.info(f"Server started with PID: {self.server_process.pid}")
        except Exception as e:
            logger.error(f"Failed to start server: {e}")
    
    def stop_server(self):
        """Stop the server process"""
        if self.server_process:
            logger.info("Stopping server...")
            try:
                self.server_process.terminate()
                self.server_process.wait(timeout=5)
                logger.info("Server stopped")
            except subprocess.TimeoutExpired:
                logger.warning("Server didn't stop gracefully, forcing...")
                self.server_process.kill()
            except Exception as e:
                logger.error(f"Error stopping server: {e}")
            finally:
                self.server_process = None
    
    def restart_server(self):
        """Restart the server"""
        logger.info("Restarting server due to file changes...")
        self.start_server()
    
    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return
        
        # Only watch Python files and config files
        if not (event.src_path.endswith('.py') or 
                event.src_path.endswith('.yaml') or 
                event.src_path.endswith('.json')):
            return
        
        # Ignore temporary files
        if any(part.startswith('.') for part in event.src_path.split('/')):
            return
        
        logger.info(f"File changed: {event.src_path}")
        
        # Debounce rapid changes
        if not self.restart_pending:
            self.restart_pending = True
            # Wait a bit to avoid multiple restarts for rapid changes
            time.sleep(0.5)
            self.restart_server()
            self.restart_pending = False

def main():
    """Main function to run the development server"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Development server with auto-reload')
    parser.add_argument('--host', default='localhost', help='Host to bind to (default: localhost)')
    parser.add_argument('--port', type=int, default=8080, help='Port to bind to (default: 8080)')
    parser.add_argument('--watch', default='.', help='Directory to watch (default: current directory)')
    
    args = parser.parse_args()
    
    # Set environment variables for the server
    os.environ['DEV_MODE'] = 'true'
    
    # Create the reloader
    reloader = ServerReloader()
    
    # Set up file watching
    observer = Observer()
    event_handler = reloader
    observer.schedule(event_handler, args.watch, recursive=True)
    observer.start()
    
    logger.info(f"Development server started with auto-reload")
    logger.info(f"Watching directory: {os.path.abspath(args.watch)}")
    logger.info(f"Server URL: http://{args.host}:{args.port}")
    logger.info("Press Ctrl+C to stop")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down development server...")
        observer.stop()
        reloader.stop_server()
    
    observer.join()
    logger.info("Development server stopped")

if __name__ == "__main__":
    main() 