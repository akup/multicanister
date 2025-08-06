# The DevOps & Orchestration Platform for the Internet Computer

## Overview

**ICR (Internet Computer Registry)** is an infrastructure platform for orchestrating and managing the application lifecycle, acting as something like a Kubernetes for multi-canister environments on IC. The project aims to radically simplify and automate the CI/CD processes, deployments for tests, log-tracing, versioning, shipping to mainnet and scaling processes for complex multicanister IC applications. It also provides a unified test environment for onchain (possible multisubnet) and offchain components that use http-outcall functionality.

It can and will provide an easy way for developers to build scalable complex IC solutions with combination with offchain functionality.

## How It Works (should work)

### Development Workflow

1. **Mono-repository Structure**: Developers create a mono-repository that contains canister modules and backend offchain modules
2. **Declarative Configuration**: Using declarations, these modules are combined into an application that can be built and deployed to cloud-based development environments
3. **Cloud Infrastructure**: GitHub workflows help create Kubernetes clusters in the cloud (AWS, GCS, etc.) where Pocket IC, offchain modules, and logging/monitoring tooling are installed
4. **Orchestration Core**: At Pocket IC, orchestration core canisters are automatically installed

### Deployment Process

- **CLI Tools**: Built application modules and canister WASMs are uploaded to the orchestration core
- **Registry Management**: Canisters are added to the registry with branch and tag metadata and created in Pocket IC
- **Service Discovery**: Orchestration helps discover application canisters and offchain modules as services, enabling multiple non-conflicting versions of the same application in a cluster for testing and development purposes
- **Mainnet Deployment**: After testing, applications can be released to mainnet with project GitHub workflows
- **Auto-scaling**: Orchestration helps autoscale canisters (replicate and shard) across subnets

## Project Goals

### Primary Objectives

- **Simplified Development**: Provide developers with intuitive tools to build and deploy complex multi-canister applications
- **Automated CI/CD**: Streamline the entire development lifecycle from local development to mainnet deployment
- **Environment Consistency**: Ensure identical development, testing, and production environments
- **Version Control**: Implement Git-like versioning for WASM modules with full metadata tracking

### Scaling & Performance Goals

- **Horizontal Scaling**: Automatically replicate canisters across multiple subnets to handle increased load
- **Intelligent Sharding**: Distribute canister instances across subnets based on load patterns and resource requirements
- **Load Balancing**: Implement smart routing to distribute requests across canister replicas
- **Performance Optimization**: Minimize cross-subnet communication overhead through strategic canister placement
- **Resource Management**: Optimize canister placement to balance resource utilization across subnets

### Security & Governance

- **DAO Integration**: Implement decentralized governance for deployment approvals and updates
- **Access Control**: Provide fine-grained permissions for different deployment stages
- **Audit Trail**: Maintain comprehensive logs of all deployment and scaling activities
- **Integrity Verification**: Ensure deployed code matches built binaries through SHA-256 verification

### Monitoring & Observability

- **Real-time Monitoring**: Track canister health, performance, and resource utilization
- **Distributed Tracing**: Monitor cross-canister and offchain communication
- **Alerting System**: Proactive notifications for performance issues and failures
- **Dashboard Visualization**: Web-based interface for system state and metrics

## Core Architecture & Components

Our architecture is divided into logical components that work together to create a robust and flexible environment for developers.

### ICR Core Service (Control Plane)

The core of the system, being rewritten in Rust for maximum performance and security. It wraps Pocket IC for local testing and provides a REST API for managing WASM modules (upload, list, version).

### ICR CLI (Command-Line Interface)

A client tool, analogous to kubectl, that interacts with the Core Service. It uses dfx to build canisters, calculate their SHA-256 checksums, and automate deployments (install, upgrade, reinstall).

### Registry-Factory Canister (The Orchestration Core)

A key smart canister that manages all other canisters in the environment. It provides:

- **Service Discovery**: Canisters communicate via service names rather than canisterIds, providing location transparency
- **Auto-scaling**: Manages canister sharding and replication across subnets to distribute load
- **Load Distribution**: Intelligently routes requests to optimal canister instances
- **Health Monitoring**: Tracks canister health and automatically replaces failing instances

### DAO Module

A canister based on SNS responsible for approving deployment and updating of orchestrated canisters.

## Key Features & Workflow

ICR provides developers with tools that make working with multi-canister systems predictable and efficient.

### Git-like WASM Versioning

Full metadata tracking for every WASM module (branch, tag, commit hash) for transparent auditing and version control and integrating into CI/CD workflows.

### Integrity and Security

Automatic calculation and verification of SHA-256 hashes for each binary, ensuring the deployed code is exactly what was built.

### Environment Parity

The core.json and environment.json concept, combined with Pocket IC, allows preparation of development and testing environments. Autotesting tooling can be run against such environments (canister combinations and states). It also allows for creating identical dev and production environments, eliminating discrepancies.

### Advanced Automation

The CLI supports complex deployment scenarios, including fresh installs, upgrades, and reinstalls via a single command.

## Hackathon Goals & Future Vision 🚀

### Enhanced Orchestration Logic

Enhancing the registry-factory to introduce:

- Location transparency
- Logging and monitoring
- Support for more advanced deployment strategies

### DAO Integration

- Implement SNS-based governance for deployment approvals
- Create voting mechanisms for system upgrades
- Establish role-based access control

### Declarative Configuration Management

Shifting from an imperative command model to a declarative approach, where the desired state of the entire system is described in a single configuration file (similar to Kubernetes manifests).

### Monitoring Web UI

Creating a basic dashboard to visualize:

- State of deployed canisters
- Their interconnections
- Current status and log tracing
- Performance metrics and scaling indicators

### Example Application

We will provide an example and describe the development and configuration of an application that has:

- Multiple canisters communicating via service discovery
- Offchain module integration via http-outcalls
- Complete build and deployment workflow using GitHub workflows
- Multi-version deployment for different test environments
- Mainnet deployment with DAO-governed updates
