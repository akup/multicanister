# Helm Repository

This directory contains the Helm repository files that are served via GitHub Pages.

## Setup Instructions

1. **Enable GitHub Pages**:
   - Go to your repository Settings > Pages
   - Set Source to "Deploy from a branch"
   - Select "main" branch
   - Set folder to "/ (root)"
   - Save

2. **Manual Update** (if needed):

   ```bash
   # Package the chart
   helm package ../app-helm-chart
   
   # Move to repo directory
   mv app-helm-chart-1.0.0.tgz ./
   
   # Update index
   helm repo index . --url https://jjoinvest.github.io/dex-apps/helm-repo
   
   # Commit and push
   git add .
   git commit -m "Update Helm repository"
   git push
   ```

3. **Usage**:

   ```bash
   # Add the repository
   helm repo add dex-apps https://jjoinvest.github.io/dex-apps/helm-repo
   
   # Update
   helm repo update
   
   # Install
   helm install my-app dex-apps/app-helm-chart
   ```

## Files

- `index.yaml`: Helm repository index file
- `app-helm-chart-1.0.0.tgz`: Packaged Helm chart
