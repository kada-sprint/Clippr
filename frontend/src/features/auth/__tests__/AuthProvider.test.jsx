import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthProvider.jsx';

vi.mock('../auth.api.js', () => ({
  getSession: vi.fn(),
  loginWithGoogle: vi.fn(),
  logoutSession: vi.fn(),
}));

import { getSession, loginWithGoogle, logoutSession } from '../auth.api.js';

function TestConsumer() {
  const { user, loading, sessionError } = useAuth();
  if (loading) return <span role="status">loading</span>;
  if (sessionError) return <span role="alert">{sessionError}</span>;
  if (user) return <span>user:{user.displayName}</span>;
  return <span>logged-out</span>;
}

function renderAuth(ui) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches session on mount and shows user', async () => {
    getSession.mockResolvedValue({ user: { id: '1', displayName: 'Budi' } });
    renderAuth(<TestConsumer />);

    expect(screen.getByRole('status')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByText('user:Budi')).toBeInTheDocument());
  });

  it('shows logged-out when session returns 401', async () => {
    const error = new Error('unauthorized');
    error.status = 401;
    getSession.mockRejectedValue(error);
    renderAuth(<TestConsumer />);

    await waitFor(() => expect(screen.getByText('logged-out')).toBeInTheDocument());
  });

  it('shows error message when session fetch fails with network error', async () => {
    getSession.mockRejectedValue(new Error('Server down'));
    renderAuth(<TestConsumer />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server down'));
  });

  it('signIn calls loginWithGoogle then refreshes session', async () => {
    getSession
      .mockResolvedValueOnce({ user: null })
      .mockResolvedValueOnce({ user: { id: '1', displayName: 'Andi' } });
    loginWithGoogle.mockResolvedValue({ user: { id: '1', displayName: 'Andi' } });

    let signIn;
    function Capture() {
      const auth = useAuth();
      signIn = auth.signIn;
      return <TestConsumer />;
    }

    renderAuth(<Capture />);
    await waitFor(() => expect(screen.getByText('logged-out')).toBeInTheDocument());

    await signIn('google-token');
    expect(loginWithGoogle).toHaveBeenCalledWith('google-token');
    await waitFor(() => expect(screen.getByText('user:Andi')).toBeInTheDocument());
  });

  it('signOut clears user and calls logoutSession', async () => {
    getSession.mockResolvedValue({ user: { id: '1', displayName: 'Budi' } });
    logoutSession.mockResolvedValue();

    let signOut;
    function Capture() {
      const auth = useAuth();
      signOut = auth.signOut;
      return <TestConsumer />;
    }

    renderAuth(<Capture />);
    await waitFor(() => expect(screen.getByText('user:Budi')).toBeInTheDocument());

    await signOut();
    expect(logoutSession).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByText('logged-out')).toBeInTheDocument());
  });
});
