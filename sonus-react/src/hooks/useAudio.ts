import { useCallback } from 'react';

export function useAudio() {
  const speak = useCallback((text: string, reading: string, slow = false, languageHint?: string | null) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech not supported in this browser');
      return;
    }

    const normalizedHint = (languageHint || '').toLowerCase() === 'jp'
      ? 'ja'
      : (languageHint || '').toLowerCase();
    const hasKana = /[\u3040-\u30ff]/.test(text || '');
    const hasToneMarks = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(reading || '');
    const hasToneNumbers = /(?:^|\s)[a-züv:]+[1-5](?=\s|$)/i.test(reading || '');
    const isCjk = /[\u3400-\u9fff]/.test(text || '');
    const isLikelyJapanese =
      normalizedHint === 'ja' ||
      hasKana ||
      (isCjk && Boolean(reading?.trim()) && !hasToneMarks && !hasToneNumbers);
    const targetLanguage = isLikelyJapanese ? 'ja' : 'zh';

    const synth = window.speechSynthesis;
    synth.cancel();

    const voices = synth.getVoices();

    // Prefer high-quality Mandarin voices when available.
    const preferredChineseVoice = voices.find((v) =>
      v.lang.includes('zh') &&
      (v.name.includes('Ting-Ting') ||
        v.name.includes('Sin-Ji') ||
        v.name.includes('Meijia'))
    );
    const preferredJapaneseVoice = voices.find((v) =>
      v.lang.toLowerCase().includes('ja') &&
      (v.name.includes('Kyoko') ||
        v.name.includes('Otoya') ||
        v.name.includes('Haruka') ||
        v.name.includes('Ichiro'))
    );

    const anyChineseVoice = voices.find((v) => v.lang.includes('zh'));
    const anyJapaneseVoice = voices.find((v) => v.lang.toLowerCase().includes('ja'));

    const chineseVoice: SpeechSynthesisVoice | undefined =
      preferredChineseVoice ??
      (anyChineseVoice && !anyChineseVoice.name.includes('Eddy')
        ? anyChineseVoice
        : undefined);
    const japaneseVoice: SpeechSynthesisVoice | undefined = preferredJapaneseVoice ?? anyJapaneseVoice;

    let textToSpeak: string;
    let lang: string;
    let voice: SpeechSynthesisVoice | undefined;

    if (targetLanguage === 'ja') {
      textToSpeak = text || reading;
      lang = 'ja-JP';
      voice = japaneseVoice;
      if (!textToSpeak) {
        textToSpeak = reading || text;
        lang = 'en-US';
        voice = voices.find((v) => v.lang.includes('en'));
      }
    } else if (chineseVoice) {
      textToSpeak = text;
      lang = 'zh-CN';
      voice = chineseVoice;
    } else {
      // Fallback to pinyin/romaji when a matching voice is unavailable.
      textToSpeak = reading || text;
      lang = 'en-US';
      voice = voices.find((v) => v.lang.includes('en'));
    }

    const isCjkText = /[\u3040-\u30ff\u3400-\u9fff]/.test(textToSpeak);
    const playbackText = slow && isCjkText
      ? Array.from(textToSpeak).join(' ')
      : textToSpeak;
    const utterance = new SpeechSynthesisUtterance(playbackText);
    utterance.lang = lang;
    utterance.rate = slow ? 0.35 : 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    if (voice) utterance.voice = voice;

    utterance.onerror = (e) => {
      console.error('[Audio] Speech error:', e.error);
    };

    try {
      // Keep speak() in the original click/tap gesture to avoid autoplay blocking on Safari/iOS.
      synth.speak(utterance);
    } catch (e) {
      console.error('[Audio] Speech synthesis error:', e);
      alert('Audio error: ' + (e as Error).message);
    }
  }, []);

  return { speak };
}
