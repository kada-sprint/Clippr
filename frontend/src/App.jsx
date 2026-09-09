import { Link, Route, Routes } from 'react-router-dom';
import LandingPage from './features/landing/LandingPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import RequireSession from './features/auth/RequireSession.jsx';
import StudioLayout from './layouts/StudioLayout.jsx';
import UploadPage from './features/ingestion/UploadPage.jsx';
import QueuePage from './features/ingestion/QueuePage.jsx';
import EditorPage from './features/clips/EditorPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireSession />}>
        <Route element={<StudioLayout />}>
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/editor" element={<EditorPage />} />
        </Route>
      </Route>
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
