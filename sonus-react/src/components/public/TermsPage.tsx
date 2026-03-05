import PublicLegalLayout from './PublicLegalLayout';

const LAST_UPDATED = '2026-03-05';

export default function TermsPage() {
  return (
    <PublicLegalLayout title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Acceptance of Terms</h2>
        <p className="mt-2">By using Sonus, you agree to these Terms.</p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Account Responsibility</h2>
        <p className="mt-2">
          You are responsible for account access, account activity, and keeping your sign-in details secure.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Acceptable Use</h2>
        <p className="mt-2">
          Do not misuse the service, attempt unauthorized access, interfere with platform operations, or use Sonus for
          unlawful activity. You agree not to attempt reverse engineering, automated scraping, or abuse of platform APIs.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Educational Use</h2>
        <p className="mt-2">
          Sonus is an educational language-learning tool. It is not professional, legal, medical, or financial advice.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Service Availability / No Warranty</h2>
        <p className="mt-2">
          Sonus is provided on an &quot;as is&quot; and &quot;as available&quot; basis. Features may change, be interrupted,
          or be removed at any time.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Limitation of Liability</h2>
        <p className="mt-2">
          To the extent permitted by law, Sonus is not liable for indirect, incidental, special, consequential, or
          punitive damages arising from use of the service.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Termination</h2>
        <p className="mt-2">
          We may suspend or terminate access for policy violations, abuse, security concerns, or legal reasons.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Changes to Terms</h2>
        <p className="mt-2">
          We may update these Terms. Continued use after updates means you accept the revised Terms.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Contact</h2>
        <p className="mt-2">
          Questions about these Terms can be sent to{' '}
          <a className="underline underline-offset-4" href="mailto:support@sonuslearning.com">
            support@sonuslearning.com
          </a>
          .
        </p>
      </section>
    </PublicLegalLayout>
  );
}
