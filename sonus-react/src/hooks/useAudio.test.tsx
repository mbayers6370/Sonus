import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudio } from './useAudio';

type SpeakFn = (text: string, reading: string, slow?: boolean, languageHint?: string | null) => void;

class MockSpeechSynthesisUtterance {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice?: SpeechSynthesisVoice;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

function HookHarness({ onReady }: { onReady: (speak: SpeakFn) => void }) {
  const { speak } = useAudio();
  onReady(speak);
  return null;
}

describe('useAudio slow playback', () => {
  let container: HTMLDivElement;
  let root: Root;
  let speakMock: ReturnType<typeof vi.fn>;
  let cancelMock: ReturnType<typeof vi.fn>;
  let getVoicesMock: ReturnType<typeof vi.fn>;
  let previousActEnv: unknown;

  beforeEach(() => {
    previousActEnv = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    speakMock = vi.fn();
    cancelMock = vi.fn();
    getVoicesMock = vi.fn(() => [
      { name: 'Kyoko', lang: 'ja-JP', localService: true } as SpeechSynthesisVoice,
    ]);

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: cancelMock,
        getVoices: getVoicesMock,
        speak: speakMock,
        addEventListener: vi.fn(),
        onvoiceschanged: null,
      },
    });

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: MockSpeechSynthesisUtterance,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT = previousActEnv;
    vi.restoreAllMocks();
  });

  it('uses slowed rate and spaced CJK text for japanese slow playback', () => {
    let speak: SpeakFn | null = null;
    act(() => {
      root.render(<HookHarness onReady={(fn) => { speak = fn; }} />);
    });
    expect(speak).not.toBeNull();

    act(() => {
      speak!('百二', 'hyaku ni', true, 'ja');
    });

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0][0] as MockSpeechSynthesisUtterance;
    expect(utterance.text).toBe('百 二');
    expect(utterance.lang).toBe('ja-JP');
    expect(utterance.rate).toBe(0.35);
  });

  it('uses default japanese rate when slow playback is off', () => {
    let speak: SpeakFn | null = null;
    act(() => {
      root.render(<HookHarness onReady={(fn) => { speak = fn; }} />);
    });
    expect(speak).not.toBeNull();

    act(() => {
      speak!('百二', 'hyaku ni', false, 'ja');
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0][0] as MockSpeechSynthesisUtterance;
    expect(utterance.text).toBe('百二');
    expect(utterance.lang).toBe('ja-JP');
    expect(utterance.rate).toBe(0.8);
  });
});
