import { AudioLines } from 'lucide-react';
import BottomNav from '../BottomNav';
import GlassHeader from '../GlassHeader';
import { useAudio } from '../../hooks/useAudio';

interface PinyinFoundationsProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
}

const CONTRAST_PAIRS = [
  { id: 'zh-z', left: { hanzi: '知', pinyin: 'zhī' }, right: { hanzi: '资', pinyin: 'zī' }, note: 'Retroflex zh/ch/sh are curled tongue sounds.' },
  { id: 'j-zh', left: { hanzi: '鸡', pinyin: 'jī' }, right: { hanzi: '知', pinyin: 'zhī' }, note: 'j/q/x are front-tongue with a tighter smile shape.' },
  { id: 'x-sh', left: { hanzi: '西', pinyin: 'xī' }, right: { hanzi: '诗', pinyin: 'shī' }, note: 'x is flatter and lighter than sh.' },
  { id: 'an-ang', left: { hanzi: '安', pinyin: 'ān' }, right: { hanzi: '昂', pinyin: 'áng' }, note: 'Add a clear nasal tail for -ng finals.' },
] as const;

const BUILD_FLOW = [
  {
    left: { hanzi: '你', pinyin: 'nǐ', english: 'you' },
    right: { hanzi: '好', pinyin: 'hǎo', english: 'good' },
    result: { hanzi: '你好', pinyin: 'nǐ hǎo', english: 'hello' },
  },
  {
    left: { hanzi: '我', pinyin: 'wǒ', english: 'I / me' },
    right: { hanzi: '是', pinyin: 'shì', english: 'to be' },
    result: { hanzi: '我是', pinyin: 'wǒ shì', english: 'I am' },
  },
  {
    left: { hanzi: '中', pinyin: 'zhōng', english: 'middle / central' },
    right: { hanzi: '国', pinyin: 'guó', english: 'country' },
    result: { hanzi: '中国', pinyin: 'zhōng guó', english: 'China' },
  },
  {
    left: { hanzi: '美', pinyin: 'měi', english: 'beautiful / America (abbr.)' },
    right: { hanzi: '国', pinyin: 'guó', english: 'country' },
    result: { hanzi: '美国', pinyin: 'měi guó', english: 'United States' },
  },
] as const;

export default function PinyinFoundations({ onGoHome, onOpenProfile }: PinyinFoundationsProps) {
  const { speak } = useAudio();

  return (
    <div className="min-h-screen page-shell px-6 pb-24">
      <GlassHeader title="Pinyin Foundations" spacerClassName="mb-10" />

      <div className="space-y-4">
        <section className="rounded-3xl border border-[#186E95] bg-[#186E95] p-5 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.45)]">
          <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-white/20 text-white">
            Why Pinyin Matters
          </div>
          <h2 className="main-font text-[1.9rem] text-white mt-3">Pinyin Is Your Sound Map</h2>
          <p className="text-sm text-white/90 mt-2">
            Pinyin shows how a character is pronounced using Roman letters and tone marks. It helps beginners read, hear, and say words correctly before they can recognize every character quickly.
          </p>
        </section>

        <section className="rounded-3xl border border-[#374151]/35 bg-white/95 p-5 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)]">
          <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(55,65,81,0.10)] text-[#374151]">
            How It Works
          </div>
          <h2 className="main-font text-[1.9rem] text-[#374151] mt-3">Build a Syllable in 3 Parts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="rounded-2xl border border-border bg-white p-4 text-center">
              <div className="text-xs font-mono uppercase tracking-wider text-text-light">1</div>
              <div className="text-2xl secondary-font text-text-dark mt-1">Initial</div>
              <p className="text-sm text-text-med mt-2">Starting consonant sound, like <span className="font-semibold">m</span>, <span className="font-semibold">zh</span>, <span className="font-semibold">x</span>.</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-4 text-center">
              <div className="text-xs font-mono uppercase tracking-wider text-text-light">2</div>
              <div className="text-2xl secondary-font text-text-dark mt-1">Final</div>
              <p className="text-sm text-text-med mt-2">Vowel ending, like <span className="font-semibold">a</span>, <span className="font-semibold">ao</span>, <span className="font-semibold">ang</span>.</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-4 text-center">
              <div className="text-xs font-mono uppercase tracking-wider text-text-light">3</div>
              <div className="text-2xl secondary-font text-text-dark mt-1">Tone</div>
              <p className="text-sm text-text-med mt-2">Pitch shape that changes meaning, shown with marks like <span className="font-semibold">ā á ǎ à</span>.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#C2410C]/40 bg-white/95 p-5 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)]">
          <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(194,65,12,0.12)] text-[#C2410C]">
            Character to Pinyin
          </div>
          <h2 className="main-font text-[1.9rem] text-[#C2410C] mt-3">Read Characters with Sound Support</h2>
          <p className="text-sm text-text-med mt-2">
            Start by connecting each character to its pinyin. This helps you read aloud and remember pronunciation while your character recognition grows.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {BUILD_FLOW.map((item) => (
              <div
                key={item.result.hanzi}
                className="rounded-2xl border border-border bg-white p-4 md:p-5 shadow-[0_10px_22px_-20px_rgba(15,23,42,0.4)]"
              >
                <div className="text-base font-bold text-text-dark text-center mb-1">{item.result.english}</div>
                <div className="flex items-center justify-center gap-3 text-text-dark mt-3">
                  <button
                    onClick={() => speak(item.left.hanzi, item.left.pinyin)}
                    className="text-center rounded-xl border border-border/80 px-3 py-2 min-w-[80px] hover:bg-[rgba(55,65,81,0.06)]"
                  >
                    <div className="text-3xl secondary-font leading-none">{item.left.hanzi}</div>
                    <div className="text-xs text-text-med">{item.left.pinyin}</div>
                    <div className="text-xs text-text-dark">{item.left.english}</div>
                  </button>
                  <span className="text-xl text-text-light font-semibold">+</span>
                  <button
                    onClick={() => speak(item.right.hanzi, item.right.pinyin)}
                    className="text-center rounded-xl border border-border/80 px-3 py-2 min-w-[80px] hover:bg-[rgba(55,65,81,0.06)]"
                  >
                    <div className="text-3xl secondary-font leading-none">{item.right.hanzi}</div>
                    <div className="text-xs text-text-med">{item.right.pinyin}</div>
                    <div className="text-xs text-text-dark">{item.right.english}</div>
                  </button>
                  <span className="text-xl text-text-light font-semibold">=</span>
                  <button
                    onClick={() => speak(item.result.hanzi, item.result.pinyin)}
                    className="text-center rounded-xl border border-[#C2410C]/30 bg-[rgba(194,65,12,0.06)] px-3 py-2 min-w-[100px] hover:bg-[rgba(194,65,12,0.12)]"
                  >
                    <div className="text-3xl secondary-font leading-none">{item.result.hanzi}</div>
                    <div className="text-xs text-[#C2410C] font-medium">{item.result.pinyin}</div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[#186E95]/40 bg-white/95 p-5 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)]">
          <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(24,110,149,0.12)] text-[#186E95]">
            Build Better Pronunciation
          </div>
          <h2 className="main-font text-[1.9rem] text-[#186E95] mt-3">Train the Difficult Distinctions</h2>
          <p className="text-sm text-text-med mt-2">
            These pinyin pairs are commonly mixed up by beginners. Train them early so new words are easier to learn later.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {CONTRAST_PAIRS.map((pair) => (
              <div key={pair.id} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => speak(pair.left.hanzi, pair.left.pinyin)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-mono uppercase tracking-wider text-[#186E95]"
                  >
                    <AudioLines className="w-3.5 h-3.5" />
                    {pair.left.pinyin}
                  </button>
                  <button
                    onClick={() => speak(pair.right.hanzi, pair.right.pinyin)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-mono uppercase tracking-wider text-[#3E5648]"
                  >
                    <AudioLines className="w-3.5 h-3.5" />
                    {pair.right.pinyin}
                  </button>
                </div>
                <p className="text-sm text-text-med">{pair.note}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
