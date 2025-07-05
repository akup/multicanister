# Test App

A simple TypeScript Express REST service with two GET endpoints.

## Endpoints

- `GET /` - Returns "Hello world"
- `GET /test` - Returns "Hello world"

## Development

### Prerequisites

- Node.js 18 or higher
- npm

### Installation

```bash
npm install
```

### Running in Development

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Building for Production

```bash
npm run build
npm start
```

## Docker

### Building the Docker Image

```bash
docker build -t test-app .
```

### Running the Docker Container

```bash
docker run -p 3000:3000 test-app
```

The application will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the TypeScript application
- `npm start` - Start the production server
- `npm run clean` - Remove the dist folder 