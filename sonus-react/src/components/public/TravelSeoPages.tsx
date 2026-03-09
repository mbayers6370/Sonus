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
  deepLink?: { to: string; label: string };
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
  relatedHeading?: string;
  practiceNote?: string;
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
            <th className="px-4 py-3 font-semibold">Script</th>
            <th className="px-4 py-3 font-semibold">Pronunciation</th>
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
  relatedHeading = 'Related Travel Guides',
  practiceNote,
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
                {section.deepLink ? (
                  <p className="mt-2">
                    <Link to={section.deepLink.to} className="inline-flex text-sm font-semibold text-[#145B7A] underline underline-offset-4">
                      Explore full section guide: {section.deepLink.label}
                    </Link>
                  </p>
                ) : null}
                <div className="mt-4">
                  <PhraseTable phrases={section.phrases} />
                </div>
              </article>
            ))}

            {practiceNote ? (
              <section className="rounded-2xl border border-[#3E5648]/30 bg-[rgba(62,86,72,0.07)] p-5 sm:p-6">
                <h2 className="main-font text-2xl text-[#1F2A37]">Practice with Feedback</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#475569]">{practiceNote}</p>
                <div className="mt-4">
                  <Link to="/signup" className="inline-flex rounded-xl border border-[#186E95] bg-[#186E95] px-4 py-2 text-sm font-semibold text-white hover:bg-[#145B7A]">
                    Practice in Travel Sprint
                  </Link>
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-[#3E5648]/30 bg-[rgba(62,86,72,0.07)] p-5 sm:p-6">
              <h2 className="main-font text-2xl text-[#1F2A37]">{relatedHeading}</h2>
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
  { to: '/essential-mandarin-travel-phrases', label: 'Essential Mandarin Travel Phrases (Audio + Practice)' },
  { to: '/travel-mandarin-phrases', label: 'Essential Mandarin Travel Phrases' },
  { to: '/mandarin-airport-phrases', label: 'Mandarin Airport Phrases' },
  { to: '/mandarin-taxi-phrases', label: 'Mandarin Taxi Phrases' },
  { to: '/how-to-order-food-in-chinese', label: 'How to Order Food in Chinese' },
  { to: '/speak-chinese-for-travel', label: 'Speak Chinese for Travel' },
  { to: '/how-to-ask-for-directions-in-chinese', label: 'How to Ask for Directions in Chinese' },
  { to: '/hsk-mandarin-for-travelers', label: 'HSK Mandarin for Travelers' },
  { to: '/how-to-ask-for-the-bill-in-chinese', label: 'How to Ask for the Bill in Chinese' },
  { to: '/mandarin-hotel-phrases', label: 'Mandarin Hotel Phrases' },
  { to: '/mandarin-emergency-phrases', label: 'Mandarin Emergency Phrases' },
  { to: '/chinese-shopping-phrases', label: 'Chinese Shopping Phrases' },
  { to: '/digital-china-travel-phrases', label: 'Digital China Travel Phrases' },
  { to: '/chinese-small-talk-for-travel', label: 'Chinese Small Talk for Travel' },
  { to: '/essential-japanese-travel-phrases', label: 'Essential Japanese Travel Phrases (Audio + Practice)' },
];

export function TravelMandarinPhrasesPage() {
  return (
    <SeoTravelPage
      title="Essential Mandarin Travel Phrases | Sonus Travel Sprint"
      description="Useful Mandarin travel phrases with Chinese, pinyin, and practical context for airports, transport, hotels, food, shopping, emergencies, and directions."
      canonicalPath="/travel-mandarin-phrases"
      h1="Essential Mandarin Travel Phrases"
      intro="A practical guide to learn Mandarin for travel. Use this as your core Mandarin travel vocabulary resource across airport, transport, hotels, food, shopping, directions, and emergency scenarios."
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
            { chinese: '这个多少钱？', pinyin: 'zhè gè duō shǎo qián', english: 'How much is this?', note: 'Core line for price checks in shops and markets.' },
            { chinese: '可以开发票吗？', pinyin: 'kě yǐ kāi fā piào ma', english: 'Can you issue an invoice?', note: 'Useful for business travel.' },
          ],
        },
        {
          title: 'Directions and Essentials',
          intro: 'Critical lines for navigation and basic comfort.',
          phrases: [
            { chinese: '请问怎么去地铁站？', pinyin: 'qǐng wèn zěn me qù dì tiě zhàn', english: 'How do I get to the metro station?', note: 'Ask staff or passersby for route guidance.' },
            { chinese: '洗手间在哪里？', pinyin: 'xǐ shǒu jiān zài nǎ lǐ', english: 'Where is the bathroom?', note: 'Most useful line in stations, malls, and restaurants.' },
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
        {
          question: 'Is this a Mandarin travel course or just a phrase list?',
          answer: 'This page is a practical phrase foundation. Travel Sprint adds structured listening and speaking drills so you can retain and use the phrases under pressure.',
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
      description="Learn how to order food in Chinese with practical Mandarin phrases for recommendations, allergies, paying, asking for the bill, and takeout."
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
          intro: 'Finish smoothly with payment and packing phrases, including how to ask for the bill in Chinese.',
          phrases: [
            { chinese: '买单，谢谢。', pinyin: 'mǎi dān, xiè xie', english: 'Bill, please. Thank you.', note: 'Standard phrase to request bill.' },
            { chinese: '请结账。', pinyin: 'qǐng jié zhàng', english: 'Please check out the bill.', note: 'Another common way to ask for the bill.' },
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

export function SpeakChineseForTravelPage() {
  return (
    <SeoTravelPage
      title="Speak Chinese for Travel | Pronunciation and Tones for Travelers"
      description="Learn Chinese pronunciation for travel with practical Mandarin tone patterns, survival phrases, and high-frequency speaking drills for travelers."
      canonicalPath="/speak-chinese-for-travel"
      h1="Speak Chinese for Travel: Pronunciation and Tones for Travelers"
      intro="If you want to speak Chinese for travel with confidence, focus on short phrase rhythm, clear finals, and tone contrast on high-frequency lines. This page is built for practical speech, not classroom theory."
      sections={[
        {
          title: 'Core Travel Pronunciation Targets',
          intro: 'These phrases train useful sounds and common sentence shapes.',
          phrases: [
            { chinese: '请问，地铁站在哪里？', pinyin: 'qǐng wèn, dì tiě zhàn zài nǎ lǐ', english: 'Excuse me, where is the metro station?', note: 'Train pause after 请问 to sound clearer.' },
            { chinese: '我要去这个地址。', pinyin: 'wǒ yào qù zhè gè dì zhǐ', english: 'I want to go to this address.', note: 'Keep 去 short and clean, not stretched.' },
            { chinese: '这个多少钱？', pinyin: 'zhè gè duō shǎo qián', english: 'How much is this?', note: 'Stress 多少 for price intent.' },
          ],
        },
        {
          title: 'Mandarin Tones for Travelers',
          intro: 'Use minimal pair awareness in travel phrases instead of isolated tone drills.',
          phrases: [
            { chinese: '请问', pinyin: 'qǐng wèn', english: 'Excuse me / may I ask', note: 'Third tone then fourth tone contrast.' },
            { chinese: '买单', pinyin: 'mǎi dān', english: 'Ask for the bill', note: 'Third tone then first tone. Keep the first syllable low and dipped.' },
            { chinese: '厕所 / 洗手间', pinyin: 'cè suǒ / xǐ shǒu jiān', english: 'Toilet / restroom', note: 'Useful bathroom vocabulary. Keep each syllable distinct.' },
          ],
        },
        {
          title: 'Practical Speaking Routine',
          intro: 'Repeat short sets daily before travel day.',
          phrases: [
            { chinese: '慢一点说，可以吗？', pinyin: 'màn yì diǎn shuō, kě yǐ ma', english: 'Could you speak a bit slower?', note: 'Immediate support phrase when listening is hard.' },
            { chinese: '我听不太懂。', pinyin: 'wǒ tīng bú tài dǒng', english: 'I do not understand well.', note: 'Use politely to reset conversation speed.' },
            { chinese: '请再说一遍。', pinyin: 'qǐng zài shuō yí biàn', english: 'Please say it again.', note: 'Essential repair phrase for real-world speaking.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'How can I learn Chinese pronunciation for travel quickly?',
          answer: 'Train only high-frequency travel lines, focus on intelligibility over perfection, and repeat them with listening checks daily.',
        },
        {
          question: 'Do travelers really need Mandarin tones?',
          answer: 'Yes, but only enough to avoid major ambiguity. Prioritize tone contrast on your most-used phrases.',
        },
        {
          question: 'Where do I practice speaking with feedback?',
          answer: 'Use Sonus Travel Sprint for guided phrase repetition with pronunciation-oriented practice.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/speak-chinese-for-travel')}
    />
  );
}

export function DirectionsInChinesePage() {
  return (
    <SeoTravelPage
      title="How to Ask for Directions in Chinese | Mandarin Travel Phrases"
      description="How to ask for directions in Chinese with practical Mandarin lines for stations, bathrooms, landmarks, and route clarification."
      canonicalPath="/how-to-ask-for-directions-in-chinese"
      h1="How to Ask for Directions in Chinese"
      intro="This page covers practical direction phrases for travelers. You will learn how to ask where places are, including how to say where is the bathroom in Chinese, and how to confirm route details."
      sections={[
        {
          title: 'Core Direction Questions',
          intro: 'Use these when starting a route conversation.',
          phrases: [
            { chinese: '请问，怎么去这里？', pinyin: 'qǐng wèn, zěn me qù zhè lǐ', english: 'Excuse me, how do I get here?', note: 'Show destination on map while speaking.' },
            { chinese: '地铁站在哪里？', pinyin: 'dì tiě zhàn zài nǎ lǐ', english: 'Where is the metro station?', note: 'High-frequency city travel line.' },
            { chinese: '离这里远吗？', pinyin: 'lí zhè lǐ yuǎn ma', english: 'Is it far from here?', note: 'Helps decide walking vs taxi.' },
          ],
        },
        {
          title: 'Bathroom and Essential Stops',
          intro: 'Critical convenience phrases during travel days.',
          phrases: [
            { chinese: '洗手间在哪里？', pinyin: 'xǐ shǒu jiān zài nǎ lǐ', english: 'Where is the bathroom?', note: 'Most standard public phrase.' },
            { chinese: '厕所在哪里？', pinyin: 'cè suǒ zài nǎ lǐ', english: 'Where is the toilet?', note: 'Direct version used widely.' },
            { chinese: '最近的便利店在哪里？', pinyin: 'zuì jìn de biàn lì diàn zài nǎ lǐ', english: 'Where is the nearest convenience store?', note: 'Useful for water, chargers, and basics.' },
          ],
        },
        {
          title: 'Clarifying Distance and Cost',
          intro: 'Useful follow-ups after someone gives directions.',
          phrases: [
            { chinese: '走路大概几分钟？', pinyin: 'zǒu lù dà gài jǐ fēn zhōng', english: 'About how many minutes on foot?', note: 'Time estimate for walking route.' },
            { chinese: '打车大概多少钱？', pinyin: 'dǎ chē dà gài duō shǎo qián', english: 'About how much by taxi?', note: 'Natural way to ask how much in Mandarin for route cost.' },
            { chinese: '请在地图上指给我看。', pinyin: 'qǐng zài dì tú shàng zhǐ gěi wǒ kàn', english: 'Please show me on the map.', note: 'Best backup when speech gets unclear.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'What is the fastest way to ask for directions in Chinese?',
          answer: 'Start with 请问 and one destination question, then confirm walking time or taxi cost.',
        },
        {
          question: 'How do I say where is the bathroom in Chinese?',
          answer: 'Use 洗手间在哪里 for a standard phrasing. 厕所在哪里 is a direct alternative.',
        },
        {
          question: 'How do I say how much in Mandarin for transport?',
          answer: 'Use 大概多少钱 or 打车大概多少钱 depending on context.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/how-to-ask-for-directions-in-chinese')}
    />
  );
}

export function HskMandarinForTravelersPage() {
  return (
    <SeoTravelPage
      title="HSK Mandarin for Travelers | HSK Travel Phrases for Beginners"
      description="HSK-aligned Mandarin travel phrases for beginners with practical usage across airports, taxis, food, and emergencies."
      canonicalPath="/hsk-mandarin-for-travelers"
      h1="HSK Mandarin for Travelers: Practical Beginner Phrases"
      intro="If you want HSK Mandarin for travelers, start with HSK-level vocabulary that appears in real travel contexts. This guide maps beginner-friendly HSK phrase patterns to airport, transport, food, and emergency situations."
      sections={[
        {
          title: 'HSK Beginner Core for Travel',
          intro: 'Simple words and sentence frames that transfer well to real situations.',
          phrases: [
            { chinese: '我要这个。', pinyin: 'wǒ yào zhè gè', english: 'I want this.', note: 'Useful in shops and restaurants. Very beginner-friendly structure.' },
            { chinese: '请问，这是什么？', pinyin: 'qǐng wèn, zhè shì shén me', english: 'Excuse me, what is this?', note: 'Good for menus, signs, and transit labels.' },
            { chinese: '我听不懂。', pinyin: 'wǒ tīng bù dǒng', english: 'I do not understand.', note: 'Critical support phrase for beginners.' },
          ],
        },
        {
          title: 'HSK Travel Phrases in Transit',
          intro: 'Low-complexity travel lines with immediate practical value.',
          phrases: [
            { chinese: '地铁站在哪里？', pinyin: 'dì tiě zhàn zài nǎ lǐ', english: 'Where is the metro station?', note: 'Direction phrase built on common HSK words.' },
            { chinese: '我要去机场。', pinyin: 'wǒ yào qù jī chǎng', english: 'I want to go to the airport.', note: 'Basic destination statement for taxis or ride apps.' },
            { chinese: '这个多少钱？', pinyin: 'zhè gè duō shǎo qián', english: 'How much is this?', note: 'Foundational HSK-style pricing line.' },
          ],
        },
        {
          title: 'HSK-Based Restaurant and Safety Phrases',
          intro: 'Small set with high utility for first-time travelers.',
          phrases: [
            { chinese: '买单，谢谢。', pinyin: 'mǎi dān, xiè xie', english: 'Bill, please. Thank you.', note: 'Most used restaurant finishing phrase.' },
            { chinese: '我对花生过敏。', pinyin: 'wǒ duì huā shēng guò mǐn', english: 'I am allergic to peanuts.', note: 'Safety-critical sentence.' },
            { chinese: '请帮我报警。', pinyin: 'qǐng bāng wǒ bào jǐng', english: 'Please help me call the police.', note: 'Emergency support line.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'Are these real HSK travel phrases?',
          answer: 'They are HSK-friendly structures and vocabulary arranged for real travel use, not test-only drills.',
        },
        {
          question: 'Is this suitable for Mandarin phrases HSK beginners?',
          answer: 'Yes. The phrase set is intentionally short, practical, and beginner-oriented.',
        },
        {
          question: 'What should I study next after this page?',
          answer: 'Move into Travel Sprint scenario practice to reinforce these patterns with repetition and listening.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/hsk-mandarin-for-travelers')}
    />
  );
}

export function AskForBillInChinesePage() {
  return (
    <SeoTravelPage
      title="How to Ask for the Bill in Chinese | Mandarin Restaurant Phrases"
      description="Learn how to ask for the bill in Chinese with practical Mandarin lines for paying, splitting bills, and confirming payment methods."
      canonicalPath="/how-to-ask-for-the-bill-in-chinese"
      h1="How to Ask for the Bill in Chinese"
      intro="If you only memorize one restaurant phrase, make it this. These Mandarin lines help you ask for the bill naturally, confirm payment method, and close a meal smoothly."
      sections={[
        {
          title: 'Most Common Bill Phrases',
          intro: 'Short lines used in most restaurants.',
          phrases: [
            { chinese: '买单，谢谢。', pinyin: 'mǎi dān, xiè xie', english: 'Bill, please. Thank you.', note: 'Most common and polite.' },
            { chinese: '请结账。', pinyin: 'qǐng jié zhàng', english: 'Please check out the bill.', note: 'Direct but still polite.' },
            { chinese: '我们可以现在付款吗？', pinyin: 'wǒ men kě yǐ xiàn zài fù kuǎn ma', english: 'Can we pay now?', note: 'Useful when staff is busy.' },
          ],
        },
        {
          title: 'Payment Method and Receipt',
          intro: 'Confirm method before processing payment.',
          phrases: [
            { chinese: '可以刷卡吗？', pinyin: 'kě yǐ shuā kǎ ma', english: 'Can I pay by card?', note: 'Ask before handing over card.' },
            { chinese: '可以用支付宝或微信吗？', pinyin: 'kě yǐ yòng zhī fù bǎo huò wēi xìn ma', english: 'Can I use Alipay or WeChat?', note: 'Common in many cities.' },
            { chinese: '可以开发票吗？', pinyin: 'kě yǐ kāi fā piào ma', english: 'Can you issue an invoice?', note: 'For work reimbursement and records.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'What is the standard way to ask for the bill in Chinese?',
          answer: '买单，谢谢 is the safest and most natural phrase for travelers.',
        },
        {
          question: 'Can I ask for split payment in Chinese?',
          answer: 'Yes, but methods vary by restaurant. Start by asking if card or app payments are accepted.',
        },
        {
          question: 'Should I use this page or the full food guide first?',
          answer: 'If you need one urgent phrase, use this page. For complete meal flow, use the full food guide.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/how-to-ask-for-the-bill-in-chinese')}
    />
  );
}

export function MandarinHotelPhrasesPage() {
  return (
    <SeoTravelPage
      title="Mandarin Hotel Phrases for Travelers | Sonus"
      description="Practical Mandarin hotel phrases for check-in, reservations, room requests, late checkout, and travel support."
      canonicalPath="/mandarin-hotel-phrases"
      h1="Mandarin Hotel Phrases for Travelers"
      intro="Use these practical hotel Mandarin phrases for check-in, room issues, and checkout. The goal is smooth communication with front desk staff when timing and clarity matter."
      sections={[
        {
          title: 'Check-In and Reservation',
          intro: 'Core lines for arrival and booking confirmation.',
          phrases: [
            { chinese: '我有预订。', pinyin: 'wǒ yǒu yù dìng', english: 'I have a reservation.', note: 'First line at the front desk.' },
            { chinese: '这是我的护照。', pinyin: 'zhè shì wǒ de hù zhào', english: 'Here is my passport.', note: 'For registration.' },
            { chinese: '可以提前入住吗？', pinyin: 'kě yǐ tí qián rù zhù ma', english: 'Can I check in early?', note: 'Useful after morning arrivals.' },
          ],
        },
        {
          title: 'Room Requests',
          intro: 'Ask clearly for practical room needs.',
          phrases: [
            { chinese: '房间有无线网吗？', pinyin: 'fáng jiān yǒu wú xiàn wǎng ma', english: 'Does the room have Wi-Fi?', note: 'Connectivity check.' },
            { chinese: '可以给我安静一点的房间吗？', pinyin: 'kě yǐ gěi wǒ ān jìng yì diǎn de fáng jiān ma', english: 'Can I have a quieter room?', note: 'Useful near busy roads.' },
            { chinese: '空调好像坏了。', pinyin: 'kōng tiáo hǎo xiàng huài le', english: 'The air conditioner seems broken.', note: 'Simple maintenance report.' },
          ],
        },
        {
          title: 'Checkout and Support',
          intro: 'Finish cleanly and request travel help when needed.',
          phrases: [
            { chinese: '可以晚一点退房吗？', pinyin: 'kě yǐ wǎn yì diǎn tuì fáng ma', english: 'Can I check out a bit later?', note: 'Ask the evening before if possible.' },
            { chinese: '请帮我叫一辆出租车。', pinyin: 'qǐng bāng wǒ jiào yí liàng chū zū chē', english: 'Please call a taxi for me.', note: 'Common departure request.' },
            { chinese: '可以寄存行李吗？', pinyin: 'kě yǐ jì cún xíng lǐ ma', english: 'Can I store my luggage?', note: 'Useful after checkout before train/flight.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'What hotel phrase should I memorize first?',
          answer: 'Start with 我有预订 and one checkout request phrase, then add room issue vocabulary.',
        },
        {
          question: 'Are these phrases enough for most hotels?',
          answer: 'Yes for standard traveler interactions. Keep translation backup for uncommon requests.',
        },
        {
          question: 'Can I practice this with audio?',
          answer: 'Yes. Travel Sprint includes short practical phrase practice for hotel scenarios.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/mandarin-hotel-phrases')}
    />
  );
}

export function MandarinEmergencyPhrasesPage() {
  return (
    <SeoTravelPage
      title="Mandarin Emergency Phrases for Travelers | Sonus"
      description="Mandarin emergency phrases for medical help, police support, lost passport situations, and urgent travel communication."
      canonicalPath="/mandarin-emergency-phrases"
      h1="Mandarin Emergency Phrases for Travelers"
      intro="In emergencies, short clear phrases matter more than complex grammar. These Mandarin lines help you request medical aid, police support, and urgent assistance quickly."
      sections={[
        {
          title: 'Medical Urgency',
          intro: 'Use direct language and keep sentences short.',
          phrases: [
            { chinese: '请帮我打120。', pinyin: 'qǐng bāng wǒ dǎ yāo èr líng', english: 'Please call 120 for me.', note: 'Medical emergency number in China.' },
            { chinese: '我需要医生。', pinyin: 'wǒ xū yào yī shēng', english: 'I need a doctor.', note: 'Immediate healthcare request.' },
            { chinese: '我对花生过敏。', pinyin: 'wǒ duì huā shēng guò mǐn', english: 'I am allergic to peanuts.', note: 'State allergy early.' },
          ],
        },
        {
          title: 'Police and Safety',
          intro: 'For theft, safety, and legal help.',
          phrases: [
            { chinese: '请帮我报警。', pinyin: 'qǐng bāng wǒ bào jǐng', english: 'Please help me call the police.', note: 'For urgent incidents.' },
            { chinese: '我的护照丢了。', pinyin: 'wǒ de hù zhào diū le', english: 'I lost my passport.', note: 'Use at police station or hotel desk.' },
            { chinese: '我需要翻译。', pinyin: 'wǒ xū yào fān yì', english: 'I need an interpreter.', note: 'Useful in stressful official situations.' },
          ],
        },
        {
          title: 'Location and Contact Support',
          intro: 'Help responders locate and contact you.',
          phrases: [
            { chinese: '我在这个地址。', pinyin: 'wǒ zài zhè gè dì zhǐ', english: 'I am at this address.', note: 'Show map or written location.' },
            { chinese: '请联系这位家人。', pinyin: 'qǐng lián xì zhè wèi jiā rén', english: 'Please contact this family member.', note: 'Point to saved contact on phone.' },
            { chinese: '请说慢一点。', pinyin: 'qǐng shuō màn yì diǎn', english: 'Please speak a little slower.', note: 'Critical when processing stress.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'What is the emergency number for medical help in China?',
          answer: '120 is the common emergency medical line in mainland China.',
        },
        {
          question: 'What if I lose my passport?',
          answer: 'Report it to police, contact your embassy/consulate, and keep a digital backup copy of your passport details.',
        },
        {
          question: 'Should I memorize these or keep them on my phone?',
          answer: 'Do both. Memorize three critical lines, and keep the full list pinned for backup.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/mandarin-emergency-phrases')}
    />
  );
}

export function ChineseShoppingPhrasesPage() {
  return (
    <SeoTravelPage
      title="Chinese Shopping Phrases for Travelers | Sonus"
      description="Useful Chinese shopping phrases for asking price, size, payment methods, receipts, and practical in-store communication."
      canonicalPath="/chinese-shopping-phrases"
      h1="Chinese Shopping Phrases for Travelers"
      intro="These Chinese shopping phrases help you ask price, compare options, confirm payment, and finish purchases smoothly in stores and markets."
      sections={[
        {
          title: 'Price and Product Questions',
          intro: 'Start with clear price and detail checks.',
          phrases: [
            { chinese: '这个多少钱？', pinyin: 'zhè gè duō shǎo qián', english: 'How much is this?', note: 'Most useful shopping phrase.' },
            { chinese: '还有别的颜色吗？', pinyin: 'hái yǒu bié de yán sè ma', english: 'Do you have other colors?', note: 'Common clothing and accessory question.' },
            { chinese: '可以试一下吗？', pinyin: 'kě yǐ shì yí xià ma', english: 'Can I try it?', note: 'For fitting or testing products.' },
          ],
        },
        {
          title: 'Payment and Checkout',
          intro: 'Confirm payment method before checkout.',
          phrases: [
            { chinese: '可以刷卡吗？', pinyin: 'kě yǐ shuā kǎ ma', english: 'Can I pay by card?', note: 'Card acceptance check.' },
            { chinese: '可以用支付宝或微信吗？', pinyin: 'kě yǐ yòng zhī fù bǎo huò wēi xìn ma', english: 'Can I use Alipay or WeChat?', note: 'Important in digital-first payment contexts.' },
            { chinese: '可以开发票吗？', pinyin: 'kě yǐ kāi fā piào ma', english: 'Can you issue an invoice?', note: 'Receipt/invoice for records.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'How do I say how much in Mandarin?',
          answer: 'Use 这个多少钱 in most shopping contexts.',
        },
        {
          question: 'Should I ask payment method before or after choosing items?',
          answer: 'Before purchase is safer, especially in small shops.',
        },
        {
          question: 'Does this page cover market bargaining language?',
          answer: 'It focuses on clean, practical shopping phrases. You can layer negotiation phrases after this core set.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/chinese-shopping-phrases')}
    />
  );
}

export function DigitalChinaTravelPhrasesPage() {
  return (
    <SeoTravelPage
      title="Digital China Travel Phrases | WeChat, Alipay, QR Payment Mandarin"
      description="Mandarin phrases for digital life in China: QR payments, WeChat, Alipay, phone number verification, and app-based travel friction."
      canonicalPath="/digital-china-travel-phrases"
      h1="Digital China Travel Phrases"
      intro="China travel is increasingly app-based. These phrases are for real digital friction: QR payment, WeChat or Alipay confirmation, verification codes, and phone-number constraints."
      sections={[
        {
          title: 'QR and App Payments',
          intro: 'Critical lines for cashless checkout flows.',
          phrases: [
            { chinese: '可以用支付宝吗？', pinyin: 'kě yǐ yòng zhī fù bǎo ma', english: 'Can I use Alipay?', note: 'Quick payment compatibility check.' },
            { chinese: '可以用微信支付吗？', pinyin: 'kě yǐ yòng wēi xìn zhī fù ma', english: 'Can I pay with WeChat Pay?', note: 'Common in shops and transport.' },
            { chinese: '请扫这个二维码。', pinyin: 'qǐng sǎo zhè gè èr wéi mǎ', english: 'Please scan this QR code.', note: 'Useful when merchant asks for a scan flow.' },
          ],
        },
        {
          title: 'Phone Number and Verification',
          intro: 'For signups, tickets, and app verification blocks.',
          phrases: [
            { chinese: '我没有中国手机号。', pinyin: 'wǒ méi yǒu zhōng guó shǒu jī hào', english: 'I do not have a Chinese phone number.', note: 'Key sentence for registration issues.' },
            { chinese: '我收不到验证码。', pinyin: 'wǒ shōu bú dào yàn zhèng mǎ', english: 'I am not receiving the verification code.', note: 'Common support issue.' },
            { chinese: '可以用护照验证吗？', pinyin: 'kě yǐ yòng hù zhào yàn zhèng ma', english: 'Can I verify with passport?', note: 'Alternative identity path.' },
          ],
        },
        {
          title: 'Navigation and App Assistance',
          intro: 'Keep travel moving when apps fail.',
          phrases: [
            { chinese: '请帮我在地图里输入这个地址。', pinyin: 'qǐng bāng wǒ zài dì tú lǐ shū rù zhè gè dì zhǐ', english: 'Please help me enter this address in the map.', note: 'Useful with drivers or hotel staff.' },
            { chinese: '这个应用我不会用。', pinyin: 'zhè gè yìng yòng wǒ bú huì yòng', english: 'I do not know how to use this app.', note: 'Direct and practical request.' },
            { chinese: '可以现金吗？', pinyin: 'kě yǐ xiàn jīn ma', english: 'Is cash possible?', note: 'Backup when app payment fails.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'Why does digital China travel need its own phrase page?',
          answer: 'Because payment and movement often depend on app flows and verification, not only face-to-face conversation.',
        },
        {
          question: 'What phrase helps most when verification fails?',
          answer: '我收不到验证码 is the core line for account and ticket support.',
        },
        {
          question: 'Can this replace app setup before travel?',
          answer: 'No. Set up apps before flying, then use these phrases for live troubleshooting.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/digital-china-travel-phrases')}
    />
  );
}

export function ChineseSmallTalkForTravelPage() {
  return (
    <SeoTravelPage
      title="Chinese Small Talk for Travel | Practical Mandarin Conversation Starters"
      description="Chinese small talk for travel with short practical Mandarin phrases for polite interaction, friendliness, and everyday conversation."
      canonicalPath="/chinese-small-talk-for-travel"
      h1="Chinese Small Talk for Travel"
      intro="Small talk helps daily interactions feel smoother and more human. These practical Mandarin lines are designed for travelers who want polite, natural conversation without overcomplicating grammar."
      sections={[
        {
          title: 'Polite Openers',
          intro: 'Start respectfully and keep tone calm.',
          phrases: [
            { chinese: '你好，很高兴认识你。', pinyin: 'nǐ hǎo, hěn gāo xìng rèn shi nǐ', english: 'Hello, nice to meet you.', note: 'Useful in tours, classes, and hosts.' },
            { chinese: '请问你会说英语吗？', pinyin: 'qǐng wèn nǐ huì shuō yīng yǔ ma', english: 'Excuse me, do you speak English?', note: 'Use politely, not abruptly.' },
            { chinese: '谢谢你的帮助。', pinyin: 'xiè xie nǐ de bāng zhù', english: 'Thank you for your help.', note: 'Builds goodwill quickly.' },
          ],
        },
        {
          title: 'Simple Conversation Lines',
          intro: 'Easy lines that fit many travel moments.',
          phrases: [
            { chinese: '我是第一次来中国。', pinyin: 'wǒ shì dì yī cì lái zhōng guó', english: 'This is my first time in China.', note: 'Natural first-contact line.' },
            { chinese: '这个城市很漂亮。', pinyin: 'zhè gè chéng shì hěn piào liang', english: 'This city is beautiful.', note: 'Positive and easy to understand.' },
            { chinese: '你推荐哪里好吃？', pinyin: 'nǐ tuī jiàn nǎ lǐ hǎo chī', english: 'Where do you recommend for good food?', note: 'Useful and engaging question.' },
          ],
        },
      ]}
      faq={[
        {
          question: 'Do travelers need small talk Mandarin?',
          answer: 'You can travel without it, but small talk improves cooperation and friendliness in daily interactions.',
        },
        {
          question: 'How many lines should I memorize?',
          answer: 'Five to ten high-frequency lines are enough to noticeably improve interactions.',
        },
        {
          question: 'Should I focus on this or survival phrases first?',
          answer: 'Start with survival phrases, then layer small talk for smoother day-to-day communication.',
        },
      ]}
      related={allRelatedLinks.filter((item) => item.to !== '/chinese-small-talk-for-travel')}
    />
  );
}

export function EssentialMandarinTravelPhrasesPillarPage() {
  return (
    <SeoTravelPage
      title="Essential Mandarin Travel Phrases (Audio + Practice) | Sonus"
      description="A practical high-authority guide to essential Mandarin travel phrases with Chinese, pronunciation, context notes, and practice-focused links for travelers."
      canonicalPath="/essential-mandarin-travel-phrases"
      h1="Essential Mandarin Travel Phrases (Audio + Practice)"
      intro="A small set of strong phrases can carry most travel moments in China. Focused speaking practice is more useful than passive memorization, especially in airports, transit, hotels, restaurants, and payment-heavy daily routines."
      sections={[
        {
          title: 'Airport & Arrival',
          intro: 'Use these phrases for check-in, immigration, and arrival logistics.',
          deepLink: { to: '/mandarin-airport-phrases', label: 'Mandarin Airport Phrases' },
          phrases: [
            { chinese: '请问值机柜台在哪里？', pinyin: 'qǐng wèn zhí jī guì tái zài nǎ lǐ', english: 'Where is the check-in counter?', note: 'Use right after entering departure hall.' },
            { chinese: '这是我的护照。', pinyin: 'zhè shì wǒ de hù zhào', english: 'Here is my passport.', note: 'At immigration and counter checks.' },
            { chinese: '我的登机口是多少？', pinyin: 'wǒ de dēng jī kǒu shì duō shǎo', english: 'What is my gate number?', note: 'Useful when screens are crowded.' },
            { chinese: '我的行李还没出来。', pinyin: 'wǒ de xíng lǐ hái méi chū lái', english: 'My baggage has not come out yet.', note: 'At baggage claim desk.' },
            { chinese: '转机柜台在哪里？', pinyin: 'zhuǎn jī guì tái zài nǎ lǐ', english: 'Where is the transfer desk?', note: 'For connecting flights.' },
            { chinese: '航班延误了吗？', pinyin: 'háng bān yán wù le ma', english: 'Is the flight delayed?', note: 'Useful at service counter.' },
          ],
        },
        {
          title: 'Taxi & Transport',
          intro: 'Essential transport lines for drivers, routes, and timing.',
          deepLink: { to: '/mandarin-taxi-phrases', label: 'Mandarin Taxi Phrases' },
          phrases: [
            { chinese: '师傅，去这个地址。', pinyin: 'shī fu, qù zhè gè dì zhǐ', english: 'Driver, go to this address.', note: 'Show destination text on your phone.' },
            { chinese: '请按导航走。', pinyin: 'qǐng àn dǎo háng zǒu', english: 'Please follow navigation.', note: 'Keeps routing clear.' },
            { chinese: '大概多久到？', pinyin: 'dà gài duō jiǔ dào', english: 'About how long until arrival?', note: 'Set expectation early.' },
            { chinese: '到了请告诉我。', pinyin: 'dào le qǐng gào sù wǒ', english: 'Please tell me when we arrive.', note: 'Helpful in unfamiliar areas.' },
            { chinese: '地铁站在哪里？', pinyin: 'dì tiě zhàn zài nǎ lǐ', english: 'Where is the metro station?', note: 'Most common transit question.' },
            { chinese: '打车大概多少钱？', pinyin: 'dǎ chē dà gài duō shǎo qián', english: 'About how much by taxi?', note: 'Fast cost estimate phrase.' },
          ],
        },
        {
          title: 'Hotel & Accommodation',
          intro: 'Check-in, room requests, and departure support.',
          deepLink: { to: '/mandarin-hotel-phrases', label: 'Mandarin Hotel Phrases' },
          phrases: [
            { chinese: '我有预订。', pinyin: 'wǒ yǒu yù dìng', english: 'I have a reservation.', note: 'Core check-in line.' },
            { chinese: '可以提前入住吗？', pinyin: 'kě yǐ tí qián rù zhù ma', english: 'Can I check in early?', note: 'Useful after red-eye flights.' },
            { chinese: '可以晚一点退房吗？', pinyin: 'kě yǐ wǎn yì diǎn tuì fáng ma', english: 'Can I check out later?', note: 'Ask day before checkout.' },
            { chinese: '房间有无线网吗？', pinyin: 'fáng jiān yǒu wú xiàn wǎng ma', english: 'Does the room have Wi-Fi?', note: 'Basic setup question.' },
            { chinese: '请帮我叫一辆出租车。', pinyin: 'qǐng bāng wǒ jiào yí liàng chū zū chē', english: 'Please call a taxi for me.', note: 'Standard concierge request.' },
            { chinese: '可以寄存行李吗？', pinyin: 'kě yǐ jì cún xíng lǐ ma', english: 'Can I store my luggage?', note: 'For post-checkout time gaps.' },
          ],
        },
        {
          title: 'Restaurants & Ordering Food',
          intro: 'Useful lines for ordering, dietary needs, and paying.',
          deepLink: { to: '/how-to-order-food-in-chinese', label: 'How to Order Food in Chinese' },
          phrases: [
            { chinese: '我们两位。', pinyin: 'wǒ men liǎng wèi', english: 'Table for two.', note: 'At host stand.' },
            { chinese: '请推荐你们的招牌菜。', pinyin: 'qǐng tuī jiàn nǐ men de zhāo pái cài', english: 'Please recommend your signature dish.', note: 'Fast menu navigation.' },
            { chinese: '不要辣。', pinyin: 'bú yào là', english: 'Not spicy, please.', note: 'Important preference phrase.' },
            { chinese: '这个菜有花生吗？', pinyin: 'zhè gè cài yǒu huā shēng ma', english: 'Does this dish have peanuts?', note: 'Allergy check.' },
            { chinese: '买单，谢谢。', pinyin: 'mǎi dān, xiè xie', english: 'Bill, please. Thank you.', note: 'Most common payment closeout line.' },
            { chinese: '可以打包吗？', pinyin: 'kě yǐ dǎ bāo ma', english: 'Can this be packed to go?', note: 'Leftovers and takeout.' },
          ],
        },
        {
          title: 'Shopping & Payments',
          intro: 'Ask price, confirm payment method, and close purchases smoothly.',
          deepLink: { to: '/chinese-shopping-phrases', label: 'Chinese Shopping Phrases' },
          phrases: [
            { chinese: '这个多少钱？', pinyin: 'zhè gè duō shǎo qián', english: 'How much is this?', note: 'Core shopping phrase.' },
            { chinese: '还有别的颜色吗？', pinyin: 'hái yǒu bié de yán sè ma', english: 'Do you have other colors?', note: 'Common retail question.' },
            { chinese: '可以试一下吗？', pinyin: 'kě yǐ shì yí xià ma', english: 'Can I try it?', note: 'For fitting and testing.' },
            { chinese: '可以刷卡吗？', pinyin: 'kě yǐ shuā kǎ ma', english: 'Can I pay by card?', note: 'Check payment method early.' },
            { chinese: '可以用支付宝或微信吗？', pinyin: 'kě yǐ yòng zhī fù bǎo huò wēi xìn ma', english: 'Can I use Alipay or WeChat?', note: 'Key in digital payment contexts.' },
            { chinese: '可以开发票吗？', pinyin: 'kě yǐ kāi fā piào ma', english: 'Can you issue an invoice?', note: 'Business and reimbursement use.' },
          ],
        },
        {
          title: 'Emergencies & Health',
          intro: 'Keep these short lines ready before your trip.',
          deepLink: { to: '/mandarin-emergency-phrases', label: 'Mandarin Emergency Phrases' },
          phrases: [
            { chinese: '请帮我打120。', pinyin: 'qǐng bāng wǒ dǎ yāo èr líng', english: 'Please call 120 for me.', note: 'Medical emergency.' },
            { chinese: '我需要医生。', pinyin: 'wǒ xū yào yī shēng', english: 'I need a doctor.', note: 'Fast clinical help request.' },
            { chinese: '我对花生过敏。', pinyin: 'wǒ duì huā shēng guò mǐn', english: 'I am allergic to peanuts.', note: 'Use immediately in food or medical setting.' },
            { chinese: '请帮我报警。', pinyin: 'qǐng bāng wǒ bào jǐng', english: 'Please help me call the police.', note: 'Safety incident response.' },
            { chinese: '我的护照丢了。', pinyin: 'wǒ de hù zhào diū le', english: 'I lost my passport.', note: 'Police and hotel support.' },
            { chinese: '我需要翻译。', pinyin: 'wǒ xū yào fān yì', english: 'I need an interpreter.', note: 'Critical in high-stress moments.' },
          ],
        },
        {
          title: 'Everyday Small Talk',
          intro: 'Polite social lines that improve daily interactions.',
          deepLink: { to: '/chinese-small-talk-for-travel', label: 'Chinese Small Talk for Travel' },
          phrases: [
            { chinese: '你好。', pinyin: 'nǐ hǎo', english: 'Hello.', note: 'Simple and universally useful.' },
            { chinese: '谢谢你的帮助。', pinyin: 'xiè xie nǐ de bāng zhù', english: 'Thank you for your help.', note: 'Builds goodwill quickly.' },
            { chinese: '不好意思，打扰一下。', pinyin: 'bù hǎo yì si, dǎ rǎo yí xià', english: 'Sorry to bother you.', note: 'Polite opener in public.' },
            { chinese: '我是第一次来中国。', pinyin: 'wǒ shì dì yī cì lái zhōng guó', english: 'It is my first time in China.', note: 'Natural context phrase.' },
            { chinese: '这个城市很漂亮。', pinyin: 'zhè gè chéng shì hěn piào liang', english: 'This city is beautiful.', note: 'Friendly conversation line.' },
            { chinese: '你推荐哪里好吃？', pinyin: 'nǐ tuī jiàn nǎ lǐ hǎo chī', english: 'Where do you recommend for good food?', note: 'Useful question with locals.' },
          ],
        },
        {
          title: 'Digital China Essentials',
          intro: 'App-first travel in China requires practical digital phrases.',
          deepLink: { to: '/digital-china-travel-phrases', label: 'Digital China Travel Phrases' },
          phrases: [
            { chinese: '可以用支付宝吗？', pinyin: 'kě yǐ yòng zhī fù bǎo ma', english: 'Can I use Alipay?', note: 'Payment compatibility check.' },
            { chinese: '可以用微信支付吗？', pinyin: 'kě yǐ yòng wēi xìn zhī fù ma', english: 'Can I pay with WeChat Pay?', note: 'Common at shops and stations.' },
            { chinese: '我没有中国手机号。', pinyin: 'wǒ méi yǒu zhōng guó shǒu jī hào', english: 'I do not have a Chinese phone number.', note: 'Key for account setup friction.' },
            { chinese: '我收不到验证码。', pinyin: 'wǒ shōu bú dào yàn zhèng mǎ', english: 'I am not receiving the verification code.', note: 'Important troubleshooting phrase.' },
            { chinese: '请帮我在地图里输入这个地址。', pinyin: 'qǐng bāng wǒ zài dì tú lǐ shū rù zhè gè dì zhǐ', english: 'Please help me enter this address in the map.', note: 'Useful at front desks and with drivers.' },
            { chinese: '可以现金吗？', pinyin: 'kě yǐ xiàn jīn ma', english: 'Can I pay cash?', note: 'Fallback when app payment fails.' },
          ],
        },
      ]}
      practiceNote="Practice these phrases with speech feedback in Sonus Travel Sprint."
      faq={[
        {
          question: 'Do I need to speak Mandarin to travel in China?',
          answer: 'You can travel without fluency, but a compact phrase set significantly improves speed, confidence, and day-to-day clarity.',
        },
        {
          question: 'What Mandarin phrases should tourists learn first?',
          answer: 'Start with navigation, payment, food safety, and emergency lines. Those resolve most high-friction situations.',
        },
        {
          question: 'How can I practice Mandarin pronunciation for travel?',
          answer: 'Use short phrase repetition with feedback and listening checks, then rehearse high-frequency scenarios before departure.',
        },
        {
          question: 'Are Chinese travel phrase lists enough to prepare for a trip?',
          answer: 'A list is a starting point. Real readiness comes from speaking drills and context-based practice.',
        },
        {
          question: 'What apps are useful for travel in China?',
          answer: 'Map, translation, and payment apps are essential. Prepare account and verification setup before your trip.',
        },
      ]}
      relatedHeading="Travel Sprint Cluster Guides"
      related={allRelatedLinks.filter((item) => item.to !== '/essential-mandarin-travel-phrases')}
    />
  );
}

export function EssentialJapaneseTravelPhrasesPillarPage() {
  return (
    <SeoTravelPage
      title="Essential Japanese Travel Phrases (Audio + Practice) | Sonus"
      description="A practical guide to essential Japanese travel phrases with Japanese script, romaji, English meaning, context notes, and pronunciation-oriented travel practice."
      canonicalPath="/essential-japanese-travel-phrases"
      h1="Essential Japanese Travel Phrases (Audio + Practice)"
      intro="A focused set of practical Japanese phrases can dramatically improve your travel experience in Japan. You do not need perfect fluency, but you do need reliable pronunciation and high-frequency lines."
      sections={[
        {
          title: 'Airport & Arrival',
          intro: 'Useful lines for arrivals, immigration, and airport movement.',
          phrases: [
            { chinese: '入国審査はどこですか。', pinyin: 'Nyukoku shinsa wa doko desu ka', english: 'Where is immigration?', note: 'First checkpoint after landing.' },
            { chinese: '荷物受け取りはどこですか。', pinyin: 'Nimotsu uketori wa doko desu ka', english: 'Where is baggage claim?', note: 'After passport control.' },
            { chinese: 'このカードは必要ですか。', pinyin: 'Kono kaado wa hitsuyo desu ka', english: 'Do I need this card?', note: 'Useful at customs counters.' },
            { chinese: '出口はどこですか。', pinyin: 'Deguchi wa doko desu ka', english: 'Where is the exit?', note: 'Fast wayfinding phrase.' },
            { chinese: '空港バス乗り場はどこですか。', pinyin: 'Kuko basu noriba wa doko desu ka', english: 'Where is the airport bus stop?', note: 'For direct city transfer.' },
            { chinese: 'この電車は市内に行きますか。', pinyin: 'Kono densha wa shinai ni ikimasu ka', english: 'Does this train go to the city?', note: 'Confirming route at station.' },
          ],
        },
        {
          title: 'Train & Transportation',
          intro: 'High-frequency lines for train travel and local movement.',
          phrases: [
            { chinese: 'この電車は東京駅に行きますか。', pinyin: 'Kono densha wa Tokyo-eki ni ikimasu ka', english: 'Does this train go to Tokyo Station?', note: 'Route confirmation.' },
            { chinese: '切符を一枚ください。', pinyin: 'Kippu o ichimai kudasai', english: 'One ticket, please.', note: 'At ticket counters.' },
            { chinese: '何番線ですか。', pinyin: 'Nanbansen desu ka', english: 'Which platform is it?', note: 'Station navigation.' },
            { chinese: '次はどこですか。', pinyin: 'Tsugi wa doko desu ka', english: 'What is the next stop?', note: 'Useful during rides.' },
            { chinese: 'タクシー乗り場はどこですか。', pinyin: 'Takushi noriba wa doko desu ka', english: 'Where is the taxi stand?', note: 'At stations and airports.' },
            { chinese: 'ここで降ります。', pinyin: 'Koko de orimasu', english: 'I will get off here.', note: 'Useful with taxis and buses.' },
          ],
        },
        {
          title: 'Hotels & Check-in',
          intro: 'Simple hotel communication for check-in and requests.',
          phrases: [
            { chinese: '予約しています。', pinyin: 'Yoyaku shiteimasu', english: 'I have a reservation.', note: 'Core check-in phrase.' },
            { chinese: 'チェックインをお願いします。', pinyin: 'Chekkuin o onegaishimasu', english: 'I would like to check in.', note: 'At front desk.' },
            { chinese: '朝食は何時ですか。', pinyin: 'Choshoku wa nanji desu ka', english: 'What time is breakfast?', note: 'Useful first-night question.' },
            { chinese: 'Wi-Fiのパスワードを教えてください。', pinyin: 'Waifai no pasuwaado o oshiete kudasai', english: 'Please tell me the Wi-Fi password.', note: 'Connectivity setup.' },
            { chinese: 'チェックアウトは何時ですか。', pinyin: 'Chekkuauto wa nanji desu ka', english: 'What time is checkout?', note: 'Departure planning.' },
            { chinese: '荷物を預けられますか。', pinyin: 'Nimotsu o azukeraremasu ka', english: 'Can you hold my luggage?', note: 'After checkout support.' },
          ],
        },
        {
          title: 'Restaurants & Ordering Food',
          intro: 'Restaurant lines for ordering and payment.',
          phrases: [
            { chinese: '二人です。', pinyin: 'Futari desu', english: 'Table for two.', note: 'At host stand.' },
            { chinese: 'これをください。', pinyin: 'Kore o kudasai', english: 'I will take this, please.', note: 'Simple ordering phrase.' },
            { chinese: 'おすすめは何ですか。', pinyin: 'Osusume wa nan desu ka', english: 'What do you recommend?', note: 'Menu navigation shortcut.' },
            { chinese: '辛くしないでください。', pinyin: 'Karakushinaide kudasai', english: 'Please do not make it spicy.', note: 'Preference and tolerance control.' },
            { chinese: 'お会計お願いします。', pinyin: 'Okaikei onegaishimasu', english: 'Bill, please.', note: 'Most common payment phrase.' },
            { chinese: '持ち帰りできますか。', pinyin: 'Mochikaeri dekimasu ka', english: 'Can I get this to go?', note: 'Takeout request.' },
          ],
        },
        {
          title: 'Convenience Stores',
          intro: 'Highly practical Japanese for daily small purchases.',
          phrases: [
            { chinese: '袋をください。', pinyin: 'Fukuro o kudasai', english: 'Please give me a bag.', note: 'Checkout flow.' },
            { chinese: '温めてください。', pinyin: 'Atatamete kudasai', english: 'Please heat this up.', note: 'Ready meals.' },
            { chinese: '箸をください。', pinyin: 'Hashi o kudasai', english: 'Please give me chopsticks.', note: 'Takeout meals.' },
            { chinese: 'レジ袋はいりません。', pinyin: 'Rejibukuro wa irimasen', english: 'I do not need a bag.', note: 'Common checkout question response.' },
            { chinese: 'このカードは使えますか。', pinyin: 'Kono kaado wa tsukaemasu ka', english: 'Can I use this card?', note: 'Payment confirmation.' },
            { chinese: 'トイレはありますか。', pinyin: 'Toire wa arimasu ka', english: 'Do you have a bathroom?', note: 'Essential travel comfort line.' },
          ],
        },
        {
          title: 'Shopping & Payments',
          intro: 'Retail and payment lines for common purchases.',
          phrases: [
            { chinese: 'いくらですか。', pinyin: 'Ikura desu ka', english: 'How much is it?', note: 'Most useful shopping phrase.' },
            { chinese: '別のサイズはありますか。', pinyin: 'Betsu no saizu wa arimasu ka', english: 'Do you have another size?', note: 'Clothing purchases.' },
            { chinese: '試着してもいいですか。', pinyin: 'Shichaku shitemo ii desu ka', english: 'May I try it on?', note: 'Fitting-room request.' },
            { chinese: 'クレジットカードは使えますか。', pinyin: 'Kurejitto kaado wa tsukaemasu ka', english: 'Can I use a credit card?', note: 'Payment method check.' },
            { chinese: '領収書をお願いします。', pinyin: 'Ryoshusho o onegaishimasu', english: 'Receipt, please.', note: 'Business and expense use.' },
            { chinese: '免税できますか。', pinyin: 'Menzei dekimasu ka', english: 'Can I get tax-free?', note: 'Tourist shopping in larger stores.' },
          ],
        },
        {
          title: 'Emergencies',
          intro: 'Short high-priority lines for urgent moments.',
          phrases: [
            { chinese: '助けてください。', pinyin: 'Tasukete kudasai', english: 'Please help me.', note: 'Immediate emergency line.' },
            { chinese: '警察を呼んでください。', pinyin: 'Keisatsu o yonde kudasai', english: 'Please call the police.', note: 'Safety incident support.' },
            { chinese: '救急車を呼んでください。', pinyin: 'Kyukyusha o yonde kudasai', english: 'Please call an ambulance.', note: 'Medical emergency.' },
            { chinese: '病院はどこですか。', pinyin: 'Byoin wa doko desu ka', english: 'Where is the hospital?', note: 'Urgent navigation.' },
            { chinese: 'パスポートをなくしました。', pinyin: 'Pasupooto o nakushimashita', english: 'I lost my passport.', note: 'Police and consular process.' },
            { chinese: '英語を話せる人はいますか。', pinyin: 'Eigo o hanaseru hito wa imasu ka', english: 'Is there someone who can speak English?', note: 'Communication support.' },
          ],
        },
        {
          title: 'Everyday Politeness',
          intro: 'Polite baseline phrases that improve every interaction.',
          phrases: [
            { chinese: 'すみません。', pinyin: 'Sumimasen', english: 'Excuse me / sorry.', note: 'Most useful social opener.' },
            { chinese: 'ありがとうございます。', pinyin: 'Arigato gozaimasu', english: 'Thank you very much.', note: 'Polite gratitude line.' },
            { chinese: 'お願いします。', pinyin: 'Onegaishimasu', english: 'Please / I appreciate your help.', note: 'Flexible polite request ending.' },
            { chinese: '大丈夫です。', pinyin: 'Daijobu desu', english: 'I am okay / no thank you.', note: 'Simple response in many contexts.' },
            { chinese: 'ゆっくり話してください。', pinyin: 'Yukkuri hanashite kudasai', english: 'Please speak slowly.', note: 'Pronunciation support phrase.' },
            { chinese: '日本語を勉強しています。', pinyin: 'Nihongo o benkyo shiteimasu', english: 'I am studying Japanese.', note: 'Friendly context line with locals.' },
          ],
        },
      ]}
      practiceNote="Practice these phrases with speech feedback in Sonus Travel Sprint."
      faq={[
        {
          question: 'Do I need to speak Japanese to travel in Japan?',
          answer: 'You can travel without fluency, but practical phrases reduce stress and improve daily interactions significantly.',
        },
        {
          question: 'What Japanese phrases should tourists learn first?',
          answer: 'Start with greetings, directions, payment, bathroom, and emergency lines.',
        },
        {
          question: 'Is English widely spoken in Japan?',
          answer: 'English availability varies by city and context. Basic Japanese phrases remain highly useful.',
        },
        {
          question: 'How can I practice Japanese pronunciation for travel?',
          answer: 'Use short phrase repetition with feedback and scenario drills to build reliable travel speech.',
        },
      ]}
      relatedHeading="Travel Sprint Guides"
      related={allRelatedLinks.filter((item) => item.to !== '/essential-japanese-travel-phrases')}
    />
  );
}
