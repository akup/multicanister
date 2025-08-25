# mcops-apps

McOps cluster applications: PIC, TNodes, oracles

## Overview

This repository contains Helm charts and applications for the Dex cluster, including PIC, TNodes, and Oracles.

## Repository Structure

```text
mcops-apps/
├── app-helm-chart/           # Base Helm chart for all applications
├── apps/                     # Application-specific configurations
├── applicationSets/          # ArgoCD ApplicationSets
├── .github/workflows/        # GitHub Actions workflows
├── helm-repo/               # GitHub Pages Helm repository
├── helm-repo-raw/           # Raw GitHub Helm repository (for ArgoCD)
└── README.md                # This file
```

## Helm Chart Architecture

### Base Chart (`app-helm-chart/`)

A comprehensive Helm chart providing deployment, service, ingress, PVC, service accounts, init containers, resource limits, and health checks.

### Application values (`apps/`)

Each application uses values for `app-helm-chart` template that is referenced from `applicationSets/`:

```yaml
spec:
  project: mcops-apps
  sources:
  - repoURL: https://raw.githubusercontent.com/JJOInvest/mcops-apps/main/helm-repo-raw
    targetRevision: 1.0.0
    chart: app-helm-chart
    helm:
      passCredentials: true
      releaseName: test-app
      valueFiles:
        - $dexapps-values/apps/test-app/values.yaml #test-app values
  - repoURL: https://github.com/JJOInvest/mcops-apps.git
    targetRevision: main
    ref: dexapps-values #Reference to repository
```

## GitHub Actions Workflows

The workflows will run on `app-helm-chart/` changes. It will:

- Packages the Helm chart into `.tgz` file
- Updates GitHub Pages repository with packaged chart
- Uses the packaged chart to generate `index.yaml` with raw GitHub URLs
- Updates raw GitHub repository for ArgoCD access
- Copies default helm template values to `/app-helm-chart-values.yaml`

`/app-helm-chart-values.yaml` is used in ArgoCD ApplicationSets to merge custom values file with chart default values.

```yaml
valueFiles:
  - $defaults/app-helm-chart-values.yaml
  - $dexapps-values/apps/test-app/values.yaml
```

This sequence ensures:

- Chart is properly packaged before generating raw GitHub URLs
- ArgoCD has access to valid chart artifacts and index
- Both repositories stay synchronized

## ArgoCD Integration

### Why Raw GitHub raw URLs Instead of OCI?

We use raw GitHub URLs instead of OCI (GitHub Container Registry) because:

#### OCI Issues

- **Complex Authentication**: Requires proper GitHub token authentication
- **Secret Management**: ArgoCD needs specific repository secrets
- **Token Scopes**: Requires `read:packages` and `repo` scopes
- **ArgoCD OCI Support**: ArgoCD has inconsistent OCI repository support and often fails to authenticate

#### Raw GitHub URL Advantages

- **Simple Authentication**: Uses standard GitHub repository credentials
- **Reliable ArgoCD Support**: ArgoCD has proven, stable support for HTTP(S) repositories
- **Easier Debugging**: Simpler to troubleshoot authentication issues

### Repository Access

ArgoCD can access the Helm repository via:

- **Raw GitHub URLs**: `https://raw.githubusercontent.com/akup/mcops-apps/main/helm-repo-raw` (Recommended for private repos)
- **GitHub Pages**: `https://akup.github.io/mcops-apps` (For public access)
- **Public repos and helm charts**: can be used anywhere and also in helm dependencies

### Helm repository Structure (for non-OCI repo)

#### Raw GitHub Repository (`helm-repo-raw`)

```text
helm-repo-raw/
├── index.yaml                    # Helm repository index with raw GitHub URLs
```

#### GitHub Pages Repository (`helm-repo`)

```text
helm-repo/
├── index.yaml                    # Helm repository index
├── app-helm-chart-*.tgz          # Packaged chart
└── README.md                     # Repository documentation
```

## Development Workflow

### 1. Making Chart Changes

1. **Edit the base chart** in `app-helm-chart/`
2. **Test locally**:

   ```bash
   cd apps/test-app
   helm dependency update
   helm template test-app . --values values.yaml
   ```

3. **Commit and push** - GitHub Actions will automatically package and update repositories

### 2. Adding New Applications

1. **Create application directory**:

   ```bash
   mkdir apps/my-new-app
   cd apps/my-new-app
   ```

2. **Create values.yaml** with application-specific configuration
3. **Create ApplicationSet** in `applicationSets/my-new-app.yaml`

## Repository Management

### Automatic Updates

GitHub Actions workflows automatically maintain both repositories:

1. **Raw GitHub Repository** (`update-raw-github-repo.yml`): Updates `helm-repo-raw/` with raw GitHub URLs
2. **GitHub Pages Repository** (`update-helm-repo.yml`): Updates `helm-repo/` for public access

### Manual Updates

If GitHub Actions is not available:

```bash
# Package the chart
helm package app-helm-chart

# For raw GitHub repository
mv app-helm-chart-*.tgz helm-repo-raw/
bash scripts/generate-raw-index.sh

# For GitHub Pages repository
mv app-helm-chart-*.tgz helm-repo/
helm repo index helm-repo --url https://akup.github.io/mcops-apps

# Commit and push
git add helm-repo*/ && git commit -m "Update Helm repositories" && git push
```

## Troubleshooting

### Common Issues

1. **Nil pointer errors**: Ensure all required values are defined in `values.yaml`
2. **Template errors**: Check for missing defensive checks in templates

### Debug Commands

```bash
# Check dependency status
helm dependency list

# Update dependencies
helm dependency update

# Test template rendering
helm template my-app . --values values.yaml --debug
```

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make changes** to charts or applications
4. **Test locally** with `helm template`
5. **Commit and push** - workflows will handle packaging
6. **Create a pull request**
