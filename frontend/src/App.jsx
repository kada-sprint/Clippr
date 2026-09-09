import { Link, Route, Routes } from 'react-router-dom';
import LandingPage from './features/landing/LandingPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={
        <main className="container section">
          <div className="section-heading">
            <span className="eyebrow">404</span>
            <h1>Halaman tidak ditemukan</h1>
            <p>Alamat yang Anda buka belum tersedia di Clippr.</p>
          </div>
          <Link className="button primary" to="/">Kembali ke Beranda</Link>
        </main>
      } />
    </Routes>
  );
}
