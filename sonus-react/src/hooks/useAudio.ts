import { useCallback } from 'react';

export function useAudio() {
  const speak = useCallback((hanzi: string, pinyin: string, slow = false) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech not supported in this browser');
      return;
    }

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

    const anyChineseVoice = voices.find((v) => v.lang.includes('zh'));

    const chineseVoice: SpeechSynthesisVoice | undefined =
      preferredChineseVoice ??
      (anyChineseVoice && !anyChineseVoice.name.includes('Eddy')
        ? anyChineseVoice
        : undefined);

    let textToSpeak: string;
    let lang: string;
    let voice: SpeechSynthesisVoice | undefined;

    if (chineseVoice) {
      textToSpeak = hanzi;
      lang = 'zh-CN';
      voice = chineseVoice;
    } else {
      // Fallback to pinyin when a Chinese voice is unavailable.
      textToSpeak = pinyin || hanzi;
      lang = 'en-US';
      voice = voices.find((v) => v.lang.includes('en'));
    }

    const textForPlayback = slow
      // Add spacing for syllable-level pacing in slow mode.
      ? textToSpeak
          .split('')
          .join('   ')
          .replace(/\s{3,}/g, '   ')
      : textToSpeak;

    const utterance = new SpeechSynthesisUtterance(textForPlayback);
    utterance.lang = lang;
    utterance.rate = slow ? 0.05 : 0.9;
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
