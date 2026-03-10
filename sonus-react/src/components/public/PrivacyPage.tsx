import PublicLegalLayout from './PublicLegalLayout';
import { PRIVACY_POLICY_LAST_UPDATED, PrivacyPolicyContent } from './LegalDocuments';

export default function PrivacyPage() {
  return (
    <PublicLegalLayout
      title="Privacy Policy"
      lastUpdated={PRIVACY_POLICY_LAST_UPDATED}
      canonicalPath="/privacy"
      metaDescription="Read how Sonus collects, uses, and protects account, learning, and usage data."
    >
      <PrivacyPolicyContent />
    </PublicLegalLayout>
  );
}
