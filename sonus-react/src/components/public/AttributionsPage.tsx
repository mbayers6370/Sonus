import PublicLegalLayout from './PublicLegalLayout';

const LAST_UPDATED = '2026-03-08';

export default function AttributionsPage() {
  return (
    <PublicLegalLayout
      title="Data Attributions"
      lastUpdated={LAST_UPDATED}
      canonicalPath="/attributions"
      metaDescription="Data attribution summary for Sonus language datasets and enrichment sources."
    >
      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Data Sources</h2>
        <p className="mt-2">
          Sonus language datasets include material adapted from public and third-party sources.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>JLPT study datasets originally compiled by TANOS (tanos.co.uk)</li>
          <li>Tatoeba examples (CC-BY)</li>
        </ul>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">License Note</h2>
        <p className="mt-2">Sonus respects upstream licenses and attribution requirements for all dataset sources.</p>
        <p className="mt-2">
          For questions about data provenance or licensing, contact{' '}
          <a className="underline underline-offset-4" href="mailto:support@sonuslearning.com">
            support@sonuslearning.com
          </a>
          .
        </p>
      </section>
    </PublicLegalLayout>
  );
}
