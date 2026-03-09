import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import PublicFooter from './PublicFooter';
import SEOHead from './SEOHead';

type PublicLegalLayoutProps = {
  title: string;
  lastUpdated: string;
  canonicalPath: '/privacy' | '/terms' | '/contact' | '/attributions';
  metaDescription: string;
  children: ReactNode;
};

export default function PublicLegalLayout({
  title,
  lastUpdated,
  canonicalPath,
  metaDescription,
  children,
}: PublicLegalLayoutProps) {
  return (
    <div
      className="min-h-screen font-normal text-[#1F2A37]"
      style={{
        backgroundColor: '#1F2A37',
        backgroundImage:
          "linear-gradient(180deg, rgba(31,42,55,0.98) 0%, rgba(31,42,55,1) 100%), url('/branding/Background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      <SEOHead
        title={`${title} | Sonus`}
        description={metaDescription}
        canonical={`https://sonuslearning.com${canonicalPath}`}
        ogTitle={`${title} | Sonus`}
        ogUrl={`https://sonuslearning.com${canonicalPath}`}
      />
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/45 bg-white/62 backdrop-blur-2xl shadow-[0_10px_26px_-22px_rgba(15,23,42,0.55)]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-center px-4 sm:px-8">
          <Link to="/" aria-label="Sonus home">
            <img
              src="/branding/logo_name_solo.png"
              srcSet="/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 2000w"
              sizes="(max-width: 768px) 160px, 240px"
              width={2000}
              height={500}
              alt="Sonus"
              className="h-7 w-auto object-contain sm:h-8"
            />
          </Link>
        </div>
      </header>

      <main
        className="pt-16"
        style={{
          backgroundImage: 'linear-gradient(180deg, #ffffff 0px, #ffffff 64px, transparent 64px, transparent 100%)',
        }}
      >
        <section className="px-4 py-8 sm:px-8 sm:py-12">
          <div className="mx-auto w-full max-w-6xl rounded-2xl border border-[#94A3B8] bg-white p-5 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.6)] sm:p-10">
            <h1 className="main-font text-2xl leading-tight text-[#1F2A37] sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm text-[#475569] sm:text-base">Last updated: {lastUpdated}</p>
            <div className="mt-7 space-y-7 text-sm leading-relaxed text-[#334155] sm:text-base">{children}</div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
