import PublicLegalLayout from './PublicLegalLayout';

const LAST_UPDATED = '2026-03-07';

export default function PrivacyPage() {
  return (
    <PublicLegalLayout
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      canonicalPath="/privacy"
      metaDescription="Read how Sonus collects, uses, and protects account, learning, and usage data."
    >
      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Overview</h2>
        <p className="mt-2">
          This Privacy Policy explains how Sonus collects, uses, stores, shares, and transfers personal data. It is
          written to support a global user base and to reflect major privacy principles, including transparency,
          purpose limitation, data minimization, security, and user rights.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">1. Who We Are</h2>
        <p className="mt-2">
          Sonus Learning is the controller of personal data processed through the Sonus platform, except where a third
          party independently determines the purposes and means of processing for its own services.
        </p>
        <p className="mt-2">
          If you have questions about this Privacy Policy or want to make a privacy request, you can contact us at{' '}
          <a className="underline underline-offset-4" href="mailto:support@sonuslearning.com">
            support@sonuslearning.com
          </a>
          .
        </p>
        <p className="mt-2">
          If required by applicable law, Sonus may designate a local representative for certain regions and identify
          that representative in a supplemental notice.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">2. Scope of This Policy</h2>
        <p className="mt-2">
          This Privacy Policy applies to Sonus accounts, authentication, learning and travel features, speech scoring,
          practice and progress features, support interactions, telemetry, and security operations.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">3. Personal Data We Collect</h2>
        <p className="mt-2 font-semibold">Account and Profile Data</p>
        <p className="mt-2">
          Sonus stores account profile data such as user ID, email address, display name, target language, timezone,
          onboarding status, and similar account configuration details.
        </p>
        <p className="mt-2 font-semibold">Authentication and Session Data</p>
        <p className="mt-2">
          If Sonus uses local authentication, we store a password hash rather than a plaintext password, along with
          session or refresh-token metadata such as token hash, IP address, browser or device information, and session
          timing data.
        </p>
        <p className="mt-2">
          If Sonus uses Supabase authentication, authentication credentials are processed through Supabase.
        </p>
        <p className="mt-2 font-semibold">Learning and Progress Data</p>
        <p className="mt-2">
          Sonus stores practice and progress records needed to operate the service, 
          including activity progress, streaks, quiz attempts, speak attempts, review state, 
          feature progression state, and Travel Sprint phrase states such as learned, locked, or 
          checked status.
        </p>
        <p className="mt-2 font-semibold">Browser-Local Storage and Similar Technologies</p>
        <p className="mt-2">
          Sonus uses browser local storage, session storage, and similar technologies to support core product
          functionality, such as walkthrough completion state, resume or navigation guards, session continuity, and
          feature-state persistence.
        </p>
        <p className="mt-2">
          If Sonus later uses cookies or similar technologies for analytics, marketing, advertising, or other
          non-essential purposes, this Privacy Policy will be updated to describe those technologies, their purposes,
          retention periods, third-party recipients, and any consent or opt-out controls required by applicable law.
        </p>
        <p className="mt-2 font-semibold">Speech Processing</p>
        <p className="mt-2">
          Sonus uses browser speech APIs for recognition in Speak mode. Sonus does not upload or store raw microphone
          audio on Sonus servers.
        </p>
        <p className="mt-2">
          Sonus does store recognized transcript text and derived scoring fields from speak attempts, such as
          pronunciation component results, detected transcript text, and optional detected pinyin.
        </p>
        <p className="mt-2">
          Speech recognition itself may be processed by your browser or platform provider according to that provider’s
          own policies.
        </p>
        <p className="mt-2 font-semibold">Telemetry, Logs, and Security Data</p>
        <p className="mt-2">
          Sonus collects service and security logs such as request path, response status, duration, authenticated user
          ID when available, IP address, browser or device information, and similar operational records.
        </p>
        <p className="mt-2">
          Sonus may also store limited product telemetry and local event buffers used for reliability, debugging, abuse
          prevention, and service improvement.
        </p>
        <p className="mt-2">Sonus does not currently use third-party advertising analytics SDKs.</p>
        <p className="mt-2 font-semibold">Support and Communications Data</p>
        <p className="mt-2">
          If you contact Sonus, we may store your message, contact details, and records of the support request and our
          response.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">4. How We Use Data</h2>
        <p className="mt-2">
          Sonus uses personal data to:
        </p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>create and maintain accounts</li>
          <li>authenticate users and manage sessions</li>
          <li>deliver practice activities, Travel Sprint, and other language support features</li>
          <li>score quiz and speaking activity</li>
          <li>generate review queues and repeat-practice flows</li>
          <li>maintain activity continuity and progress state</li>
          <li>support product reliability, debugging, and security</li>
          <li>prevent abuse, fraud, and misuse</li>
          <li>send transactional messages such as password resets or deletion confirmations</li>
          <li>respond to support requests</li>
          <li>comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">5. Legal Bases for Processing</h2>
        <p className="mt-2">
          Depending on your jurisdiction and the context, Sonus processes personal data under one or more of the
          following legal bases:
        </p>
        <p className="mt-2">
          Contract performance: to provide the service, create and maintain your account, deliver activities, score 
          activity, and support core product functionality.
        </p>
        <p className="mt-2">
          Legitimate interests: to secure the platform, prevent abuse, monitor reliability, improve the service, and
          maintain operational integrity.
        </p>
        <p className="mt-2">
          Consent: where required by law, including where certain optional processing activities or future
          non-essential tracking technologies may require consent.
        </p>
        <p className="mt-2">
          Legal obligations: to comply with applicable law, valid legal process, tax or accounting obligations, fraud
          prevention requirements, or other mandatory compliance duties.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">6. When Providing Data Is Necessary</h2>
        <p className="mt-2">
          Some personal data is necessary to create and operate an account, authenticate you, maintain secure 
          sessions, and provide language practice features.
        </p>
        <p className="mt-2">
          If you choose not to provide required information, some or all parts of Sonus may not function properly or
          may be unavailable to you.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">7. Service Providers and Recipients</h2>
        <p className="mt-2">
          Sonus may share personal data with service providers that help operate the platform, including providers for
          hosting, database services, authentication, email delivery, rate limiting, and similar infrastructure.
        </p>
        <p className="mt-2">These providers may include:</p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>Render</li>
          <li>PostgreSQL hosting providers</li>
          <li>Supabase</li>
          <li>Resend</li>
          <li>Upstash Redis</li>
        </ul>
        <p className="mt-2">depending on which features are enabled in the product environment.</p>
        <p className="mt-2">
          These providers generally process personal data on Sonus&apos;s behalf, although some providers may act as
          independent controllers for limited parts of their services.
        </p>
        <p className="mt-2">
          Some browser or platform speech-recognition providers may process audio or transcript data under their own
          terms when you use speech features. Where those providers independently determine aspects of that processing,
          they may act as independent controllers for their own services rather than only as Sonus processors.
        </p>
        <p className="mt-2">
          Sonus may also disclose data where required by law, to respond to valid legal process, to protect rights or
          safety, to enforce terms, or to prevent fraud, abuse, or security incidents.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">8. International Data Transfers</h2>
        <p className="mt-2">
          Sonus infrastructure and service providers may process personal data in multiple countries.
        </p>
        <p className="mt-2">
          Where applicable law restricts cross-border transfers, Sonus will rely on recognized safeguards or lawful
          transfer mechanisms, such as adequacy decisions, standard contractual clauses, the UK International Data
          Transfer Agreement, the UK Addendum, or comparable legal protections.
        </p>
        <p className="mt-2">You may contact us for more information about applicable transfer safeguards.</p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">9. Data Retention</h2>
        <p className="mt-2">
          Sonus retains personal data for as long as reasonably necessary for the purposes described in this Privacy
          Policy, including to provide the service, maintain learning history, secure the platform, comply with legal
          obligations, resolve disputes, and enforce agreements.
        </p>
        <p className="mt-2">In general:</p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>account and practice records are retained while your account remains active</li>
          <li>
            security and operational logs are retained for a limited period appropriate to security, abuse prevention,
            and reliability needs
          </li>
          <li>
            browser-local data remains on your device until cleared by your browser, overwritten by the product, or
            removed through app actions
          </li>
          <li>
            deleted-account data may remain in backups or logs for a limited period before secure deletion or rotation
          </li>
        </ul>
        <p className="mt-2">
          You may permanently delete your account from the Profile screen or by contacting support. Sonus may retain
          limited information where required for legal compliance, fraud prevention, security, or the establishment,
          exercise, or defense of legal claims.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">10. Your Privacy Rights</h2>
        <p className="mt-2">Subject to local law, you may have the right to:</p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>access your personal data</li>
          <li>correct inaccurate data</li>
          <li>delete your data</li>
          <li>restrict certain processing</li>
          <li>object to certain processing</li>
          <li>receive a portable copy of certain data</li>
          <li>withdraw consent where consent is the legal basis</li>
          <li>lodge a complaint with a relevant supervisory or regulatory authority</li>
        </ul>
        <p className="mt-2">
          To submit a privacy request, contact{' '}
          <a className="underline underline-offset-4" href="mailto:support@sonuslearning.com">
            support@sonuslearning.com
          </a>
          .
        </p>
        <p className="mt-2">
          Please send the request from the email address linked to your account when possible. Sonus may request
          additional information to verify your identity before completing a request.
        </p>
        <p className="mt-2">In some cases, Sonus may refuse or limit a request where permitted by law.</p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">11. Automated Decision-Making</h2>
        <p className="mt-2">
          Sonus uses automated systems to score speech attempts, generate review queues, gate certain feature states, 
          and personalize aspects of app flow.
        </p>
        <p className="mt-2">
          At this time, Sonus does not use automated decision-making that produces legal effects or similarly
          significant effects on users.
        </p>
        <p className="mt-2">
          If that changes, Sonus will update this Privacy Policy and provide any additional disclosures required by law.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">12. Security</h2>
        <p className="mt-2">
          Sonus uses technical and organizational safeguards designed to protect personal data, including
          authentication controls, hashed credentials, access restrictions, session protections, rate limiting, and
          operational monitoring.
        </p>
        <p className="mt-2">
          No system can guarantee absolute security, but Sonus works to reduce risk and respond appropriately to
          security incidents.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">13. Children&apos;s Privacy</h2>
        <p className="mt-2">
          Sonus is intended for users age 13 and older, or older where required by local law.
        </p>
        <p className="mt-2">
          Sonus does not knowingly permit children below the applicable minimum age to use the service. If you believe
          a child provided personal data in violation of this Privacy Policy, contact us and Sonus will review and,
          where appropriate, delete the data.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">14. Regional Privacy Notes</h2>
        <p className="mt-2 font-semibold">EEA, UK, and Switzerland</p>
        <p className="mt-2">
          Users in these regions may have additional rights and protections under applicable privacy law, including
          rights relating to access, correction, deletion, objection, restriction, portability, consent withdrawal, and
          complaints to a supervisory authority.
        </p>
        <p className="mt-2 font-semibold">California and Similar U.S. State Laws</p>
        <p className="mt-2">
          Where applicable state privacy laws apply, Sonus will honor qualifying rights requests and provide any
          additional disclosures required by those laws.
        </p>
        <p className="mt-2">
          Sonus does not currently sell personal information or share personal information for cross-context behavioral
          advertising as those terms are commonly used in certain U.S. privacy statutes.
        </p>
        <p className="mt-2 font-semibold">Other Regions</p>
        <p className="mt-2">
          Where local law imposes additional requirements, Sonus may publish supplemental regional notices or apply
          region-specific handling as needed.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">15. Changes to This Policy</h2>
        <p className="mt-2">
          Sonus may update this Privacy Policy from time to time as features, providers, operations, or legal
          requirements change.
        </p>
        <p className="mt-2">
          When changes are published, Sonus will update the &quot;Last updated&quot; date above. Where required by law, Sonus
          will provide additional notice.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">16. Contact</h2>
        <p className="mt-2">
          For privacy questions or requests, contact{' '}
          <a className="underline underline-offset-4" href="mailto:support@sonuslearning.com">
            support@sonuslearning.com
          </a>
          .
        </p>
      </section>
    </PublicLegalLayout>
  );
}
