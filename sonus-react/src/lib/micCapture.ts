type MicMediaDevices = Pick<MediaDevices, 'getUserMedia' | 'enumerateDevices'>;

export async function requestMicStreamWithFallback(params: {
  mediaDevices: MicMediaDevices;
  tunedConstraints: MediaStreamConstraints;
}): Promise<MediaStream> {
  const { mediaDevices, tunedConstraints } = params;
  try {
    return await mediaDevices.getUserMedia(tunedConstraints);
  } catch (firstError) {
    try {
      return await mediaDevices.getUserMedia({ audio: true });
    } catch {
      const devices = await mediaDevices
        .enumerateDevices()
        .then((rows) => rows.filter((row) => row.kind === 'audioinput' && row.deviceId))
        .catch(() => []);
      for (const device of devices) {
        try {
          return await mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: device.deviceId },
            },
          });
        } catch {
          // Keep trying other devices.
        }
      }
      throw firstError;
    }
  }
}
