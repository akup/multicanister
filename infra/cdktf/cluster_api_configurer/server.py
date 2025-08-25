#!/usr/bin/env python3
"""
Cluster API Configuration Server
A simple HTTP webserver that accepts JSON configuration with region parameter
"""

import json
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import sys
from typing import Dict, Any
from config_handler import ConfigurationHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ClusterAPIHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the Cluster API Configuration server"""
    
    def __init__(self, *args, **kwargs):
        self.config_handler = ConfigurationHandler()
        super().__init__(*args, **kwargs)
    
    def _set_response(self, status_code: int = 200, content_type: str = "application/json"):
        """Set the response headers"""
        self.send_response(status_code)
        self.send_header('Content-type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def _send_json_response(self, data: Dict[str, Any], status_code: int = 200):
        """Send JSON response"""
        self._set_response(status_code)
        response = json.dumps(data, indent=2)
        self.wfile.write(response.encode('utf-8'))
    
    def _send_error_response(self, message: str, status_code: int = 400):
        """Send error response"""
        error_data = {
            "error": True,
            "message": message,
            "status_code": status_code
        }
        self._send_json_response(error_data, status_code)
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self._set_response()
    
    def do_GET(self):
        """Handle GET requests - return server info"""
        try:
            # Parse the URL path
            parsed_path = urlparse(self.path)
            
            if parsed_path.path == '/health':
                self._handle_health_check()
            else:
                # Default server info
                info = {
                    "service": "Cluster API Configuration Server",
                    "version": "1.0.0",
                    "endpoints": {
                        "POST /configure": "Accept cluster configuration with region, clusterName, and workerGroups",
                        "POST /preview": "Preview configuration changes without applying them",
                        "GET /health": "Health check endpoint"
                    },
                    "example_request": {
                        "region": "ewr",
                        "clusterName": "my-cluster",
                        "controlPlaneHighAvailability": True,
                        "workerGroups": {
                            "system-workloads": {
                                "count": 2,
                                "planId": "vc2-2c-4gb",
                                "taintEffect": "NoExecute"
                            },
                            "app-workloads": {
                                "count": 3,
                                "planId": "vc2-4c-8gb"
                            }
                        }
                    }
                }
                self._send_json_response(info)
        except Exception as e:
            logger.error(f"Error handling GET request: {str(e)}")
            self._send_error_response(f"Internal server error: {str(e)}", 500)
    
    def do_POST(self):
        """Handle POST requests for cluster configuration"""
        try:
            # Parse the URL path
            parsed_path = urlparse(self.path)
            
            if parsed_path.path == '/configure':
                self._handle_configure_request()
            elif parsed_path.path == '/preview':
                self._handle_preview_request()
            else:
                self._send_error_response(f"Unknown endpoint: {parsed_path.path}", 404)
                
        except Exception as e:
            logger.error(f"Error handling POST request: {str(e)}")
            self._send_error_response(f"Internal server error: {str(e)}", 500)
    
    def _parse_json_request(self):
        """Parse JSON request body - common for configure and preview"""
        # Get content length
        content_length = int(self.headers.get('Content-Length', 0))
        
        if content_length == 0:
            self._send_error_response("Request body is required", 400)
            return None
        
        # Read request body
        post_data = self.rfile.read(content_length)
        
        # Parse JSON
        try:
            config_data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError as e:
            self._send_error_response(f"Invalid JSON: {str(e)}", 400)
            return None
        
        # Validate required fields
        if not isinstance(config_data, dict):
            self._send_error_response("Request body must be a JSON object", 400)
            return None
        
        return config_data
    
    def _handle_configure_request(self):
        """Handle cluster configuration requests"""
        try:
            config_data = self._parse_json_request()
            if config_data is None:
                return
            
            # Process configuration using the handler
            try:
                response_data = self.config_handler.process_configuration(config_data)
                self._send_json_response(response_data)
            except ValueError as e:
                self._send_error_response(str(e), 400)
            except Exception as e:
                logger.error(f"Error processing configuration: {str(e)}")
                self._send_error_response(f"Error processing configuration: {str(e)}", 500)
            
        except Exception as e:
            logger.error(f"Error processing configuration request: {str(e)}")
            self._send_error_response(f"Error processing request: {str(e)}", 500)
    
    def _handle_preview_request(self):
        """Handle configuration preview requests"""
        try:
            config_data = self._parse_json_request()
            if config_data is None:
                return
            
            # Process configuration preview using the handler
            try:
                response_data = self.config_handler.preview_configuration_changes(config_data)
                self._send_json_response(response_data)
            except ValueError as e:
                self._send_error_response(str(e), 400)
            except Exception as e:
                logger.error(f"Error previewing configuration: {str(e)}")
                self._send_error_response(f"Error previewing configuration: {str(e)}", 500)
            
        except Exception as e:
            logger.error(f"Error processing preview request: {str(e)}")
            self._send_error_response(f"Error processing request: {str(e)}", 500)
    
    def _handle_health_check(self):
        """Handle health check requests"""
        health_data = {
            "status": "healthy",
            "service": "Cluster API Configuration Server",
            "timestamp": self.date_time_string()
        }
        self._send_json_response(health_data)
    
    def log_message(self, format, *args):
        """Override to use our logger"""
        logger.info(f"{self.address_string()} - {format % args}")

def run_server(host: str = 'localhost', port: int = 8091):
    """Run the HTTP server"""
    server_address = (host, port)
    httpd = HTTPServer(server_address, ClusterAPIHandler)
    
    logger.info(f"Starting Cluster API Configuration Server on {host}:{port}")
    logger.info(f"Server will accept POST requests to /configure with JSON containing cluster configuration")
    logger.info(f"Server will accept POST requests to /preview to preview configuration changes")
    logger.info(f"Server will accept GET requests to /health for health checks")
    logger.info("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down server...")
        httpd.server_close()
        logger.info("Server stopped")

if __name__ == "__main__":
    # Parse command line arguments
    import argparse
    
    parser = argparse.ArgumentParser(description='Cluster API Configuration Server')
    parser.add_argument('--host', default='localhost', help='Host to bind to (default: localhost)')
    parser.add_argument('--port', type=int, default=8080, help='Port to bind to (default: 8080)')
    
    args = parser.parse_args()
    
    run_server(args.host, args.port) 