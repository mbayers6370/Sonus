import { API_BASE_URL } from './apiBase';
import { getAccessToken, getMockIdentity } from './authSession';

export async function apiFetch(path: string, init: RequestInit = {}) {
  const url = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${API_BASE_URL}${path}`;

  const headers = new Headers(init.headers || {});
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const mockIdentity = getMockIdentity();
  if (mockIdentity.userId && !headers.has('x-dev-user-id')) {
    headers.set('x-dev-user-id', mockIdentity.userId);
  }
  if (mockIdentity.email && !headers.has('x-dev-user-email')) {
    headers.set('x-dev-user-email', mockIdentity.email);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
