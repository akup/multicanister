# Security Policy for stakater-reloader Chart

This document outlines the security policy and exceptions for the stakater-reloader Helm chart.

## Security Mitigations

### KSV041 - Secrets Permissions

**Issue**: ClusterRole has access to secrets resources with excessive permissions.

**Status**: ACCEPTED

**Reason**: stakater-reloader requires access to secrets to monitor changes and trigger pod restarts when secrets are updated. This is a core requirement for the reloader functionality.

**Mitigation**:

- The secrets permissions are scoped to the reloader namespace
- This is a standard configuration used by the official stakater-reloader chart
- Secret change detection requires secrets access for monitoring
- Reloader only reads secrets to detect changes, it does not modify them
- Permissions are limited to the specific namespaces where reloader operates

**Files**:

- `.trivyignore` - Contains the exception rule
- `.trivy.yaml` - Contains detailed configuration and reasoning

## stakater-reloader Security Considerations

### Configuration Change Detection Security

1. **ConfigMap Monitoring**: Reloader monitors ConfigMap changes to trigger pod restarts
2. **Secret Monitoring**: Reloader monitors Secret changes to trigger pod restarts
3. **Annotation-based Control**: Uses Kubernetes annotations to control which resources trigger reloads
4. **RBAC**: Implements proper role-based access control for monitoring operations

### Pod Restart Security

1. **Controlled Restarts**: Only restarts pods that have the appropriate reloader annotations
2. **Rolling Updates**: Supports rolling update strategies to minimize downtime
3. **Resource Validation**: Validates resource changes before triggering restarts
4. **Error Handling**: Graceful handling of restart failures and retries

### Network Security

1. **API Communication**: Secure communication with the Kubernetes API server
2. **Event Monitoring**: Monitors Kubernetes events for resource changes
3. **Webhook Integration**: Can integrate with admission webhooks for additional validation

## Security Scanning

This chart uses Trivy for security scanning with the following configuration:

1. **Policy Files**: Custom policy files are used to suppress known false positives
2. **Severity Levels**: CRITICAL, HIGH, MEDIUM, and LOW vulnerabilities are reported
3. **Exit Code**: The scan exits with code 0 even when vulnerabilities are found (for CI/CD compatibility)

## Monitoring

- Regular security scans are performed via GitHub Actions
- New vulnerabilities are reviewed and exceptions are updated as needed
- The security policy is reviewed quarterly
- Reloader operation logs are monitored for failed restarts
- Resource change events are tracked and logged

## Reporting Security Issues

If you discover a security issue in this chart, please:

1. Do not create a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for assessment and remediation

## Updates

This security policy is reviewed and updated regularly to ensure it remains current with security best practices and stakater-reloader requirements.

## stakater-reloader Specific Security Notes

### Configuration Management

- **Annotation-based Control**: Uses `reloader.stakater.com/auto` and `reloader.stakater.com/search` annotations
- **Selective Monitoring**: Only monitors resources with specific annotations
- **Namespace Scoping**: Can be scoped to specific namespaces for security
- **Resource Filtering**: Supports filtering by resource type and name

### Deployment Security

- **Non-root Execution**: Runs as non-root user (UID 1000)
- **Resource Limits**: Implements CPU and memory limits
- **Pod Security**: Uses pod security contexts for enhanced security
- **High Availability**: Supports pod anti-affinity and topology spread constraints

### Integration Security

- **Kubernetes Native**: Uses native Kubernetes APIs and RBAC
- **Event-driven**: Responds to Kubernetes events for resource changes
- **Stateless Operation**: No persistent state storage required
- **Audit Trail**: Provides audit trail for configuration changes and restarts

### Best Practices

- **Minimal Permissions**: Uses least privilege principle for API access
- **Secure Communication**: All communication with Kubernetes API is secured
- **Error Handling**: Graceful error handling and retry mechanisms
- **Monitoring**: Comprehensive monitoring and alerting capabilities
