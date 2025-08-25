#!/bin/bash

set -e

echo "Packaging Helm chart..."
helm package app-helm-chart

echo "Moving chart to helm-repo directory..."
mv app-helm-chart-1.0.0.tgz helm-repo/

echo "Updating index.yaml..."
helm repo index helm-repo --url https://akup.github.io/mcops-apps/helm-repo

echo "Updating root index.yaml..."
helm repo index . --url https://akup.github.io/mcops-apps

echo "Repository updated! Files ready for commit:"
echo "- index.yaml"
echo "- helm-repo/index.yaml"
echo "- helm-repo/app-helm-chart-1.0.0.tgz"
echo ""
echo "Next steps:"
echo "1. Commit these files to your repository"
echo "2. Enable GitHub Pages in your repository settings"
echo "3. Set the source to 'Deploy from a branch' and select 'main' branch"
echo "4. Set the folder to '/ (root)'"
echo "5. Update your Chart.yaml to use: https://akup.github.io/mcops-apps" 