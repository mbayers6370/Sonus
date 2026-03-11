import { Link } from 'react-router-dom';
import PublicFooter from './PublicFooter';
import SEOHead from './SEOHead';

function HeaderNav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/18 bg-[#1F2A37]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-8">
        <Link to="/" aria-label="Sonus home">
          <img
            src="/branding/Sonus-White-Transparent.png"
            srcSet="/branding/Sonus-White-Transparent-500.png 500w, /branding/Sonus-White-Transparent.png 1000w"
            sizes="(max-width: 768px) 160px, 220px"
            width={1000}
            height={200}
            alt="Sonus"
            className="h-7 w-auto object-contain sm:h-8"
          />
        </Link>
        <nav className="flex items-center gap-3 text-sm text-white/85">
          <Link to="/signup" className="rounded-lg border border-white/35 px-3 py-1.5 hover:bg-white/10">Start</Link>
          <Link to="/login" className="rounded-lg border border-transparent px-2 py-1.5 hover:text-white">Login</Link>
        </nav>
      </div>
    </header>
  );
}

type Phrase = {
  script: string;
  reading: string;
  english: string;
  note: string;
};

type Section = {
  title: string;
  intro: string;
  phrases: Phrase[];
};

function PhraseTable({ phrases }: { phrases: Phrase[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#CBD5E1] bg-white">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-[#F8FAFC] text-[#334155]">
          <tr>
            <th className="px-4 py-3 font-semibold">Japanese</th>
            <th className="px-4 py-3 font-semibold">Reading</th>
            <th className="px-4 py-3 font-semibold">English</th>
            <th className="px-4 py-3 font-semibold">When to use it</th>
          </tr>
        </thead>
        <tbody>
          {phrases.map((item) => (
            <tr key={`${item.script}-${item.english}`} className="border-t border-[#E2E8F0] align-top">
              <td className="px-4 py-3 font-medium text-[#1F2A37]">{item.script}</td>
              <td className="px-4 py-3 font-mono text-[#334155]">{item.reading}</td>
              <td className="px-4 py-3 text-[#1F2A37]">{item.english}</td>
              <td className="px-4 py-3 text-[#475569]">{item.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EssentialJapaneseTravelPhrasesPillarPage() {
  const title = 'Essential Japanese Travel Phrases (Audio + Practice) | Sonus';
  const description = 'Practical Japanese travel phrases with pronunciation support for airports, transport, hotels, restaurants, shopping, and emergencies.';
  const canonicalPath = '/essential-japanese-travel-phrases';
  const canonical = `https://sonuslearning.com${canonicalPath}`;

  const sections: Section[] = [
    {
      title: 'Airport & Arrival',
      intro: 'Use these lines for check-in, immigration, and baggage flow.',
      phrases: [
        { script: 'チェックインはどこですか。', reading: 'chekkuin wa doko desu ka', english: 'Where is check-in?', note: 'Use after entering departure hall.' },
        { script: 'これは私のパスポートです。', reading: 'kore wa watashi no pasupooto desu', english: 'This is my passport.', note: 'Use at counters and document checks.' },
      ],
    },
    {
      title: 'Transport & Directions',
      intro: 'Short phrases for taxis, stations, and navigation.',
      phrases: [
        { script: 'この住所までお願いします。', reading: 'kono juusho made onegai shimasu', english: 'Please take me to this address.', note: 'Show address on your phone.' },
        { script: '駅はどこですか。', reading: 'eki wa doko desu ka', english: 'Where is the station?', note: 'Core navigation line.' },
      ],
    },
    {
      title: 'Hotel & Restaurants',
      intro: 'For check-in, ordering, and paying.',
      phrases: [
        { script: '予約しています。', reading: 'yoyaku shiteimasu', english: 'I have a reservation.', note: 'Use at the hotel desk.' },
        { script: 'お会計をお願いします。', reading: 'okaikei o onegai shimasu', english: 'The bill, please.', note: 'Use when you are ready to pay.' },
      ],
    },
    {
      title: 'Emergency Basics',
      intro: 'Short lines for urgent help.',
      phrases: [
        { script: '助けてください。', reading: 'tasukete kudasai', english: 'Please help me.', note: 'Use for urgent assistance.' },
        { script: '病院はどこですか。', reading: 'byouin wa doko desu ka', english: 'Where is the hospital?', note: 'Use in medical situations.' },
      ],
    },
  ];

  const faq = [
    {
      question: 'Is this enough for a short trip?',
      answer: 'It covers high-frequency situations. For better retention, practice each line out loud and repeat in short sessions.',
    },
    {
      question: 'Do I need to memorize kanji first?',
      answer: 'No. Start with pronunciation and practical phrases, then add script familiarity as you go.',
    },
    {
      question: 'Can I practice this inside Sonus?',
      answer: 'Yes. Travel Sprint gives scenario-based practice with quick repetition and speaking support.',
    },
  ];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen font-normal text-[#1F2A37] bg-[linear-gradient(180deg,#1F2A37_0%,#203042_42%,#F8FAFC_42%,#F8FAFC_100%)]">
      <SEOHead
        title={title}
        description={description}
        canonical={canonical}
        ogTitle={title}
        ogDescription={description}
        ogUrl={canonical}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HeaderNav />

      <main className="pt-16">
        <section className="px-4 py-10 sm:px-8 sm:py-12">
          <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/20 bg-[#1F2A37]/88 p-6 text-white shadow-[0_24px_48px_-30px_rgba(15,23,42,0.65)] sm:p-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#B8CCDE]">Travel Sprint Resource</p>
            <h1 className="main-font mt-2 text-3xl leading-tight sm:text-5xl">Essential Japanese Travel Phrases (Audio + Practice)</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#D6E2EE] sm:text-base">
              A practical Japanese travel phrase guide focused on real situations, clear pronunciation, and fast recall.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/signup" className="rounded-xl border border-[#186E95] bg-[#186E95] px-4 py-2 text-sm font-semibold text-white hover:bg-[#145B7A]">
                Start Travel Sprint
              </Link>
              <Link to="/demo" className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                Try Demo
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 pb-12 sm:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-5">
            {sections.map((section) => (
              <article key={section.title} className="rounded-2xl border border-[#1F2A37]/14 bg-white p-5 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.45)] sm:p-6">
                <h2 className="main-font text-2xl text-[#1F2A37]">{section.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#475569]">{section.intro}</p>
                <div className="mt-4">
                  <PhraseTable phrases={section.phrases} />
                </div>
              </article>
            ))}

            <section className="rounded-2xl border border-[#1F2A37]/14 bg-white p-5 sm:p-6">
              <h2 className="main-font text-2xl text-[#1F2A37]">FAQ</h2>
              <div className="mt-4 space-y-3">
                {faq.map((item) => (
                  <details key={item.question} className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
                    <summary className="cursor-pointer font-semibold text-[#1F2A37]">{item.question}</summary>
                    <p className="mt-2 text-sm leading-relaxed text-[#475569]">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
