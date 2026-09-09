import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.jsx";
import Icon from "../components/Icon.jsx";

export default function Navbar({ onStart }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading } = useAuth();
  return (
    <header className="site-header">
      <div className="container nav-inner">
        <a className="brand" href="#beranda" aria-label="Clippr, beranda">
          <img src="/favicon.svg" alt="" width="30" height="30" />
          Clippr<span>.</span>
        </a>
        <button
          className="menu-toggle icon-button"
          aria-label={menuOpen ? "Tutup navigasi" : "Buka navigasi"}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
        <nav
          id="main-navigation"
          className={menuOpen ? "nav-links open" : "nav-links"}
          aria-label="Navigasi utama"
        ></nav>
        <div className="nav-actions">
          {user ? <Link className="nav-user" to="/login"><Icon name="user" size={17} /><span>{user.displayName}</span></Link> : <button className="text-button" onClick={onStart} disabled={loading}>
            Masuk
          </button>}
          {!user && <button className="button primary small" onClick={onStart}>
            Mulai Buat Cuplikan <Icon name="arrow" size={14} />
          </button>}
        </div>
      </div>
    </header>
  );
}
