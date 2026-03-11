import { describe, expect, it, vi } from 'vitest';
import { requestMicStreamWithFallback } from './micCapture';

function fakeStream(id: string) {
  return { id } as unknown as MediaStream;
}

describe('requestMicStreamWithFallback', () => {
  it('uses tuned constraints first when capture succeeds', async () => {
    const stream = fakeStream('tuned');
    const getUserMedia = vi.fn().mockResolvedValueOnce(stream);
    const enumerateDevices = vi.fn().mockResolvedValue([]);
    const tunedConstraints: MediaStreamConstraints = { audio: { echoCancellation: { ideal: true } } };

    const result = await requestMicStreamWithFallback({
      mediaDevices: { getUserMedia, enumerateDevices },
      tunedConstraints,
    });

    expect(result).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith(tunedConstraints);
    expect(enumerateDevices).not.toHaveBeenCalled();
  });

  it('falls back to plain audio when tuned constraints fail', async () => {
    const stream = fakeStream('plain');
    const firstError = new Error('constraint-failed');
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(firstError)
      .mockResolvedValueOnce(stream);
    const enumerateDevices = vi.fn().mockResolvedValue([]);
    const tunedConstraints: MediaStreamConstraints = { audio: { noiseSuppression: { ideal: true } } };

    const result = await requestMicStreamWithFallback({
      mediaDevices: { getUserMedia, enumerateDevices },
      tunedConstraints,
    });

    expect(result).toBe(stream);
    expect(getUserMedia).toHaveBeenNthCalledWith(1, tunedConstraints);
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: true });
    expect(enumerateDevices).not.toHaveBeenCalled();
  });

  it('probes individual input devices after tuned and plain capture fail', async () => {
    const stream = fakeStream('device-specific');
    const firstError = new Error('no-default-route');
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(new Error('plain-failed'))
      .mockResolvedValueOnce(stream);
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: 'audioinput', deviceId: 'mic-1' },
      { kind: 'audiooutput', deviceId: 'spk-1' },
    ]);
    const tunedConstraints: MediaStreamConstraints = { audio: { autoGainControl: { ideal: true } } };

    const result = await requestMicStreamWithFallback({
      mediaDevices: { getUserMedia, enumerateDevices },
      tunedConstraints,
    });

    expect(result).toBe(stream);
    expect(getUserMedia).toHaveBeenNthCalledWith(1, tunedConstraints);
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: true });
    expect(getUserMedia).toHaveBeenNthCalledWith(3, {
      audio: { deviceId: { exact: 'mic-1' } },
    });
    expect(enumerateDevices).toHaveBeenCalledTimes(1);
  });

  it('throws the original tuned-constraints error when all fallbacks fail', async () => {
    const firstError = new Error('tuned-failed');
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(new Error('plain-failed'))
      .mockRejectedValueOnce(new Error('mic-a-failed'))
      .mockRejectedValueOnce(new Error('mic-b-failed'));
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: 'audioinput', deviceId: 'mic-a' },
      { kind: 'audioinput', deviceId: 'mic-b' },
    ]);

    await expect(
      requestMicStreamWithFallback({
        mediaDevices: { getUserMedia, enumerateDevices },
        tunedConstraints: { audio: true },
      })
    ).rejects.toBe(firstError);
  });
});
