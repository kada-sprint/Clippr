import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../Navbar.jsx';

vi.mock('../../features/auth/AuthProvider.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../components/Icon.jsx', () => ({
  default: ({ name }) => <span data-testid={`icon-${name}`} />,
}));

import { useAuth } from '../../features/auth/AuthProvider.jsx';

function renderNavbar(props = {}) {
  return render(
    <MemoryRouter>
      <Navbar {...props} />
    </MemoryRouter>
  );
}

describe('Navbar', () => {
  it('renders brand name', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderNavbar();
    expect(screen.getByText('Clippr')).toBeInTheDocument();
  });

  it('shows login button when user is not authenticated', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderNavbar();
    expect(screen.getByText('Masuk')).toBeInTheDocument();
    expect(screen.getByText(/Mulai Buat Cuplikan/)).toBeInTheDocument();
  });

  it('shows user name when authenticated', () => {
    useAuth.mockReturnValue({
      user: { displayName: 'Budi', email: 'budi@example.com' },
      loading: false,
    });
    renderNavbar();
    expect(screen.getByText('Budi')).toBeInTheDocument();
    expect(screen.queryByText('Masuk')).not.toBeInTheDocument();
  });

  it('disables login button while loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    renderNavbar();
    expect(screen.getByText('Masuk')).toBeDisabled();
  });

  it('calls onStart when login button is clicked', async () => {
    const onStart = vi.fn();
    useAuth.mockReturnValue({ user: null, loading: false });
    renderNavbar({ onStart });
    screen.getByText('Masuk').click();
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('has accessible navigation toggle', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderNavbar();
    const toggle = screen.getByRole('button', { name: /navigasi/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
