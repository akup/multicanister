#!/usr/bin/env python3
"""
Cluster API Configuration Server
A simple HTTP webserver that provides health checks and cluster information
"""

import json
import logging
import os
import glob
import yaml
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import sys
from typing import Dict, Any, Optional
from secrets_handler import SecretsHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ClusterAPIHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the Cluster API Configuration server"""

    def __init__(self, *args, **kwargs):
        self.config = self._load_config()
        timeout = self.config.get("kubectl_timeout", 30)  # Default 30 seconds
        self.secrets_handler = SecretsHandler(
            self.config.get("clusters-folder", "clusters"),
            timeout=timeout
        )
        super().__init__(*args, **kwargs)

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from defaults.yaml"""
        try:
            config_path = os.path.join("configs", "defaults.yaml")
            with open(config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return {"clusters-folder": "clusters"}

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
        """Handle GET requests"""
        try:
            # Parse the URL path
            parsed_path = urlparse(self.path)

            if parsed_path.path == '/health':
                self._handle_health_check()
            elif parsed_path.path == '/clusters':
                self._handle_clusters_request()
            elif parsed_path.path == '/secrets':
                self._handle_secrets_request()
            else:
                # Default server info
                info = {
                    "service": "Cluster API Configuration Server",
                    "version": "1.0.0",
                    "endpoints": {
                        "GET /health": "Health check endpoint",
                        "GET /clusters": "List available clusters from kubeconfig files",
                        "GET /secrets": "Get secrets for a cluster (requires 'cluster' parameter)",
                        "POST /secrets/add_docker": "Add Docker registry secret and ArgoCD image updater",
                        "POST /secrets/add_helm_repo": "Add Helm repository secret to ArgoCD namespace"
                    }
                }
                self._send_json_response(info)
        except Exception as e:
            logger.error(f"Error handling GET request: {str(e)}")
            self._send_error_response(f"Internal server error: {str(e)}", 500)

    def do_POST(self):
        """Handle POST requests"""
        try:
            # Parse the URL path
            parsed_path = urlparse(self.path)

            if parsed_path.path == '/secrets/add_docker':
                self._handle_add_docker_secret_request()
            elif parsed_path.path == '/secrets/add_helm_repo':
                self._handle_add_helm_repo_secret_request()
            else:
                self._send_error_response(f"Unknown endpoint: {parsed_path.path}", 404)

        except Exception as e:
            logger.error(f"Error handling POST request: {str(e)}")
            self._send_error_response(f"Internal server error: {str(e)}", 500)

    def _handle_clusters_request(self):
        """Handle clusters listing request"""
        try:
            clusters_folder = self.config.get("clusters-folder", "clusters")
            clusters_path = os.path.join(os.getcwd(), clusters_folder)

            if not os.path.exists(clusters_path):
                logger.warning(f"Clusters folder does not exist: {clusters_path}")
                self._send_json_response({"clusters": []})
                return

            # Find all .kubeconfig files
            kubeconfig_pattern = os.path.join(clusters_path, "*.kubeconfig")
            kubeconfig_files = glob.glob(kubeconfig_pattern)

            cluster_names = []
            for file_path in kubeconfig_files:
                # Extract cluster name from filename (remove .kubeconfig extension)
                filename = os.path.basename(file_path)
                cluster_name = filename.replace('.kubeconfig', '')
                cluster_names.append(cluster_name)

            response_data = {
                "clusters": cluster_names,
                "total": len(cluster_names)
            }

            self._send_json_response(response_data)

        except Exception as e:
            logger.error(f"Error handling clusters request: {str(e)}")
            self._send_error_response(f"Error listing clusters: {str(e)}", 500)

    def _handle_secrets_request(self):
        """Handle secrets request for a specific cluster"""
        try:
            # Parse query parameters
            parsed_path = urlparse(self.path)
            query_params = parse_qs(parsed_path.query)

            # Check if cluster parameter is provided
            if 'cluster' not in query_params:
                self._send_error_response("Missing required parameter 'cluster'", 400)
                return

            cluster_name = query_params['cluster'][0]

            if not cluster_name:
                self._send_error_response("Cluster parameter cannot be empty", 400)
                return

            # Get secrets for the cluster
            secrets_data = self.secrets_handler.get_secrets_for_cluster(cluster_name)
            self._send_json_response(secrets_data)

        except ValueError as e:
            self._send_error_response(str(e), 404)
        except Exception as e:
            logger.error(f"Error handling secrets request: {str(e)}")
            self._send_error_response(f"Error processing request: {str(e)}", 500)

    def _handle_add_docker_secret_request(self):
        """Handle adding Docker registry secret request"""
        try:
            # Parse JSON request body
            content_length = int(self.headers.get('Content-Length', 0))

            if content_length == 0:
                self._send_error_response("Request body is required", 400)
                return

            post_data = self.rfile.read(content_length)

            try:
                request_data = json.loads(post_data.decode('utf-8'))
            except json.JSONDecodeError as e:
                self._send_error_response(f"Invalid JSON: {str(e)}", 400)
                return

            # Validate required fields
            required_fields = ['password', 'username', 'cluster_name', 'name', 'namespaces']
            for field in required_fields:
                if field not in request_data:
                    self._send_error_response(f"Missing required field: {field}", 400)
                    return

            password = request_data['password']
            username = request_data['username']
            cluster_name = request_data['cluster_name']
            name = request_data['name']
            namespaces_str = request_data['namespaces']
            upsert = request_data.get('upsert', False)

            # Parse and validate namespaces
            try:
                namespaces = [ns.strip() for ns in namespaces_str.split(',') if ns.strip()]
                if not namespaces:
                    self._send_error_response("At least one namespace must be provided", 400)
                    return

                # Check if argocd namespace is included (not allowed)
                if 'argocd' in namespaces:
                    self._send_error_response("Namespace 'argocd' is not allowed as it is used for CD. Please use a different namespace.", 400)
                    return
            except Exception as e:
                self._send_error_response(f"Invalid namespaces format: {str(e)}", 400)
                return

            # Process the request using the secrets handler
            try:
                response_data = self.secrets_handler.add_docker_secret(
                    cluster_name, name, password, username, namespaces, upsert
                )
                self._send_json_response(response_data)
            except ValueError as e:
                self._send_error_response(str(e), 400)
            except Exception as e:
                logger.error(f"Error adding Docker secret: {str(e)}")
                self._send_error_response(f"Error adding Docker secret: {str(e)}", 500)

        except Exception as e:
            logger.error(f"Error handling add Docker secret request: {str(e)}")
            self._send_error_response(f"Error processing request: {str(e)}", 500)

    def _handle_add_helm_repo_secret_request(self):
        """Handle adding Helm repository secret request"""
        try:
            # Parse JSON request body
            content_length = int(self.headers.get('Content-Length', 0))

            if content_length == 0:
                self._send_error_response("Request body is required", 400)
                return

            post_data = self.rfile.read(content_length)

            try:
                request_data = json.loads(post_data.decode('utf-8'))
            except json.JSONDecodeError as e:
                self._send_error_response(f"Invalid JSON: {str(e)}", 400)
                return

            # Validate required fields
            required_fields = ['name', 'repository_url', 'cluster_name', 'use_oci', 'username', 'password']
            for field in required_fields:
                if field not in request_data:
                    self._send_error_response(f"Missing required field: {field}", 400)
                    return

            secret_name = request_data['name']
            repository_url = request_data['repository_url']
            cluster_name = request_data['cluster_name']
            use_oci = request_data['use_oci']
            password = request_data['password']
            username = request_data['username']
            upsert = request_data.get('upsert', False)

            # Process the request using the secrets handler
            try:
                response_data = self.secrets_handler.add_helm_repo_secret(
                    cluster_name, secret_name, repository_url, use_oci, password, username, upsert
                )
                self._send_json_response(response_data)
            except ValueError as e:
                self._send_error_response(str(e), 400)
            except Exception as e:
                logger.error(f"Error adding Helm repo secret: {str(e)}")
                self._send_error_response(f"Error adding Helm repo secret: {str(e)}", 500)

        except Exception as e:
            logger.error(f"Error handling add Helm repo secret request: {str(e)}")
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
    logger.info(f"Server will accept GET requests to /health for health checks")
    logger.info(f"Server will accept GET requests to /clusters to list available clusters")
    logger.info(f"Server will accept GET requests to /secrets?cluster=<name> to get secrets")
    logger.info(f"Server will accept POST requests to /secrets/add_docker to add Docker secrets")
    logger.info(f"Server will accept POST requests to /secrets/add_helm_repo to add Helm repository secrets")
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
