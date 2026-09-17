import { apiRequest } from '../../lib/api.js';

export const getSession = (signal) => apiRequest('/auth/me', { signal });
export const loginWithGoogle = (credential) => apiRequest('/auth/google', {
  method: 'POST', body: JSON.stringify({ credential }),
});
export const logoutSession = () => apiRequest('/auth/logout', { method: 'POST', body: '{}' });
