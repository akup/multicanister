# DEX cluster addons

Contains addons for kubernetes clusters managed by ArgoCD.

It contains `./applicationSets` with list of ArgoCD ApplicationSet with cluster selectors. Each ApplicationSet refers to `./addons/${addon}`

## How to add addons

First add applicationSet referencing addon and valid values for helm if needed.

`./addons` folder contains kustomization or helm chart addons, that are regularly scanned by [Trivy](https://github.com/aquasecurity/trivy) for vulnerabilities.

In case of helm charts place there `Chart.yaml` with dependencies, following this example:

```yaml
apiVersion: v2
name: ingress-nginx
description: Ingress Nginx Chart
type: application
version: 1.0.0
appVersion: 1.0.0
dependencies:
  - name: ingress-nginx
    version: 4.12.3
    repository: https://kubernetes.github.io/ingress-nginx
```

If you want to customize templates, just add `templates` in `Chart.yaml` folder. To exclude trivy critical proposals place in same folder `.trivyignore`

> **IMPORTANT NOTE:** When you add values, don't forget that it is using dependencies to reference helm charts in the `Chart.yaml`. So your values file should start with `{dependency.name}`. For the earlier written ingress-nginx example it would be

```yaml
ingress-nginx: #this property name is taken from dependencies.name in Chart.yaml
  #Here goes your values
  controller:
    #Some code
```

## Security Scanning

This repository includes automated security scanning to ensure the safety and compliance of Helm charts and their dependencies.

Sometimes it is needed to ignore trivy errors. For example [ingress-nginx](https://github.com/kubernetes/ingress-nginx) requires access to secrets for TLS certificates and other configurations. Int this case add `.trivyignore` to addon root where corresponding `Chart.yaml` file locates.

### Daily Regular Scan Action

The `regular-scan` GitHub Action runs automatically every day at 2:00 AM UTC to perform comprehensive security analysis of all Helm charts in the `addons/` directory.

#### What it does

1. **Chart Discovery**: Scans all subdirectories in `addons/` for `Chart.yaml` files
2. **Values for different clusters discovery**: Scans each folder `/addons/${folder}/Chart.yaml` for values, to check each
3. **Dependency Analysis**: Extracts and analyzes all Helm chart dependencies
4. **Security Scanning**: Performs vulnerability scans on each chart and its dependencies
5. **Matrix Processing**: Uses GitHub Actions matrix strategy to scan multiple charts in parallel
6. **Compliance Reporting**: Generates security reports for review

#### When it runs

- **Automatically**: Daily at 2:00 AM UTC via scheduled cron job
- **On Pull Requests**: Triggers when PRs target `main` or `release-*` branches. See [.github/branch-protection.md](/.github/branch-protection.md)
- **Manually**: Can be triggered manually via workflow dispatch

#### Branch Protection

The workflow is integrated with branch protection rules to:

- Block merging of PRs if security scans fail
- Require successful security validation before code reaches main/release branches
- Ensure compliance with security policies

#### Output

The scan provides detailed information about:

- Chart paths and locations
- Dependency names, versions, and repositories
- Security vulnerabilities (if any)
- Compliance status

This automated scanning helps maintain security standards and catch potential issues before they reach production environments.
