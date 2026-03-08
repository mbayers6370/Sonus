import PublicLegalLayout from './PublicLegalLayout';

const LAST_UPDATED = '2026-03-08';

export default function TermsPage() {
  return (
    <PublicLegalLayout
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      canonicalPath="/terms"
      metaDescription="Review the Sonus Terms of Service for account responsibilities, acceptable use, and service limitations."
    >
      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">1. Acceptance of These Terms</h2>
        <p className="mt-2">
          By accessing or using Sonus, you agree to these Terms of Service. If you do not agree to these Terms, do not
          use Sonus.
        </p>
        <p className="mt-2">
          If you use Sonus on behalf of an organization, you represent and warrant that you are authorized to bind
          that organization to these Terms, and &ldquo;you&rdquo; includes both you and that organization.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">2. Eligibility</h2>
        <p className="mt-2">
          You must be at least 13 years old, or older where required by local law in your jurisdiction, to use Sonus.
        </p>
        <p className="mt-2">
          You are responsible for ensuring that your use of Sonus is permitted under the laws that apply to you.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">3. Your Account</h2>
        <p className="mt-2">
          You are responsible for maintaining the confidentiality of your login credentials and for activity that
          occurs under your account.
        </p>
        <p className="mt-2">
          You agree to provide accurate, complete, and current account information and to keep that information
          updated.
        </p>
        <p className="mt-2">
          You may not share your account in a way that violates these Terms, circumvents plan or feature limits, or
          creates security or abuse risks for Sonus.
        </p>
        <p className="mt-2">
          If you believe your account has been accessed without authorization, contact{' '}
          <a className="underline underline-offset-4" href="mailto:support@sonuslearning.com">
            support@sonuslearning.com
          </a>{' '}
          as soon as possible.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">4. Acceptable Use</h2>
        <p className="mt-2">You agree not to misuse Sonus or help anyone else do so.</p>
        <p className="mt-2">This includes, for example, not:</p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>accessing or attempting to access systems, data, or accounts without authorization;</li>
          <li>interfering with or disrupting the service or its infrastructure;</li>
          <li>probing, scanning, or testing vulnerabilities except where expressly authorized;</li>
          <li>
            scraping, harvesting, or extracting content or data through automated means except where expressly
            permitted;
          </li>
          <li>
            reverse engineering, decompiling, or attempting to derive source code or underlying models except to the
            extent such restrictions are prohibited by applicable law;
          </li>
          <li>using Sonus for unlawful, fraudulent, abusive, or harmful purposes;</li>
          <li>circumventing rate limits, security measures, or feature restrictions.</li>
        </ul>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">5. Service Scope</h2>
        <p className="mt-2">
          Sonus provides casual language practice, speech-based exercises, travel phrase support, progress tools, and
          related language exploration features.
        </p>
        <p className="mt-2">
          Sonus is designed for informal practice, review, and travel-oriented familiarity. It is not a school, an
          accredited educational program, a certification provider, or a professional instruction service.
        </p>
        <p className="mt-2">
          Content and features are provided for general informational, practice, and entertainment purposes only. Sonus
          does not guarantee fluency, mastery, certification outcomes, or any specific learning result.
        </p>
        <p className="mt-2">
          Sonus is also not legal, medical, financial, immigration, travel-security, or other professional advice. You
          remain responsible for verifying important real-world information from appropriate official or authoritative
          sources.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">6. Intellectual Property</h2>
        <p className="mt-2">
          Sonus and its software, design, text, lessons, scoring logic, branding, visual assets, and other content are
          protected by intellectual property laws.
        </p>
        <p className="mt-2">
          Subject to these Terms, Sonus grants you a limited, revocable, non-exclusive, non-transferable,
          non-sublicensable license to access and use the service for your personal use or internal business use.
        </p>
        <p className="mt-2">
          You may not copy, reproduce, distribute, modify, create derivative works from, publicly display, publicly
          perform, or commercially exploit Sonus or its content except as expressly permitted by Sonus or by applicable
          law.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">7. Feedback</h2>
        <p className="mt-2">
          If you send Sonus suggestions, ideas, or feedback, Sonus may use that feedback without restriction or
          compensation to you, unless applicable law requires otherwise.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">8. Privacy</h2>
        <p className="mt-2">
          Your use of Sonus is also governed by the Sonus Privacy Policy, which explains how Sonus collects, uses,
          stores, and transfers personal data.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">9. Third-Party Services</h2>
        <p className="mt-2">
          Sonus may depend on or integrate with third-party services, platforms, browsers, hosting providers,
          authentication providers, payment providers, email providers, or speech-recognition technologies.
        </p>
        <p className="mt-2">
          Sonus is not responsible for third-party services, products, or websites that it does not control. Your use
          of those third-party services may also be governed by their own terms and privacy policies.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">10. Availability and Changes to the Service</h2>
        <p className="mt-2">
          Sonus may modify, update, suspend, or discontinue parts of the service from time to time.
        </p>
        <p className="mt-2">
          Sonus does not guarantee that every feature will always be available, uninterrupted, secure, error-free, or
          compatible with every device, browser, platform, region, or language environment.
        </p>
        <p className="mt-2">
          Sonus may also add, remove, or change features, limits, design elements, scoring behavior, lesson
          structures, supported languages, or integrations.
        </p>
        <p className="mt-2">Where required by law, Sonus will provide notice of material changes.</p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">11. Beta Features</h2>
        <p className="mt-2">
          Some Sonus features may be labeled as beta, preview, experimental, or similar.
        </p>
        <p className="mt-2">
          Those features may be incomplete, change unexpectedly, contain errors, or be withdrawn at any time. Sonus
          may review feedback, usage patterns, and technical performance to improve or retire those features.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">12. Suspension and Termination</h2>
        <p className="mt-2">Sonus may suspend or terminate your access to the service if:</p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>you violate these Terms;</li>
          <li>your use creates security, legal, or operational risk;</li>
          <li>Sonus reasonably suspects fraud, abuse, or unauthorized access;</li>
          <li>Sonus is required to do so by law or valid legal process.</li>
        </ul>
        <p className="mt-2">
          You may stop using Sonus at any time. You may also delete your account using available account controls,
          where supported.
        </p>
        <p className="mt-2">
          Termination or suspension does not affect provisions of these Terms that by their nature should survive,
          including provisions relating to intellectual property, disclaimers, liability limits, disputes, and
          enforcement.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">13. Disclaimers</h2>
        <p className="mt-2">To the fullest extent permitted by law, Sonus is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.</p>
        <p className="mt-2">Sonus does not guarantee that:</p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>the service will always be available, uninterrupted, or error-free;</li>
          <li>speech recognition, scoring, feedback, or generated study flow will always be accurate;</li>
          <li>
            travel or cultural guidance will always be complete, current, or suitable for your specific circumstances;
          </li>
          <li>content will meet every user&apos;s expectations, goals, or certification requirements.</li>
        </ul>
        <p className="mt-2">
          Nothing in these Terms excludes any warranty or guarantee that cannot be excluded under applicable law.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">14. Limitation of Liability</h2>
        <p className="mt-2">
          To the fullest extent permitted by law, Sonus and its affiliates, licensors, service providers, and partners
          will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or
          for any loss of profits, revenues, goodwill, business opportunity, data, or use, arising out of or related
          to your use of or inability to use Sonus.
        </p>
        <p className="mt-2">
          To the fullest extent permitted by law, the total aggregate liability of Sonus for claims arising out of or
          relating to the service or these Terms will not exceed the greater of:
        </p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>the amount you paid to Sonus for the service in the 12 months before the event giving rise to the claim; or</li>
          <li>USD $100.</li>
        </ul>
        <p className="mt-2">
          Nothing in these Terms limits or excludes liability for fraud, fraudulent misrepresentation, death or
          personal injury caused by negligence, or any other liability or consumer right that cannot be limited or
          excluded under applicable law. Consumer protection rules in a number of jurisdictions restrict the
          enforceability of unfair or overbroad exclusions, so mandatory rights remain in effect where they apply.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">15. Indemnity</h2>
        <p className="mt-2">
          To the extent permitted by law, you agree to indemnify and hold harmless Sonus and its affiliates, officers,
          directors, employees, and agents from claims, liabilities, damages, losses, and expenses arising out of or
          related to:
        </p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>your misuse of Sonus;</li>
          <li>your violation of these Terms; or</li>
          <li>your violation of applicable law or the rights of another person.</li>
        </ul>
        <p className="mt-2">This section does not apply to the extent prohibited by applicable consumer law.</p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">16. Export Controls and Sanctions</h2>
        <p className="mt-2">
          You may not use Sonus in violation of applicable export controls, sanctions laws, or trade restrictions.
        </p>
        <p className="mt-2">You represent that you are not prohibited from using the service under applicable law.</p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">17. Governing Law</h2>
        <p className="mt-2">
          Unless mandatory local law requires otherwise, these Terms are governed by the laws of the jurisdiction in
          which Sonus is operated, without regard to conflict-of-law rules.
        </p>
        <p className="mt-2">
          If you are a consumer, nothing in these Terms deprives you of mandatory protections granted by the laws of
          the country where you habitually reside. Consumer law in the EU and UK, for example, limits the effect of
          unfair standard terms and preserves mandatory statutory protections.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">18. Disputes</h2>
        <p className="mt-2">
          Before filing a formal claim, you and Sonus agree to try to resolve the dispute informally by contacting{' '}
          <a className="underline underline-offset-4" href="mailto:support@sonuslearning.com">
            support@sonuslearning.com
          </a>
          .
        </p>
        <p className="mt-2">
          If a dispute cannot be resolved informally, it may be brought in the courts that have jurisdiction under
          applicable law.
        </p>
        <p className="mt-2">
          Nothing in these Terms limits any rights you may have under mandatory consumer protection law to bring claims
          in a court that is legally available to you.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">19. Changes to These Terms</h2>
        <p className="mt-2">Sonus may update these Terms from time to time.</p>
        <p className="mt-2">
          If Sonus makes material changes, Sonus will update the &ldquo;Last updated&rdquo; date and, where required by law,
          provide additional notice. Continued use of Sonus after revised Terms become effective means you accept the
          updated Terms.
        </p>
        <p className="mt-2">Changes will not apply retroactively unless required by law or expressly stated.</p>
        <p className="mt-2">
          Regulators have warned that quietly rewriting terms in ways consumers would not reasonably expect can raise
          unfairness or deception concerns, so clear notice matters here.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">20. Severability</h2>
        <p className="mt-2">
          If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will remain
          in effect to the extent legally possible.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">21. Entire Agreement</h2>
        <p className="mt-2">
          These Terms, together with the Privacy Policy and any other policies or notices expressly incorporated by
          reference, form the entire agreement between you and Sonus regarding your use of the service, except where
          additional terms apply to a specific feature or offering.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">22. Contact</h2>
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
