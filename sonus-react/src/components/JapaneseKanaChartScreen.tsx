import { useRef, useState } from 'react';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { useAudio } from '../hooks/useAudio';

type KanaEntry = {
  kana: string;
  romaji: string;
};

type KanaCell = KanaEntry | null;

interface JapaneseKanaChartScreenProps {
  script: 'hiragana' | 'katakana';
  onGoHome: () => void;
  onOpenProfile: () => void;
}

const COLUMN_HEADERS = ['A', 'I', 'U', 'E', 'O'] as const;

const HIRAGANA_ROWS: Array<{ label: string; cells: KanaCell[] }> = [
  { label: '-', cells: [{ kana: 'あ', romaji: 'a' }, { kana: 'い', romaji: 'i' }, { kana: 'う', romaji: 'u' }, { kana: 'え', romaji: 'e' }, { kana: 'お', romaji: 'o' }] },
  { label: 'K', cells: [{ kana: 'か', romaji: 'ka' }, { kana: 'き', romaji: 'ki' }, { kana: 'く', romaji: 'ku' }, { kana: 'け', romaji: 'ke' }, { kana: 'こ', romaji: 'ko' }] },
  { label: 'S', cells: [{ kana: 'さ', romaji: 'sa' }, { kana: 'し', romaji: 'shi' }, { kana: 'す', romaji: 'su' }, { kana: 'せ', romaji: 'se' }, { kana: 'そ', romaji: 'so' }] },
  { label: 'T', cells: [{ kana: 'た', romaji: 'ta' }, { kana: 'ち', romaji: 'chi' }, { kana: 'つ', romaji: 'tsu' }, { kana: 'て', romaji: 'te' }, { kana: 'と', romaji: 'to' }] },
  { label: 'N', cells: [{ kana: 'な', romaji: 'na' }, { kana: 'に', romaji: 'ni' }, { kana: 'ぬ', romaji: 'nu' }, { kana: 'ね', romaji: 'ne' }, { kana: 'の', romaji: 'no' }] },
  { label: 'H', cells: [{ kana: 'は', romaji: 'ha' }, { kana: 'ひ', romaji: 'hi' }, { kana: 'ふ', romaji: 'fu' }, { kana: 'へ', romaji: 'he' }, { kana: 'ほ', romaji: 'ho' }] },
  { label: 'M', cells: [{ kana: 'ま', romaji: 'ma' }, { kana: 'み', romaji: 'mi' }, { kana: 'む', romaji: 'mu' }, { kana: 'め', romaji: 'me' }, { kana: 'も', romaji: 'mo' }] },
  { label: 'Y', cells: [{ kana: 'や', romaji: 'ya' }, null, { kana: 'ゆ', romaji: 'yu' }, null, { kana: 'よ', romaji: 'yo' }] },
  { label: 'R', cells: [{ kana: 'ら', romaji: 'ra' }, { kana: 'り', romaji: 'ri' }, { kana: 'る', romaji: 'ru' }, { kana: 'れ', romaji: 're' }, { kana: 'ろ', romaji: 'ro' }] },
  { label: 'W', cells: [{ kana: 'わ', romaji: 'wa' }, null, null, null, { kana: 'を', romaji: 'o/wo' }] },
  { label: 'N', cells: [{ kana: 'ん', romaji: 'n' }, null, null, null, null] },
];

const KATAKANA_ROWS: Array<{ label: string; cells: KanaCell[] }> = [
  { label: '-', cells: [{ kana: 'ア', romaji: 'a' }, { kana: 'イ', romaji: 'i' }, { kana: 'ウ', romaji: 'u' }, { kana: 'エ', romaji: 'e' }, { kana: 'オ', romaji: 'o' }] },
  { label: 'K', cells: [{ kana: 'カ', romaji: 'ka' }, { kana: 'キ', romaji: 'ki' }, { kana: 'ク', romaji: 'ku' }, { kana: 'ケ', romaji: 'ke' }, { kana: 'コ', romaji: 'ko' }] },
  { label: 'S', cells: [{ kana: 'サ', romaji: 'sa' }, { kana: 'シ', romaji: 'shi' }, { kana: 'ス', romaji: 'su' }, { kana: 'セ', romaji: 'se' }, { kana: 'ソ', romaji: 'so' }] },
  { label: 'T', cells: [{ kana: 'タ', romaji: 'ta' }, { kana: 'チ', romaji: 'chi' }, { kana: 'ツ', romaji: 'tsu' }, { kana: 'テ', romaji: 'te' }, { kana: 'ト', romaji: 'to' }] },
  { label: 'N', cells: [{ kana: 'ナ', romaji: 'na' }, { kana: 'ニ', romaji: 'ni' }, { kana: 'ヌ', romaji: 'nu' }, { kana: 'ネ', romaji: 'ne' }, { kana: 'ノ', romaji: 'no' }] },
  { label: 'H', cells: [{ kana: 'ハ', romaji: 'ha' }, { kana: 'ヒ', romaji: 'hi' }, { kana: 'フ', romaji: 'fu' }, { kana: 'ヘ', romaji: 'he' }, { kana: 'ホ', romaji: 'ho' }] },
  { label: 'M', cells: [{ kana: 'マ', romaji: 'ma' }, { kana: 'ミ', romaji: 'mi' }, { kana: 'ム', romaji: 'mu' }, { kana: 'メ', romaji: 'me' }, { kana: 'モ', romaji: 'mo' }] },
  { label: 'Y', cells: [{ kana: 'ヤ', romaji: 'ya' }, null, { kana: 'ユ', romaji: 'yu' }, null, { kana: 'ヨ', romaji: 'yo' }] },
  { label: 'R', cells: [{ kana: 'ラ', romaji: 'ra' }, { kana: 'リ', romaji: 'ri' }, { kana: 'ル', romaji: 'ru' }, { kana: 'レ', romaji: 're' }, { kana: 'ロ', romaji: 'ro' }] },
  { label: 'W', cells: [{ kana: 'ワ', romaji: 'wa' }, null, null, null, { kana: 'ヲ', romaji: 'o/wo' }] },
  { label: 'N', cells: [{ kana: 'ン', romaji: 'n' }, null, null, null, null] },
];

export default function JapaneseKanaChartScreen({
  script,
  onGoHome,
  onOpenProfile,
}: JapaneseKanaChartScreenProps) {
  const { speak } = useAudio();
  const [activeKana, setActiveKana] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const isHiragana = script === 'hiragana';
  const title = isHiragana ? 'Hiragana' : 'Katakana';
  const subtitle = isHiragana
    ? 'Core script for grammar and native words'
    : 'Common for loanwords, names, and modern terms';
  const rows = isHiragana ? HIRAGANA_ROWS : KATAKANA_ROWS;

  const playKana = (entry: KanaEntry) => {
    speak(entry.kana, entry.romaji, false, 'ja');
    setActiveKana(entry.kana);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setActiveKana(null);
      timerRef.current = null;
    }, 420);
  };

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav bg-[linear-gradient(180deg,#F7FAFD_0%,#EEF4F8_100%)]">
      <GlassHeader
        title={`${title} Chart`}
        hideLogoOnMobile
        className="bg-white/12 border-white/25"
        scrolledClassName="bg-[var(--sonus-palette-blue)]/88 border-white/35"
        titleClassName="text-[var(--sonus-palette-charcoal)]"
        scrolledTitleClassName="text-white"
      />

      <div className="max-w-6xl mx-auto">
        <section className="dashboard-card-enter mb-4 rounded-3xl border-2 border-[var(--sonus-palette-charcoal)] bg-[var(--sonus-palette-charcoal)] p-5 sm:p-6 text-white shadow-[0_22px_45px_-32px_rgba(31,42,55,0.60)]">
          <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-white/80">Japanese Foundations</div>
          <h2 className="main-font mt-2 text-[2rem] sm:text-[2.35rem] leading-tight max-w-3xl">{title}</h2>
          <p className="mt-3 text-[15px] leading-7 text-white/92 max-w-3xl">{subtitle}. Tap a square to hear pronunciation.</p>
        </section>
      </div>

      <section className="dashboard-card-enter max-w-6xl mx-auto rounded-3xl border border-[#2B3440] bg-[var(--sonus-palette-charcoal)] shadow-[0_16px_34px_-26px_rgba(15,23,42,0.28)] overflow-hidden">
        <article className="px-4 py-5 sm:px-6 sm:py-6">
          <h3 className="main-font text-[1.5rem] sm:text-[1.75rem] leading-tight text-white">Gojuon Chart</h3>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] font-mono text-[#B5D8EA]">Tap to Play Audio</p>

          <div className="mt-4">
            <div>
              <div className="grid grid-cols-[34px_repeat(5,minmax(0,1fr))] gap-1.5 sm:grid-cols-[40px_repeat(5,minmax(0,1fr))] sm:gap-2 md:grid-cols-[46px_repeat(5,minmax(0,1fr))] lg:grid-cols-[52px_repeat(5,minmax(0,1fr))]">
                <div />
                {COLUMN_HEADERS.map((header) => (
                  <div
                    key={header}
                    className="rounded-lg border border-[#3A4654] bg-[#2B3440] py-1.5 text-center text-[10px] font-mono tracking-[0.12em] text-[#B5D8EA] sm:rounded-xl sm:py-2 sm:text-[11px] sm:tracking-[0.14em]"
                  >
                    {header}
                  </div>
                ))}
                {rows.map((row, rowIndex) => (
                  <div className="contents" key={`${row.label}-${rowIndex}`}>
                    <div className="rounded-lg border border-[#3A4654] bg-[#2B3440] py-1.5 text-center text-[10px] font-mono tracking-[0.12em] text-[#B5D8EA] sm:rounded-xl sm:py-2 sm:text-[11px] sm:tracking-[0.14em]">
                      {row.label}
                    </div>
                    {row.cells.map((entry, cellIndex) => {
                      if (!entry) {
                        return (
                          <div
                            key={`empty-${rowIndex}-${cellIndex}`}
                            className="rounded-lg border border-dashed border-[#3A4654] bg-[#26303C] sm:rounded-xl"
                          />
                        );
                      }
                      const isActive = activeKana === entry.kana;
                      return (
                        <button
                          type="button"
                          key={entry.kana}
                          onClick={() => playKana(entry)}
                          className={`rounded-lg border px-1.5 py-2.5 text-left transition-all sm:rounded-xl sm:px-2 sm:py-3.5 ${
                            isActive
                              ? 'border-[#7CC3E2] bg-[#23506A] shadow-[0_10px_22px_-18px_rgba(124,195,226,0.55)]'
                              : 'border-[#3A4654] bg-[#2B3440] hover:border-[#7CC3E2]/55 active:scale-[0.985]'
                          }`}
                          aria-label={`Play ${entry.kana} (${entry.romaji})`}
                        >
                          <p className="main-font text-[1.05rem] text-white leading-none sm:text-[1.2rem] md:text-[1.35rem]">{entry.kana}</p>
                          <p className="mt-1 text-[10px] text-[#B5D8EA] sm:text-[11px] md:text-[12px]">{entry.romaji}</p>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
