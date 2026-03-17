# Privacy Policy

**Last updated:** March 7, 2026

## Overview

Sonus is committed to protecting your privacy. This document explains what data we collect, how we use it, and your rights regarding your information.

For a detailed code-backed inventory of data collection and handling, see [privacy-implementation-inventory.md](./privacy-implementation-inventory.md).

## Data We Collect

### Account & Authentication
- Email address
- Display name
- Target language preference
- Timezone
- Password hash (if using local auth mode)
- Account creation and update timestamps

### Learning Activity
- Quiz and speaking practice attempts
- Word progress and mastery state
- Lesson completion and progression path
- Spaced review scheduling state
- Learning streaks and progress metrics

### Technical & Session Data
- Login sessions and refresh tokens (hashed)
- IP address and user agent (for security and audit logging)
- Password reset tokens (hashed, single-use, time-limited)
- API request logs and response times

### Browser/Client Data
- Analytics events stored locally in browser storage
- Speech recognition transcripts (processed locally in browser)

## How We Use Your Data

- **Service delivery:** Account management, learning flow, progress tracking, and personalized review scheduling
- **Security:** Authentication, session management, abuse prevention, and audit logging
- **Analytics:** Usage patterns to improve features and identify issues (anonymized where possible)
- **Communication:** Account notifications, password reset, and support responses
- **Legal compliance:** Fulfilling legal obligations and protecting rights

## Third-Party Services

Depending on configuration, Sonus may integrate with:

- **Supabase Auth** (optional, for authentication) — handles sign-up, login, and session refresh
- **Email providers** (for password reset confirmations and notifications)
- **Hosting platforms** (for application hosting and database services)

These third parties have access only to data necessary to provide their services and are contractually bound to protect your privacy.

## Data Retention

- **Account data:** Retained for the life of your account; deletion upon account removal
- **Learning history:** Retained for active use; subject to your account retention settings
- **Session tokens:** Automatically expires per your session TTL setting
- **Password reset tokens:** Single-use; expires within 60 minutes
- **Logs:** Retained for operational and security purposes; subject to company retention policies

For specific retention timelines, see `docs/ENV.md` for `ACCOUNT_DELETION_HOLD_DAYS` and related settings.

## Your Rights

You have the right to:

- **Access:** Request all personal data we hold about you
- **Correction:** Update or correct inaccurate information
- **Deletion:** Request account and data removal (subject to legal holds and backup retention)
- **Portability:** Receive your data in a structured, portable format
- **Opt-out:** Control how your data is used for analytics and communications

To exercise these rights, contact support@sonuslearning.com.

## Security

- Passwords are hashed using industry-standard algorithms, never stored as plaintext
- Sensitive operations (password reset, account deletion) require re-authentication
- Session tokens expire and can be revoked
- Admin access is role-gated and audit-logged
- Transport security (HTTPS/TLS) is enforced in production

For detailed security practices, see [ADMIN_SECURITY.md](./ADMIN_SECURITY.md).

## Children's Privacy

Sonus is intended for users 13 and older. We do not knowingly collect data from children under 13. If we become aware of such collection, we will take steps to delete the data and terminate the child's account.

## Changes to This Policy

We may update this policy periodically. Significant changes will be communicated via email or app notification. Continued use of Sonus after changes constitutes acceptance of the updated policy.

## Contact

For privacy inquiries, questions, or to exercise your rights:

**Email:** support@sonuslearning.com

**Mailing Address:** [Add as needed for your jurisdiction]

---

**Live Privacy Policy:** The authoritative privacy policy is displayed in the Sonus app at `/privacy`. This document serves as a reference for developers and collaborators.
