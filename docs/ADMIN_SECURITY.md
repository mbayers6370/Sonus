# Admin Security

This document describes the security model for Sonus admin access and sensitive admin actions.

## Admin Bootstrap Model
- Admin access is enforced server-side, not by UI visibility.
- Support-admin sessions are authenticated with a signed-in admin token and validated on each request.
- Admin session tokens are stored hashed at rest and can be revoked.
- Session lifetime includes both absolute expiry and idle-timeout revocation.
- No public bootstrap endpoint is used for creating first-run admin access.

## Who Can Create Admins
- Only an authenticated support admin can call admin-auth endpoints.
- Creating a new admin is additionally restricted to the root support-admin identity.
- New admin creation also requires current-password re-auth by the acting root admin.
- Admin usernames may be constrained by environment allowlist policy in production.

## What Requires Re-Auth
- Sensitive credentials operations require password re-entry.
- Creating another admin account requires current admin password.
- Changing your own admin password requires current admin password.
- Session-only presence is not sufficient for these sensitive operations.

## Password Reset Behavior
- Admin forgot-password flow returns a generic success response to reduce account enumeration.
- Reset tokens are random, stored as hashes, expire, and are single-use.
- Password reset request and reset-consume endpoints are rate-limited.
- Successful password reset revokes active admin sessions for the target account.

## Audit Logging Behavior
- Security events are recorded for admin authentication and sensitive admin-auth actions, including:
- Login success/failure/throttling
- Admin creation success/rejection
- Admin password change
- Admin password reset requests, throttling, and completion
- Admin business actions (for user/account operations) are audit-logged with actor, action, target, reason, result, and timestamp.

## Threat Model Assumptions
- Trusted deployment controls are in place for transport security and secret management.
- Admin credentials and reset channels (email inbox) are assumed to be private to authorized operators.
- Client applications and browser environments are considered untrusted; server authorization is authoritative.
- Logs are assumed durable and access-controlled.

## Operational Runbook
- If suspicious admin activity is detected:
- Revoke affected admin sessions immediately.
- Rotate affected credentials and force password reset for impacted admin accounts.
- Review audit/security events for actor, endpoint, IP, and timeline correlation.
- Verify no unexpected admin accounts were created and no unauthorized privileged actions were executed.
- Document incident timeline and remediation actions.

## Scope And Disclosure
- This document is intentionally high-level for a public repository.
- It does not include secrets, private URLs, internal escalation procedures, or incident detection thresholds.
