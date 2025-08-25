# Security Policy for cert-manager Chart

This document outlines the security policy and exceptions for the cert-manager Helm chart.

## Security Mitigations

### KSV114 - Admission Webhook Permissions

**Issue**: ClusterRole 'cert-manager-webhook' has access to webhook configuration resources with excessive permissions.

**Status**: ACCEPTED

**Reason**: Admission webhooks are required by cert-manager to validate and process Certificate resources and CertificateRequests.

**Mitigation**:

- The admission webhooks are scoped to the cert-manager namespace
- This is a standard configuration used by the official cert-manager chart
- Certificate validation and processing requires admission webhooks for proper operation
- Webhooks are essential for cert-manager's certificate lifecycle management

**Files**:

- `.trivyignore` - Contains the exception rule
- `.trivy.yaml` - Contains detailed configuration and reasoning

## Security Exceptions

### KSV041 - Secrets Permissions

**Issue**: ClusterRole has access to secrets resources with excessive permissions.

**Status**: ACCEPTED

**Reason**: cert-manager requires access to secrets for storing and managing TLS certificates, private keys, and CA bundles. This is a core requirement for certificate management functionality.

**Mitigation**:

- The secrets permissions are scoped to the cert-manager namespace
- This is a standard configuration used by the official cert-manager chart
- Certificate storage and management requires secrets access
- Private keys and certificates must be stored securely in Kubernetes secrets
- CA bundles and intermediate certificates are stored as secrets

**Files**:

- `.trivyignore` - Contains the exception rule
- `.trivy.yaml` - Contains detailed configuration and reasoning

## cert-manager Security Considerations

### Certificate Management Security

1. **Private Key Protection**: cert-manager generates and stores private keys in Kubernetes secrets
2. **Certificate Validation**: Admission webhooks validate certificate requests before processing
3. **CA Integration**: Supports integration with various Certificate Authorities (Let's Encrypt, internal CAs)
4. **RBAC**: Implements proper role-based access control for certificate operations

### Network Security

1. **Webhook Communication**: Secure communication between cert-manager components and the Kubernetes API
2. **CA Communication**: Secure communication with external Certificate Authorities
3. **Certificate Distribution**: Secure distribution of certificates to applications

## Security Scanning

This chart uses Trivy for security scanning with the following configuration:

1. **Policy Files**: Custom policy files are used to suppress known false positives
2. **Severity Levels**: CRITICAL, HIGH, MEDIUM, and LOW vulnerabilities are reported
3. **Exit Code**: The scan exits with code 0 even when vulnerabilities are found (for CI/CD compatibility)

## Monitoring

- Regular security scans are performed via GitHub Actions
- New vulnerabilities are reviewed and exceptions are updated as needed
- The security policy is reviewed quarterly
- Certificate expiration and renewal status is monitored
- Failed certificate requests are tracked and alerted

## Reporting Security Issues

If you discover a security issue in this chart, please:

1. Do not create a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for assessment and remediation

## Updates

This security policy is reviewed and updated regularly to ensure it remains current with security best practices and cert-manager requirements.

## cert-manager Specific Security Notes

### Certificate Authority Integration

- **Let's Encrypt**: Uses ACME protocol for automatic certificate issuance
- **Internal CAs**: Supports integration with internal Certificate Authorities
- **Certificate Renewal**: Automatic renewal of certificates before expiration
- **Certificate Revocation**: Support for certificate revocation when needed

### Compliance and Standards

- **X.509 Standards**: Follows X.509 certificate standards
- **TLS Protocols**: Supports modern TLS protocols and cipher suites
- **Certificate Transparency**: Optional support for Certificate Transparency logs
