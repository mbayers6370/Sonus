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
    const languageToLocale: Record<string, string> = {
      zh: 'zh-CN',
      ja: 'ja-JP',
      kr: 'ko-KR',
      ko: 'ko-KR',
      fr: 'fr-FR',
      it: 'it-IT',
      es: 'es-ES',
    };
    const hasKana = /[\u3040-\u30ff]/.test(text || '');
    const hasToneMarks = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(reading || '');
    const hasToneNumbers = /(?:^|\s)[a-züv:]+[1-5](?=\s|$)/i.test(reading || '');
    const isCjk = /[\u3400-\u9fff]/.test(text || '');
    const isLikelyJapanese =
      normalizedHint === 'ja' ||
      hasKana ||
      (isCjk && Boolean(reading?.trim()) && !hasToneMarks && !hasToneNumbers);
    const hintedLanguage = ['zh', 'ja', 'kr', 'ko', 'fr', 'it', 'es'].includes(normalizedHint)
      ? normalizedHint
      : null;
    const targetLanguage = hintedLanguage || (isLikelyJapanese ? 'ja' : 'zh');

    const synth = window.speechSynthesis;
    synth.cancel();

    const voices = synth.getVoices();

    const preferredByLanguage: Record<string, RegExp[]> = {
      zh: [/ting-ting/i, /sin-ji/i, /meijia/i],
      ja: [/kyoko/i, /otoya/i, /haruka/i, /ichiro/i],
      ko: [/yuna/i, /narae/i],
      fr: [/thomas/i, /amelie/i, /aurelie/i],
      it: [/alice/i, /luca/i],
      es: [/jorge/i, /monica/i, /paulina/i],
    };
    const voiceLanguageKey = targetLanguage === 'kr' ? 'ko' : targetLanguage;
    const voiceLangPrefix = voiceLanguageKey.toLowerCase();
    const sameLangVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(voiceLangPrefix));
    const preferredVoice = sameLangVoices.find((v) =>
      (preferredByLanguage[voiceLanguageKey] || []).some((pattern) => pattern.test(v.name))
    );
    const anyLanguageVoice = sameLangVoices[0];

    let textToSpeak: string;
    let lang: string;
    let voice: SpeechSynthesisVoice | undefined;

    const locale = languageToLocale[targetLanguage] || 'en-US';
    if (preferredVoice || anyLanguageVoice) {
      textToSpeak = text || reading;
      lang = locale;
      voice = preferredVoice || anyLanguageVoice;
      if (!textToSpeak) {
        textToSpeak = reading || text;
      }
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
