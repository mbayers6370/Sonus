import { Link } from 'react-router-dom';
import PublicFooter from './PublicFooter';
import SEOHead from './SEOHead';

type PhraseItem = {
  chinese: string;
  pinyin: string;
  english: string;
  note: string;
};

type PhraseSection = {
  title: string;
  intro: string;
  phrases: PhraseItem[];
};

type FaqItem = {
  question: string;
  answer: string;
};

type SeoTravelPageProps = {
  title: string;
  description: string;
  canonicalPath: string;
  h1: string;
  intro: string;
  sections: PhraseSection[];
  faq: FaqItem[];
  related: Array<{ to: string; label: string }>;
};

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Static page-level schema payload for crawlable FAQ structure.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

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

function PhraseTable({ phrases }: { phrases: PhraseItem[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#CBD5E1] bg-white">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-[#F8FAFC] text-[#334155]">
          <tr>
            <th className="px-4 py-3 font-semibold">Chinese</th>
            <th className="px-4 py-3 font-semibold">Pinyin</th>
            <th className="px-4 py-3 font-semibold">English</th>
            <th className="px-4 py-3 font-semibold">When to use it</th>
          </tr>
        </thead>
        <tbody>
          {phrases.map((item) => (
            <tr key={`${item.chinese}-${item.english}`} className="border-t border-[#E2E8F0] align-top">
              <td className="px-4 py-3 font-medium text-[#1F2A37]">{item.chinese}</td>
              <td className="px-4 py-3 font-mono text-[#334155]">{item.pinyin}</td>
              <td className="px-4 py-3 text-[#1F2A37]">{item.english}</td>
              <td className="px-4 py-3 text-[#475569]">{item.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FaqSection({ faq }: { faq: FaqItem[] }) {
  return (
    <section aria-labelledby="faq-heading" className="rounded-2xl border border-[#1F2A37]/14 bg-white p-5 sm:p-6">
      <h2 id="faq-heading" className="main-font text-2xl text-[#1F2A37]">FAQ</h2>
      <div className="mt-4 space-y-3">
        {faq.map((item) => (
          <details key={item.question} className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
            <summary className="cursor-pointer font-semibold text-[#1F2A37]">{item.question}</summary>
            <p className="mt-2 text-sm leading-relaxed text-[#475569]">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function SeoTravelPage({
  title,
  description,
  canonicalPath,
  h1,
  intro,
  sections,
  faq,
  related,
}: SeoTravelPageProps) {
  const canonical = `https://sonuslearning.com${canonicalPath}`;
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
      <JsonLd data={faqJsonLd} />
      <HeaderNav />

      <main className="pt-16">
        <section className="px-4 py-10 sm:px-8 sm:py-12">
          <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/20 bg-[#1F2A37]/88 p-6 text-white shadow-[0_24px_48px_-30px_rgba(15,23,42,0.65)] sm:p-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#B8CCDE]">Travel Sprint Resource</p>
            <h1 className="main-font mt-2 text-3xl leading-tight sm:text-5xl">{h1}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#D6E2EE] sm:text-base">{intro}</p>
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

            <section className="rounded-2xl border border-[#3E5648]/30 bg-[rgba(62,86,72,0.07)] p-5 sm:p-6">
              <h2 className="main-font text-2xl text-[#1F2A37]">Related Mandarin Travel Guides</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {related.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="inline-flex text-sm font-semibold text-[#145B7A] underline underline-offset-4">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <FaqSection faq={faq} />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

const allRelatedLinks = [
  { to: '/travel-mandarin-phrases', label: 'Essential Mandarin Travel Phrases' },
  { to: '/mandarin-airport-phrases', label: 'Mandarin Airport Phrases' },
  { to: '/mandarin-taxi-phrases', label: 'Mandarin Taxi Phrases' },
  { to: '/how-to-order-food-in-chinese', label: 'How to Order Food in Chinese' },
];

export function TravelMandarinPhrasesPage() {
  return (
    <SeoTravelPage
      title="Essential Mandarin Travel Phrases | Sonus Travel Sprint"
      description="Useful Mandarin travel phrases with Chinese, pinyin, and practical context for airports, transport, hotels, food, shopping, and emergencies."
      canonicalPath="/travel-mandarin-phrases"
      h1="Essential Mandarin Travel Phrases"
      intro="A practical phrase guide for real travel situations in China. Each phrase includes Chinese characters, pinyin, and clear context so you can use it immediately."
      sections={[
        {
          title: 'Airport',
          intro: 'Use these for check-in, immigration, and baggage issues.',
          phrases: [
            { chinese: '请问值机柜台在哪里？', pinyin: 'qǐng wèn zhí jī guì tái zài nǎ lǐ', english: 'Where is the check-in counter?', note: 'Use right after entering departure hall.' },
            { chinese: '这是我的护照和登机牌。', pinyin: 'zhè shì wǒ de hù zhào hé dēng jī pái', english: 'Here is my passport and boarding pass.', note: 'At immigration or boarding gate.' },
          ],
        },
        {
          title: 'Transport',
          intro: 'Short lines for taxi or metro navigation.',
          phrases: [
            { chinese: '去这个地址。', pinyin: 'qù zhè gè dì zhǐ', english: 'Go to this address.', note: 'Show driver the address in Chinese.' },
            { chinese: '到了请告诉我。', pinyin: 'dào le qǐng gào sù wǒ', english: 'Please tell me when we arrive.', note: 'Useful if you are unfamiliar with area.' },
          ],
        },
        {
          title: 'Hotel',
          intro: 'For check-in and room requests.',
          phrases: [
            { chinese: '我有预订。', pinyin: 'wǒ yǒu yù dìng', english: 'I have a reservation.', note: 'At front desk.' },
            { chinese: '可以晚一点退房吗？', pinyin: 'kě yǐ wǎn yì diǎn tuì fáng ma', english: 'Is late checkout possible?', note: 'Ask night before checkout.' },
          ],
        },
        {
          title: 'Food',
          intro: 'Simple ordering language for restaurants.',
          phrases: [
            { chinese: '这个菜有花生吗？', pinyin: 'zhè gè cài yǒu huā shēng ma', english: 'Does this dish contain peanuts?', note: 'Allergy check before ordering.' },
            { chinese: '买单，谢谢。', pinyin: 'mǎi dān, xiè xie', english: 'Bill, please. Thank you.', note: 'Use when ready to pay.' },
          ],
        },
        {
          title: 'Shopping',
          intro: 'Useful checkout and payment lines.',
          phrases: [
            { chinese: '可以刷卡吗？', pinyin: 'kě yǐ shuā kǎ ma', english: 'Can I pay by card?', note: 'Ask before purchase if unsure.' },
            { chinese: '可以开发票吗？', pinyin: 'kě yǐ kāi fā piào ma', english: 'Can you issue an invoice?', note: 'Useful for business travel.' },
          ],
        },
        {
          title: 'Emergencies',
          intro: 'Priority phrases for urgent support.',
          phrases: [
            { chinese: '请帮我打120。', pinyin: 'qǐng bāng wǒ dǎ yāo èr líng', english: 'Please call 120 for me.', note: 'Medical emergency.' },
            { chinese: '我的护照丢了。', pinyin: 'wǒ de hù zhào diū le', english: 'I lost my passport.', note: 'At police station or hotel desk.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'Are these phrases enough for a short trip?',
          answer: 'They cover high-frequency scenarios. For better fluency under stress, practice with repetition and listening drills.',
        },
        {
          question: 'Should I use characters or only pinyin?',
          answer: 'Use both. Pinyin helps pronunciation, but characters are useful for showing addresses and confirming details.',
        },
        {
          question: 'Where can I practice these with audio?',
          answer: 'Inside Sonus Travel Sprint, where each scenario is trained with short practical phrase sets.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/travel-mandarin-phrases')}
    />
  );
}

export function MandarinAirportPhrasesPage() {
  return (
    <SeoTravelPage
      title="Mandarin Airport Phrases for Travelers | Sonus"
      description="Mandarin airport phrases for check-in, passport control, customs, baggage, gates, and delays with Chinese, pinyin, and practical notes."
      canonicalPath="/mandarin-airport-phrases"
      h1="Mandarin Airport Phrases for Travelers"
      intro="Use these before you fly to reduce friction at check-in, immigration, baggage claim, and gate changes. The focus is practical, beginner-friendly, and fast to rehearse."
      sections={[
        {
          title: 'Check-In and Documents',
          intro: 'Core lines at airline counters and document checks.',
          phrases: [
            { chinese: '我要办理值机。', pinyin: 'wǒ yào bàn lǐ zhí jī', english: 'I want to check in.', note: 'Start of check-in interaction.' },
            { chinese: '我可以托运这个行李吗？', pinyin: 'wǒ kě yǐ tuō yùn zhè gè xíng lǐ ma', english: 'Can I check this bag?', note: 'Before placing bag on scale.' },
            { chinese: '登机口改了吗？', pinyin: 'dēng jī kǒu gǎi le ma', english: 'Has the gate changed?', note: 'When departure screen is unclear.' },
          ],
        },
        {
          title: 'Immigration and Customs',
          intro: 'Simple responses for entry formalities.',
          phrases: [
            { chinese: '我来旅游，停留五天。', pinyin: 'wǒ lái lǚ yóu, tíng liú wǔ tiān', english: 'I am here for tourism, staying five days.', note: 'Typical immigration question.' },
            { chinese: '我没有需要申报的物品。', pinyin: 'wǒ méi yǒu xū yào shēn bào de wù pǐn', english: 'I have nothing to declare.', note: 'Customs declaration line.' },
            { chinese: '请问外籍旅客通道在哪里？', pinyin: 'qǐng wèn wài jí lǚ kè tōng dào zài nǎ lǐ', english: 'Where is the foreign traveler lane?', note: 'If lane signage is unclear.' },
          ],
        },
        {
          title: 'Baggage, Delays, and Transfers',
          intro: 'When plans change or luggage does not arrive.',
          phrases: [
            { chinese: '我的行李还没出来。', pinyin: 'wǒ de xíng lǐ hái méi chū lái', english: 'My baggage has not arrived yet.', note: 'At baggage service desk.' },
            { chinese: '我的航班延误了吗？', pinyin: 'wǒ de háng bān yán wù le ma', english: 'Is my flight delayed?', note: 'At gate or service desk.' },
            { chinese: '转机柜台在哪里？', pinyin: 'zhuǎn jī guì tái zài nǎ lǐ', english: 'Where is the transfer desk?', note: 'For connecting flights.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'What should I memorize first for airport Mandarin?',
          answer: 'Start with check-in, immigration purpose-of-visit, and baggage problem lines. Those create most first-day friction.',
        },
        {
          question: 'Do I need perfect tones to be understood?',
          answer: 'Perfect tones are not required for every interaction, but clear consonants, vowels, and short phrases matter.',
        },
        {
          question: 'Can this replace translation apps?',
          answer: 'No. Use both. Memorized phrases make you faster, and translation apps help with unusual cases.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/mandarin-airport-phrases')}
    />
  );
}

export function MandarinTaxiPhrasesPage() {
  return (
    <SeoTravelPage
      title="Mandarin Taxi Phrases for China Travel | Sonus"
      description="Practical Mandarin taxi phrases for showing addresses, confirming route, asking cost, app payments, and arrival confirmations."
      canonicalPath="/mandarin-taxi-phrases"
      h1="Mandarin Taxi Phrases for China Travel"
      intro="Use these phrases when showing an address, confirming payment method, or asking route and arrival details. Keep your destination written in Chinese before the ride starts."
      sections={[
        {
          title: 'Starting the Ride',
          intro: 'Open with clear destination and route intent.',
          phrases: [
            { chinese: '师傅，去这个地址。', pinyin: 'shī fu, qù zhè gè dì zhǐ', english: 'Driver, please go to this address.', note: 'Show Chinese address on your phone.' },
            { chinese: '请按导航走。', pinyin: 'qǐng àn dǎo háng zǒu', english: 'Please follow navigation.', note: 'Useful when route is unfamiliar.' },
            { chinese: '大概多久到？', pinyin: 'dà gài duō jiǔ dào', english: 'About how long until we arrive?', note: 'Set expectations early.' },
          ],
        },
        {
          title: 'Price and Payment',
          intro: 'Confirm money details before arrival.',
          phrases: [
            { chinese: '大概多少钱？', pinyin: 'dà gài duō shǎo qián', english: 'Roughly how much will it cost?', note: 'Use before ride if no meter info visible.' },
            { chinese: '可以用支付宝或微信吗？', pinyin: 'kě yǐ yòng zhī fù bǎo huò wēi xìn ma', english: 'Can I pay with Alipay or WeChat?', note: 'Confirm app payment support.' },
            { chinese: '我可以刷外卡吗？', pinyin: 'wǒ kě yǐ shuā wài kǎ ma', english: 'Can I use a foreign card?', note: 'Only some drivers can process this.' },
          ],
        },
        {
          title: 'Arrival and Route Corrections',
          intro: 'Fix confusion before and during drop-off.',
          phrases: [
            { chinese: '到了请告诉我。', pinyin: 'dào le qǐng gào sù wǒ', english: 'Please tell me when we arrive.', note: 'Helpful if landmarks are unfamiliar.' },
            { chinese: '请在前面靠边停。', pinyin: 'qǐng zài qián miàn kào biān tíng', english: 'Please pull over ahead.', note: 'Safer than abrupt stop requests.' },
            { chinese: '不是这里，是前面那个门口。', pinyin: 'bú shì zhè lǐ, shì qián miàn nà gè mén kǒu', english: 'Not here, it is that entrance ahead.', note: 'Corrects drop-off point politely.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'Should I speak or just show the address?',
          answer: 'Do both. Showing the Chinese address is the most reliable, and speaking supports quick confirmation.',
        },
        {
          question: 'Is asking price upfront acceptable?',
          answer: 'Yes. Keep the wording neutral and practical. It helps avoid confusion at drop-off.',
        },
        {
          question: 'What if I cannot follow the route conversation?',
          answer: 'Use short controls: follow navigation, tell me when we arrive, and pull over at the next safe point.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/mandarin-taxi-phrases')}
    />
  );
}

export function OrderFoodInChinesePage() {
  return (
    <SeoTravelPage
      title="How to Order Food in Chinese | Mandarin Phrases for Travelers"
      description="Learn how to order food in Chinese with practical Mandarin phrases for recommendations, allergies, paying, the bill, and takeout."
      canonicalPath="/how-to-order-food-in-chinese"
      h1="How to Order Food in Chinese: Practical Mandarin Phrases"
      intro="This guide is for travelers who need useful restaurant Mandarin quickly. It covers ordering, allergies, recommendations, payment, and takeout without academic language."
      sections={[
        {
          title: 'Ordering and Recommendations',
          intro: 'Start clearly and keep requests short.',
          phrases: [
            { chinese: '我们两位。', pinyin: 'wǒ men liǎng wèi', english: 'Table for two.', note: 'At the host stand.' },
            { chinese: '请推荐你们的招牌菜。', pinyin: 'qǐng tuī jiàn nǐ men de zhāo pái cài', english: 'Please recommend your signature dish.', note: 'For first-time visits.' },
            { chinese: '我要这个，再加一碗米饭。', pinyin: 'wǒ yào zhè gè, zài jiā yì wǎn mǐ fàn', english: 'I want this, plus one bowl of rice.', note: 'Simple direct ordering.' },
          ],
        },
        {
          title: 'Dietary Needs and Preferences',
          intro: 'Handle allergies and spice level early.',
          phrases: [
            { chinese: '我对花生过敏。', pinyin: 'wǒ duì huā shēng guò mǐn', english: 'I am allergic to peanuts.', note: 'Say before ordering.' },
            { chinese: '不要辣。', pinyin: 'bú yào là', english: 'Not spicy, please.', note: 'Use for strong spice regions.' },
            { chinese: '这个菜有猪肉吗？', pinyin: 'zhè gè cài yǒu zhū ròu ma', english: 'Does this dish contain pork?', note: 'Dietary or religious reason.' },
          ],
        },
        {
          title: 'Paying, Bill, and Takeout',
          intro: 'Finish smoothly with payment and packing phrases.',
          phrases: [
            { chinese: '买单，谢谢。', pinyin: 'mǎi dān, xiè xie', english: 'Bill, please. Thank you.', note: 'Standard phrase to request bill.' },
            { chinese: '可以打包吗？', pinyin: 'kě yǐ dǎ bāo ma', english: 'Can this be packed to go?', note: 'For leftovers or takeout.' },
            { chinese: '可以开发票吗？', pinyin: 'kě yǐ kāi fā piào ma', english: 'Can you issue an invoice?', note: 'Useful for business receipts.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'What is the single most useful line in restaurants?',
          answer: 'Buy single clarity first: 买单，谢谢 for billing and one allergy sentence if needed.',
        },
        {
          question: 'Should I rely on pinyin only?',
          answer: 'Pinyin is useful for speech practice. Keep key food terms in characters for menus and confirmations.',
        },
        {
          question: 'Can I practice these with audio?',
          answer: 'Yes. Travel Sprint in Sonus is designed for short phrase repetition with practical trip scenarios.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/how-to-order-food-in-chinese')}
    />
  );
}
