import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';

export default function RequireSession() {
  const { user, loading, sessionError, refreshSession } = useAuth();
  const location = useLocation();

  if (loading || sessionError) {
    return (
      <main className="container section">
        {loading ? <p role="status">Memeriksa sesi Anda…</p> : (
          <div className="section-heading" role="alert">
            <h1>Sesi belum dapat diperiksa</h1>
            <p>{sessionError}</p>
            <button className="button primary" onClick={refreshSession}>Coba lagi</button>
          </div>
        )}
      </main>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />;
}
