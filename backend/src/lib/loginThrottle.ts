type LoginThrottleConfig = {
  enabled: boolean;
  threshold: number;
  baseDelayMs: number;
  maxDelayMs: number;
  resetAfterMs: number;
};

type LoginThrottleIdentity = {
  email: string;
  ip: string;
};

type AttemptState = {
  failures: number;
  blockedUntil: number;
  lastAttemptAt: number;
};

type LoginThrottleDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function clampRetrySeconds(ms: number) {
  return Math.max(1, Math.ceil(ms / 1000));
}

function computeBackoffMs(failures: number, config: LoginThrottleConfig) {
  if (failures < config.threshold) return 0;
  const exponent = failures - config.threshold;
  return Math.min(config.maxDelayMs, config.baseDelayMs * Math.pow(2, exponent));
}

export function createLoginThrottle(config: LoginThrottleConfig) {
  const buckets = new Map<string, AttemptState>();

  function keys(identity: LoginThrottleIdentity) {
    const email = identity.email.trim().toLowerCase();
    const ip = identity.ip || 'unknown';
    return {
      email: `email:${email}`,
      ip: `ip:${ip}`,
      combo: `combo:${email}|${ip}`,
    };
  }

  function readState(key: string, now: number) {
    const state = buckets.get(key);
    if (!state) return { failures: 0, blockedUntil: 0, lastAttemptAt: now };
    if (now - state.lastAttemptAt > config.resetAfterMs) {
      const reset = { failures: 0, blockedUntil: 0, lastAttemptAt: now };
      buckets.set(key, reset);
      return reset;
    }
    return state;
  }

  function upsertState(key: string, state: AttemptState) {
    buckets.set(key, state);
  }

  function clearKey(key: string) {
    buckets.delete(key);
  }

  function check(identity: LoginThrottleIdentity): LoginThrottleDecision {
    if (!config.enabled) return { allowed: true, retryAfterSeconds: 0 };

    const now = Date.now();
    const identityKeys = keys(identity);
    const states = [identityKeys.email, identityKeys.ip, identityKeys.combo].map((key) =>
      readState(key, now)
    );
    const blockedUntil = Math.max(...states.map((state) => state.blockedUntil));
    if (blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: clampRetrySeconds(blockedUntil - now),
      };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  function registerFailure(identity: LoginThrottleIdentity) {
    if (!config.enabled) return;

    const now = Date.now();
    const identityKeys = keys(identity);

    for (const key of [identityKeys.email, identityKeys.ip, identityKeys.combo]) {
      const current = readState(key, now);
      const failures = current.failures + 1;
      const backoffMs = computeBackoffMs(failures, config);
      upsertState(key, {
        failures,
        blockedUntil: backoffMs > 0 ? now + backoffMs : 0,
        lastAttemptAt: now,
      });
    }
  }

  function registerSuccess(identity: LoginThrottleIdentity) {
    if (!config.enabled) return;

    const identityKeys = keys(identity);
    clearKey(identityKeys.email);
    clearKey(identityKeys.combo);
  }

  return {
    check,
    registerFailure,
    registerSuccess,
  };
}
