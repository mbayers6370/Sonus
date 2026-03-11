import { useCallback } from 'react';
import { normalizeLanguageId } from '../lib/languageRuntime';

let voiceRegistryInitialized = false;
let cachedVoices: SpeechSynthesisVoice[] = [];
const LAST_LANGUAGE_KEY = 'sonus.last_language';

function readPersistedLanguage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_LANGUAGE_KEY);
    if (!raw || !raw.trim()) return null;
    return normalizeLanguageId(raw);
  } catch {
    return null;
  }
}

function refreshVoiceCache() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
}

function ensureVoiceRegistry() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  refreshVoiceCache();
  if (voiceRegistryInitialized) return;
  voiceRegistryInitialized = true;
  const synth = window.speechSynthesis;
  const onVoicesChanged = () => refreshVoiceCache();
  synth.addEventListener?.('voiceschanged', onVoicesChanged);
  if ('onvoiceschanged' in synth) {
    synth.onvoiceschanged = onVoicesChanged;
  }
}

export function useAudio() {
  const speak = useCallback((text: string, reading: string, slow = false, languageHint?: string | null) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech not supported in this browser');
      return;
    }

    const normalizedHint = languageHint ? normalizeLanguageId(languageHint) : '';
    const languageToLocale: Record<string, string> = {
      ja: 'ja-JP',
      kr: 'ko-KR',
      ko: 'ko-KR',
      fr: 'fr-FR',
      it: 'it-IT',
      es: 'es-ES',
    };
    const hintedLanguage = ['ja', 'kr', 'ko', 'fr', 'it', 'es'].includes(normalizedHint)
      ? normalizedHint
      : null;
    const persistedLanguage = readPersistedLanguage();
    const targetLanguage =
      hintedLanguage ||
      (persistedLanguage && ['ja', 'kr', 'ko', 'fr', 'it', 'es'].includes(persistedLanguage)
        ? persistedLanguage
        : 'ja');

    const synth = window.speechSynthesis;
    ensureVoiceRegistry();
    synth.cancel();

    const voices = cachedVoices.length > 0 ? cachedVoices : synth.getVoices();

    const preferredByLanguage: Record<string, RegExp[]> = {
      ja: [/kyoko/i, /otoya/i, /haruka/i, /ichiro/i, /nanami/i, /keita/i],
      ko: [/yuna/i, /narae/i],
      fr: [/thomas/i, /amelie/i, /aurelie/i],
      it: [/alice/i, /luca/i],
      es: [/jorge/i, /monica/i, /paulina/i],
    };
    const qualityBonus = (name: string) => {
      let bonus = 0;
      if (/(premium|enhanced|natural|neural)/i.test(name)) bonus += 3;
      if (/(compact|ecompact|legacy)/i.test(name)) bonus -= 2;
      return bonus;
    };
    const voiceLanguageKey = targetLanguage === 'kr' ? 'ko' : targetLanguage;
    const voiceLangPrefix = voiceLanguageKey.toLowerCase();
    const sameLangVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(voiceLangPrefix));
    const rankedVoices = sameLangVoices
      .map((voice) => {
        const preferredScore = (preferredByLanguage[voiceLanguageKey] || []).some((pattern) => pattern.test(voice.name))
          ? 10
          : 0;
        const localBonus = voice.localService ? 1 : 0;
        return {
          voice,
          score: preferredScore + qualityBonus(voice.name) + localBonus,
        };
      })
      .sort((a, b) => b.score - a.score);
    const selectedSameLangVoice = rankedVoices[0]?.voice;

    let textToSpeak: string;
    let lang: string;
    let voice: SpeechSynthesisVoice | undefined;

    const locale = languageToLocale[targetLanguage] || 'en-US';
    if (selectedSameLangVoice) {
      textToSpeak = text || reading;
      lang = locale;
      voice = selectedSameLangVoice;
      if (!textToSpeak) {
        textToSpeak = reading || text;
      }
    } else {
      // Keep locale target even before voices finish loading to avoid robotic English fallback.
      textToSpeak = text || reading;
      lang = locale;
      voice = undefined;
    }

    const isCjkText = /[\u3040-\u30ff\u3400-\u9fff]/.test(textToSpeak);
    const playbackText = slow && isCjkText
      ? Array.from(textToSpeak).join(' ')
      : textToSpeak;
    const utterance = new SpeechSynthesisUtterance(playbackText);
    utterance.lang = lang;
    const defaultRateByLanguage: Record<string, number> = {
      ja: 0.8,
      ko: 0.84,
      fr: 0.9,
      it: 0.9,
      es: 0.9,
    };
    utterance.rate = slow ? 0.35 : (defaultRateByLanguage[voiceLanguageKey] || 0.9);
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
