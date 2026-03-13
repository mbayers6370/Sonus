import BottomNav from '../BottomNav';
import GlassHeader from '../GlassHeader';

interface CharacterFoundationsProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
}

const RADICAL_GROUPS = [
  {
    id: 'person',
    radical: '亻',
    meaning: 'person / human actions',
    examples: [
      { hanzi: '你', pinyin: 'nǐ', gloss: 'you' },
      { hanzi: '他', pinyin: 'tā', gloss: 'he' },
      { hanzi: '们', pinyin: 'men', gloss: 'plural marker (people)' },
    ],
  },
  {
    id: 'mouth',
    radical: '口',
    meaning: 'speech / mouth / sounds',
    examples: [
      { hanzi: '吗', pinyin: 'ma', gloss: 'question particle' },
      { hanzi: '吃', pinyin: 'chī', gloss: 'eat' },
      { hanzi: '喝', pinyin: 'hē', gloss: 'drink' },
    ],
  },
  {
    id: 'water',
    radical: '氵',
    meaning: 'water / liquid / flow',
    examples: [
      { hanzi: '河', pinyin: 'hé', gloss: 'river' },
      { hanzi: '海', pinyin: 'hǎi', gloss: 'sea' },
      { hanzi: '洗', pinyin: 'xǐ', gloss: 'wash' },
    ],
  },
] as const;

const BUILD_CARDS = [
  {
    id: 'hao',
    hanzi: '好',
    pinyin: 'hǎo',
    meaning: 'good',
    breakdown: '女 + 子',
    components: [
      { hanzi: '女', pinyin: 'nǚ', gloss: 'woman' },
      { hanzi: '子', pinyin: 'zǐ', gloss: 'child' },
    ],
    hook: 'Originally combines woman + child to represent goodness/well-being.',
  },
  {
    id: 'ming',
    hanzi: '明',
    pinyin: 'míng',
    meaning: 'bright / clear',
    breakdown: '日 + 月',
    components: [
      { hanzi: '日', pinyin: 'rì', gloss: 'sun' },
      { hanzi: '月', pinyin: 'yuè', gloss: 'moon' },
    ],
    hook: 'Sun + moon gives an easy memory hook for brightness.',
  },
  {
    id: 'xie',
    hanzi: '谢',
    pinyin: 'xiè',
    meaning: 'thank',
    breakdown: '讠 + 射',
    components: [
      { hanzi: '讠', pinyin: 'yán', gloss: 'speech radical' },
      { hanzi: '射', pinyin: 'shè', gloss: 'phonetic form' },
    ],
    hook: 'The left side marks speech/language, and the right side helps with pronunciation memory. This character is used in polite speech to say thank you.',
  },
] as const;

export default function CharacterFoundations({ onGoHome, onOpenProfile }: CharacterFoundationsProps) {
  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav bg-[linear-gradient(180deg,#F7FAFD_0%,#EEF4F8_100%)]">
      <GlassHeader
        title="Character Foundations"
        hideLogoOnMobile
        spacerClassName="mb-10"
        className="bg-white/12 border-white/25"
        scrolledClassName="bg-[var(--sonus-palette-blue)]/88 border-white/35"
        titleClassName="text-[var(--sonus-palette-charcoal)]"
        scrolledTitleClassName="text-white"
      />

      <div className="max-w-6xl mx-auto space-y-4">
        <section className="dashboard-card-enter rounded-3xl border-2 border-[var(--sonus-palette-charcoal)] bg-[var(--sonus-palette-charcoal)] p-5 sm:p-6 text-white shadow-[0_22px_45px_-32px_rgba(31,42,55,0.60)]">
          <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-[#B5D8EA]">Mandarin Foundations</div>
          <h2 className="main-font mt-2 text-[2rem] leading-tight">Decode Characters with Structure</h2>
          <p className="mt-2 text-sm text-white/90">
            Learn radicals and component patterns to recognize meaning faster and remember forms longer.
          </p>
        </section>

        <section className="dashboard-card-enter rounded-3xl border border-[#2B3440] bg-[var(--sonus-palette-charcoal)] p-5 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.28)]">
          <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(181,216,234,0.16)] text-[#B5D8EA]">
            Component Radar
          </div>
          <h2 className="main-font text-[1.9rem] text-white mt-3">Spot Meaning Hints Faster</h2>
          <p className="text-sm text-[#B5D8EA] mt-2">
            Learn common radicals so unknown characters become easier to decode while reading.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {RADICAL_GROUPS.map((group) => (
              <div key={group.id} className="rounded-2xl border border-border bg-white p-4 text-center">
                <div className="text-3xl secondary-font text-text-dark">{group.radical}</div>
                <div className="text-xs font-mono uppercase tracking-wider text-text-light mt-1">{group.meaning}</div>
                <div className="mt-3 space-y-2">
                  {group.examples.map((example) => (
                    <div
                      key={`${group.id}-${example.hanzi}`}
                      className="rounded-lg bg-[rgba(31,42,55,0.08)] px-3 py-2 text-text-dark"
                    >
                      <div className="text-2xl font-bold secondary-font leading-none">{example.hanzi}</div>
                      <div className="text-xs text-text-med mt-1">{example.pinyin} · {example.gloss}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-card-enter rounded-3xl border border-[#2B3440] bg-[var(--sonus-palette-charcoal)] p-5 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.28)]">
          <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(181,216,234,0.16)] text-[#B5D8EA]">
            Build + Remember
          </div>
          <h2 className="main-font text-[1.9rem] text-white mt-3">Character Memory Hooks</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {BUILD_CARDS.map((card) => (
              <div key={card.id} className="rounded-2xl border border-border bg-white p-4 text-center">
                <div className="text-4xl secondary-font text-text-dark">{card.hanzi}</div>
                <div className="text-sm text-text-med mt-1">{card.pinyin} · {card.meaning}</div>
                <div className="text-xs font-mono uppercase tracking-wider text-text-light mt-3">{card.breakdown}</div>
                <div className="mt-3 space-y-1">
                  {card.components.map((component) => (
                    <div key={`${card.id}-${component.hanzi}`} className="text-xs text-text-med">
                      {component.hanzi} {component.pinyin} · {component.gloss}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-text-med mt-3">{card.hook}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
