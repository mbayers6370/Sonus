import { useCallback, useState } from 'react';
import { apiFetch } from '../../../lib/apiClient';
import { parseJsonOrThrow } from './supportConsoleDataUtils';
import {
  readSupportAdminToken,
  setSupportAdminToken,
} from './supportConsoleAccessUtils';

export function useSupportConsoleAuth(initialAdminUsername = '') {
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [adminUsername, setAdminUsername] = useState(initialAdminUsername);
  const [supportAdminUsername, setSupportAdminUsername] = useState<string | null>(null);

  const verifySupportAdminSession = useCallback(async () => {
    if (!readSupportAdminToken()) {
      setAuthenticated(false);
      setSupportAdminUsername(null);
      return false;
    }
    try {
      const payload = await parseJsonOrThrow<{ username?: string }>(
        await apiFetch('/v1/admin/auth/me', { cache: 'no-store' })
      );
      setAuthenticated(true);
      setSupportAdminUsername(payload.username || null);
      setAuthError(null);
      return true;
    } catch {
      setSupportAdminToken(null);
      setAuthenticated(false);
      setSupportAdminUsername(null);
      return false;
    }
  }, []);

  const attemptSignIn = useCallback(
    async (username: string, password: string) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const payload = await parseJsonOrThrow<{
          token?: string;
          username?: string;
        }>(
          await apiFetch('/v1/admin/auth/signin', {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          })
        );

        if (payload.token) {
          setSupportAdminToken(payload.token);
          setAuthenticated(true);
          setSupportAdminUsername(payload.username || username);
          return true;
        }
        return false;
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : 'Sign in failed. Check credentials.'
        );
        setAuthenticated(false);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  const signOut = useCallback(() => {
    setSupportAdminToken(null);
    setAuthenticated(false);
    setSupportAdminUsername(null);
    setAdminUsername('');
  }, []);

  return {
    authenticated,
    setAuthenticated,
    authError,
    setAuthError,
    authBusy,
    setAuthBusy,
    adminUsername,
    setAdminUsername,
    supportAdminUsername,
    setSupportAdminUsername,
    verifySupportAdminSession,
    attemptSignIn,
    signOut,
  };
}
