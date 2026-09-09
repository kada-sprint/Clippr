import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../features/auth/AuthProvider.jsx';
import './studio.css';

export default function StudioLayout() {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const accountRef = useRef(null);
  const accountButton = useRef(null);
  const sidebarButton = useRef(null);
  const sidebarRef = useRef(null);
  const closeButton = useRef(null);
  const navigate = useNavigate();

  function closeSidebar() {
    setSidebarOpen(false);
    setAccountOpen(false);
    requestAnimationFrame(() => sidebarButton.current?.focus());
  }

  useEffect(() => {
    function closeOnOutside(event) {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    }
    function handleKeyboard(event) {
      if (event.key === 'Escape') {
        if (accountOpen) { setAccountOpen(false); accountButton.current?.focus(); }
        else if (sidebarOpen) closeSidebar();
      }
      if (event.key === 'Tab' && sidebarOpen) {
        const elements = [...sidebarRef.current.querySelectorAll('a[href], button:not(:disabled)')].filter(element => element.getClientRects().length);
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', handleKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', handleKeyboard);
    };
  }, [accountOpen, sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(min-width: 761px)');
    function onDesktop() {
      if (media.matches) { setSidebarOpen(false); setAccountOpen(false); sidebarRef.current?.querySelector('a')?.focus(); }
    }
    media.addEventListener('change', onDesktop);
    return () => { document.body.style.overflow = previousOverflow; media.removeEventListener('change', onDesktop); };
  }, [sidebarOpen]);

  async function logout() {
    setLeaving(true);
    setError('');
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (failure) {
      setError(failure.message);
      setLeaving(false);
    }
  }

  return (
    <div className="studio-shell">
      <div inert={sidebarOpen ? true : undefined}>
        <a className="skip-link" href="#studio-content">Langsung ke konten</a>
        <div className="studio-mobile-controls">
          <button ref={sidebarButton} className="icon-button studio-menu-toggle" aria-label="Buka menu studio" aria-expanded={sidebarOpen} aria-controls="studio-sidebar" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
        </div>
      </div>
      {sidebarOpen && <div className="studio-backdrop" aria-hidden="true" onClick={closeSidebar} />}
      <aside ref={sidebarRef} className={`studio-sidebar ${sidebarOpen ? 'is-open' : ''}`} id="studio-sidebar" role={sidebarOpen ? 'dialog' : undefined} aria-modal={sidebarOpen ? true : undefined} aria-label="Menu studio">
        <div className="studio-sidebar-top">
          <Link className="brand studio-brand" to="/" aria-label="Clippr, beranda"><img src="/favicon.svg" alt="" width="29" height="29" />Clippr<span>.</span></Link>
          <button ref={closeButton} className="icon-button studio-sidebar-close" aria-label="Tutup menu studio" onClick={closeSidebar}><Icon name="close" /></button>
        </div>
        <nav aria-label="Navigasi studio">
          <NavLink to="/upload" end onClick={closeSidebar}><Icon name="upload" size={19} />Unggah Video</NavLink>
          <NavLink to="/queue" end onClick={closeSidebar}><Icon name="clock" size={19} />Status Antrean</NavLink>
          <NavLink to="/editor" end onClick={closeSidebar}><Icon name="edit" size={19} />Review & Editor</NavLink>
        </nav>
        <div className="studio-sidebar-note"><Icon name="layers" size={20} /><strong>Satu konsep, satu cuplikan.</strong><p>Jaga pengetahuan tetap utuh, dalam format yang mudah dibagikan.</p></div>
        <div className="studio-account" ref={accountRef}>
          <button ref={accountButton} className="studio-account-button" aria-label="Buka menu akun" aria-expanded={accountOpen} aria-controls="studio-account-panel" onClick={() => setAccountOpen(!accountOpen)}>
            <span className="studio-avatar"><Icon name="user" size={19} /></span>
            <span className="studio-account-identity"><strong>{user.displayName}</strong><small>{user.email}</small></span>
            <Icon name="chevron" size={15} />
          </button>
          {accountOpen && (
            <div className="studio-account-panel" id="studio-account-panel">
              <span className="eyebrow">AKUN ANDA</span>
              <strong>{user.displayName}</strong>
              <p>{user.email}</p>
              <Link to="/">Kembali ke beranda <Icon name="arrow" size={14} /></Link>
              <button onClick={logout} disabled={leaving}>{leaving ? 'Sedang keluar…' : 'Keluar dari akun'}</button>
              {error && <p className="studio-account-error" role="alert">{error}</p>}
            </div>
          )}
        </div>
      </aside>
      <main className="studio-content" id="studio-content" inert={sidebarOpen ? true : undefined}><Outlet /></main>
    </div>
  );
}
