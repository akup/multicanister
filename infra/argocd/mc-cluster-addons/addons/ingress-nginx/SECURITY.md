# Security Policy for ingress-nginx Chart

This document outlines the security policy and exceptions for the ingress-nginx Helm chart.

## Security Mitigations

### KSV114 - Admission Webhook Permissions

**Issue**: ClusterRole 'ingress-nginx-admission' has access to webhook configuration resources with excessive permissions.

**Status**: ACCEPTED

**Reason**: Admission webhooks are required by nginx ingress to load ingress paths.

**Mitigation**:

- The admission webhooks are scoped to the ingress controller namespace
- This is a standard configuration used by the official ingress-nginx chart
- Reading ingress configurations to update paths routing requires admission webhooks

**Files**:

- `.trivyignore` - Contains the exception rule
- `.trivy.yaml` - Contains detailed configuration and reasoning

## Security Exceptions

### KSV041 - Secrets Permissions

**Issue**: ClusterRole has access to secrets resources with excessive permissions.

**Status**: ACCEPTED

**Reason**: The ingress controller requires access to secrets for TLS certificates and other configurations. This is a standard requirement for ingress controllers.

**Mitigation**:

- The secrets permissions are scoped to the ingress controller namespace
- This is a standard configuration used by the official ingress-nginx chart
- TLS certificate management requires secrets access

**Files**:

- `.trivyignore` - Contains the exception rule
- `.trivy.yaml` - Contains detailed configuration and reasoning

## Security Scanning

This chart uses Trivy for security scanning with the following configuration:

1. **Policy Files**: Custom policy files are used to suppress known false positives
2. **Severity Levels**: CRITICAL, HIGH, MEDIUM, and LOW vulnerabilities are reported
3. **Exit Code**: The scan exits with code 0 even when vulnerabilities are found (for CI/CD compatibility)

## Monitoring

- Regular security scans are performed via GitHub Actions
- New vulnerabilities are reviewed and exceptions are updated as needed
- The security policy is reviewed quarterly

## Reporting Security Issues

If you discover a security issue in this chart, please:

1. Do not create a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for assessment and remediation

## Updates

This security policy is reviewed and updated regularly to ensure it remains current with security best practices and chart requirements.
