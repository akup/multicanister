# Cluster API Configuration Server

A Python HTTP server that accepts JSON configuration data and converts it to YAML format for cluster management.

## Features

- **JSON to YAML Conversion**: Accepts JSON configuration and converts to YAML format
- **Cluster Configuration Management**: Stores configurations by cluster name
- **Change Tracking**: Tracks and reports changes in region, control plane HA, and worker groups
- **Configuration Preview**: Preview changes without applying them to files
- **Validation**: Validates required fields and worker group configurations
- **CORS Support**: Cross-origin resource sharing enabled
- **Comprehensive Logging**: Detailed logging of all operations and changes
- **Error Handling**: Proper error responses with meaningful messages

## API Endpoints

### POST /configure

Accepts JSON configuration data and converts it to YAML.

**Request Body:**

```json
{
  "clusterName": "my-cluster",
  "region": "ewr",
  "controlPlaneHighAvailability": true,
  "workerGroups": {
    "app-workloads": {
      "count": 3,
      "planId": "vc2-4c-8gb"
    },
    "system-workloads": {
      "count": 2,
      "planId": "vc2-2c-4gb",
      "taintEffect": "NoExecute"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Configuration processed successfully",
  "clusterName": "my-cluster",
  "changes": {
    "region": {
      "previous": "ams",
      "current": "ewr"
    },
    "controlPlaneHighAvailability": {
      "previous": false,
      "current": true
    },
    "workerGroups": {
      "added": [
        {
          "name": "new-workloads",
          "count": 1,
          "planId": "vc2-1c-1gb"
        }
      ],
      "modified": [
        {
          "name": "app-workloads",
          "previous": {
            "count": 2,
            "planId": "vc2-2c-4gb"
          },
          "current": {
            "count": 3,
            "planId": "vc2-4c-8gb"
          }
        }
      ],
      "deleted": [
        {
          "name": "old-workloads",
          "count": 1,
          "planId": "vc2-1c-1gb"
        }
      ]
    }
  }
}
```

### POST /preview

Preview configuration changes without applying them to files. This endpoint performs all validation and diff calculation but does not save the configuration.

**Request Body:** (Same as `/configure`)

**Response:** (Same structure as `/configure`, but with preview message)

```json
{
  "success": true,
  "message": "Preview of configuration changes for cluster: my-cluster",
  "clusterName": "my-cluster",
  "region": "ewr",
  "controlPlaneHighAvailability": true,
  "workerGroupsCount": 2,
  "changesDetected": true,
  "changes": {
    "region": {
      "previous": "ams",
      "current": "ewr"
    },
    "control_plane_high_availability": {
      "previous": false,
      "current": true
    },
    "workerGroupsAdded": [
      {
        "name": "new-workloads",
        "config": {
          "count": 1,
          "planId": "vc2-1c-1gb"
        }
      }
    ],
    "workerGroupsModified": [
      {
        "name": "app-workloads",
        "previousConfig": {
          "count": 2,
          "planId": "vc2-2c-4gb"
        },
        "newConfig": {
          "count": 3,
          "planId": "vc2-4c-8gb"
        },
        "changes": {
          "count": {
            "previous": 2,
            "new": 3
          },
          "planId": {
            "previous": "vc2-2c-4gb",
            "new": "vc2-4c-8gb"
          }
        }
      }
    ],
    "workerGroupsDeleted": [
      {
        "name": "old-workloads",
        "config": {
          "count": 1,
          "planId": "vc2-1c-1gb"
        }
      }
    ]
  }
}
```

### GET /health

Returns server health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Server Management

Use the provided server manager script for easy server control:

```bash
# Start the server
./server_manager.sh start

# Stop the server
./server_manager.sh stop

# Restart the server
./server_manager.sh restart

# Check server status
./server_manager.sh status

# View live logs
./server_manager.sh logs
```

The script automatically:
- Manages the virtual environment
- Captures and stores the process ID
- Redirects output to log files
- Provides graceful shutdown
- Shows server status and recent logs

## Development

For development with auto-reload functionality:

### Quick Start
```bash
# Start development server with auto-reload
./dev.sh
```

### Manual Development Setup
```bash
# Activate virtual environment
source venv/bin/activate

# Install development dependencies
pip install -r requirements.txt

# Start auto-reload server
python dev_server.py
```

### Auto-Reload Features
- **Automatic restarts** when Python files (`.py`) change
- **Config file monitoring** for `.yaml` and `.json` files
- **Debounced restarts** to avoid multiple restarts for rapid changes
- **Clean process management** with graceful shutdown
- **Real-time logging** of file changes and server restarts

### Development Workflow
1. Start the development server: `./dev.sh`
2. Edit your code files (server.py, config_handler.py, etc.)
3. Save changes - server automatically restarts
4. Test your changes immediately
5. No manual server restarts needed!

### Alternative Auto-Reload Options
```bash
# Using watchmedo (if installed)
watchmedo auto-restart --patterns="*.py" --recursive -- python server.py

# Using hupper (if installed)
hupper -m server
```

## Manual Setup

If you prefer to run the server manually:

1. **Create Virtual Environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run Server:**
   ```bash
   python server.py
   ```

## Configuration Schema

### Required Fields
- `clusterName`: String - Name of the cluster
- `region`: String - Vultr region (e.g., "ewr", "ams", "lhr")
- `workerGroups`: Object - Worker group configurations

### Optional Fields
- `controlPlaneHighAvailability`: Boolean - Default: true

### Worker Group Structure
Each worker group must have:
- `count`: Integer (minimum 1) - Number of worker nodes
- `planId`: String - Vultr plan ID (e.g., "vc2-2c-4gb")

## Validation Rules

1. **Required Fields**: All required fields must be present
2. **Worker Group Count**: Must be at least 1 for each worker group
3. **Worker Group Plan ID**: Must be specified for each worker group
4. **Cluster Name**: Must be a valid string

## File Structure

```
cluster_api_conf/
├── server.py              # Main server application
├── config_handler.py      # Configuration processing logic
├── server_manager.sh      # Server management script
├── requirements.txt       # Python dependencies
├── test_client.py         # Test client for API testing
├── cluster_configs/       # Generated YAML configurations
├── server.pid            # Server process ID (auto-generated)
├── server.log            # Server logs (auto-generated)
└── README.md             # This file
```

## Testing

Run the test client to verify all functionality:

```bash
python test_client.py
```

The test client covers:
- Basic configuration creation
- Configuration preview functionality
- Worker group modifications
- Region and control plane HA changes
- Worker group additions and deletions
- Error handling scenarios
- Validation rules

## Use Cases

### Configuration Preview
Use the `/preview` endpoint to:
- Validate configuration before applying
- Review changes that would be made
- Check for potential issues
- Get a detailed diff of what would change

### Example Preview Workflow
1. Send configuration to `/preview` to validate and see changes
2. Review the response to understand what would be modified
3. If satisfied, send the same configuration to `/configure` to apply changes

## Error Handling

The server returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation errors)
- `500`: Internal Server Error

Error responses include detailed error messages to help with debugging.

## Logging

The server provides comprehensive logging including:
- Request processing
- Configuration changes
- Validation errors
- File operations
- Server lifecycle events

Logs are written to `server.log` when using the server manager script. 