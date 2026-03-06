import PublicLegalLayout from './PublicLegalLayout';

const LAST_UPDATED = '2026-03-05';

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
        <p className="mt-2">This policy describes how Sonus currently collects, uses, and processes data. Implementation details may evolve as the platform develops.</p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Account Data</h2>
        <p className="mt-2">
          We store account profile data such as user ID, email, display name, target language, timezone, and
          onboarding status.
        </p>
        <p className="mt-2">
          In local auth mode, we store a password hash (not plaintext passwords), plus refresh-session metadata such as
          token hash, IP, and user-agent. In Supabase auth mode, authentication credentials are handled by Supabase.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Learning and Progress Data</h2>
        <p className="mt-2">
          We store progress and performance records, including streak/progress state, quiz attempts, speak attempts,
          and memory/review state used for spaced repetition.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Speech Processing</h2>
        <p className="mt-2">
          Sonus uses browser speech APIs for recognition in Speak mode. Raw microphone audio is processed in the user’s browser and is not uploaded or stored by Sonus.
        </p>
        <p className="mt-2">
          We do store recognized transcript text and derived scoring fields from speak attempts (for example
          initial/final/tone results and optional detected pinyin).
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Telemetry and Logging</h2>
        <p className="mt-2">
          The backend records operational logs (for example request path, status, duration, and authenticated user ID
          when available). Sonus also records limited product telemetry counters and stores a local event buffer in your
          browser. Sonus uses secure session cookies or tokens to maintain authenticated sessions.
        </p>
        <p className="mt-2">We do not currently integrate third-party ad analytics or third-party error-tracking SDKs.</p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">How We Use Data</h2>
        <p className="mt-2">
          We use data to operate accounts, deliver lessons, score quiz/speak activity, generate review queues, secure
          sessions, and maintain service reliability.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Service Providers</h2>
        <p className="mt-2">Sonus may use the following infrastructure providers to operate the service:</p>
        <p className="mt-2">
          Render (hosting/deployment), PostgreSQL hosting, Supabase (authentication when enabled), Resend (password
          reset and account deletion confirmation email when enabled), and Upstash Redis (rate limiting when enabled).
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Data Retention and Deletion</h2>
        <p className="mt-2">
          We retain account and learning records while your account is active and as needed for security and operations.
          You can permanently delete your account from the Profile screen. When email delivery is enabled, we also send
          a deletion confirmation email.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Children&apos;s Privacy</h2>
        <p className="mt-2">
          Sonus is intended for users age 13 and older. If you believe a child under 13 provided personal data, contact
          us and we will review and remove data as appropriate.
        </p>
      </section>

      <section>
        <h2 className="main-font text-xl text-[#1F2A37] sm:text-2xl">Contact</h2>
        <p className="mt-2">
          For privacy requests, contact{' '}
          <a className="underline underline-offset-4" href="mailto:support@sonuslearning.com">
            support@sonuslearning.com
          </a>
          .
        </p>
      </section>
    </PublicLegalLayout>
  );
}
