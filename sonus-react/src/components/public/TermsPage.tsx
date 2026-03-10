import PublicLegalLayout from './PublicLegalLayout';
import { TERMS_OF_SERVICE_LAST_UPDATED, TermsOfServiceContent } from './LegalDocuments';

export default function TermsPage() {
  return (
    <PublicLegalLayout
      title="Terms of Service"
      lastUpdated={TERMS_OF_SERVICE_LAST_UPDATED}
      canonicalPath="/terms"
      metaDescription="Review the Sonus Terms of Service for account responsibilities, acceptable use, and service limitations."
    >
      <TermsOfServiceContent />
    </PublicLegalLayout>
  );
}
