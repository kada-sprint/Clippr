import { useCallback, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Icon from "../../components/Icon.jsx";
import { useAuth } from "./AuthProvider.jsx";
import GoogleSignInButton from "./components/GoogleSignInButton.jsx";
import "./auth.css";

const loginErrors = {
  INVALID_GOOGLE_TOKEN:
    "Verifikasi Google tidak berhasil. Silakan pilih akun dan masuk kembali.",
  GOOGLE_UNAVAILABLE:
    "Google sedang tidak dapat dihubungi. Silakan coba beberapa saat lagi.",
  DATABASE_UNAVAILABLE:
    "Akun belum dapat disimpan. Silakan coba beberapa saat lagi.",
  DATABASE_NOT_CONFIGURED:
    "Layanan akun belum tersedia. Silakan hubungi pengelola Clippr.",
  SESSION_NOT_CONFIGURED:
    "Layanan login belum siap. Silakan hubungi pengelola Clippr.",
  ORIGIN_NOT_ALLOWED:
    "Alamat aplikasi ini belum diizinkan untuk login. Gunakan alamat yang dikonfigurasi pengelola.",
  UNAUTHENTICATED:
    "Sesi belum tersimpan. Pastikan cookie diizinkan, lalu masuk kembali.",
};

export default function LoginPage() {
  const { user, loading, sessionError, refreshSession, signIn } =
    useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const navigate = useNavigate();
  const localIp = window.location.hostname === "127.0.0.1";

  const handleCredential = useCallback(
    async (credential) => {
      if (pending.current) return;
      if (!credential)
        return setError(
          "Google belum mengirimkan identitas akun. Silakan coba lagi.",
        );
      pending.current = true;
      setSubmitting(true);
      setError("");
      try {
        await signIn(credential);
        navigate("/upload", { replace: true });
      } catch (failure) {
        setError(loginErrors[failure.code] || failure.message);
      } finally {
        pending.current = false;
        setSubmitting(false);
      }
    },
    [navigate, signIn],
  );

  if (!loading && !sessionError && user) return <Navigate to="/upload" replace />;

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Link to="/" className="brand auth-brand" aria-label="Clippr, beranda">
          <img src="/favicon.svg" alt="" width="34" height="34" />
          Clippr<span>.</span>
        </Link>
        <div className="auth-grid">
          <section className="auth-story">
            <span className="pill">
              <Icon name="spark" size={14} /> RUANG UNTUK IDE YANG BERMAKNA
            </span>
            <h1>
              Pengetahuan Anda.
              <br />
              Jangkauan <span>lebih jauh.</span>
            </h1>
            <p>
              Hidupkan kembali rekaman webinar menjadi cuplikan edukatif.
              Singkat untuk ditonton, utuh untuk dipahami.
            </p>
            <div className="auth-illustration" aria-hidden="true">
              <div className="auth-source">
                <span>WEBINAR ANDA</span>
                <Icon name="video" size={34} />
                <div className="auth-wave">
                  {[
                    13, 25, 18, 35, 23, 42, 29, 18, 33, 24, 14, 29, 38, 18, 25,
                    13,
                  ].map((height, index) => (
                    <i key={index} style={{ height }} />
                  ))}
                </div>
              </div>
              <span className="auth-transform">
                <Icon name="spark" size={22} />
              </span>
              <div className="auth-clips">
                {["Pembuka", "Penjelasan", "Kesimpulan"].map((title, index) => (
                  <div key={title}>
                    <span>0{index + 1}</span>
                    <Icon name={["play", "layers", "check"][index]} size={22} />
                    <small>{title}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="auth-benefits">
              <span>
                <Icon name="check" size={14} /> Konsep tetap utuh
              </span>
              <span>
                <Icon name="check" size={14} /> Subtitle Indonesia
              </span>
              <span>
                <Icon name="check" size={14} /> Format vertikal
              </span>
            </div>
          </section>
          <section className="auth-card" aria-labelledby="login-title">
            <img className="auth-card-logo" src="/favicon.svg" alt="Logo Clippr" width="54" height="54" />
            <span className="eyebrow">SELAMAT DATANG DI CLIPPR</span>
            <h2 id="login-title">
              Mulai dari sini.
            </h2>
            <p className="auth-intro">
              Masuk atau daftar dengan akun Google untuk memulai perjalanan konten Anda.
            </p>
            {localIp ? (
              <div className="auth-origin">
                <p>Untuk login Google lokal, gunakan alamat localhost.</p>
                <a
                  className="button primary full"
                  href={`http://localhost:${window.location.port || "5173"}/login`}
                >
                  Buka login di localhost <Icon name="arrow" size={15} />
                </a>
              </div>
            ) : loading ? (
              <p className="auth-status" role="status">
                Memeriksa sesi Anda…
              </p>
            ) : (
              <>
                <GoogleSignInButton
                  onCredential={handleCredential}
                  disabled={submitting}
                />
                {submitting && (
                  <p className="auth-status" role="status">
                    Memverifikasi akun dan menyiapkan sesi Anda…
                  </p>
                )}
                {sessionError && !error && (
                  <div className="auth-error" role="alert">
                    <p>{sessionError}</p>
                    <button className="text-button" onClick={refreshSession}>
                      Periksa koneksi lagi
                    </button>
                  </div>
                )}
                <div className="auth-divider">
                  <span>SATU AKUN, SEMUA PENGETAHUAN ANDA</span>
                </div>
                <div className="auth-security">
                  <Icon name="shield" size={20} />
                  <p>
                    Kata sandi Google tetap bersama Google. Clippr hanya
                    menerima identitas akun yang Anda izinkan.
                  </p>
                </div>
                <p className="auth-registration">
                  Belum punya akun Clippr?
                  <br />
                  <strong>Akun dibuat otomatis saat pertama kali masuk.</strong>
                </p>
              </>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
        <div className="auth-bottom">
          <Link to="/">
            <Icon name="arrow" size={14} /> Kembali ke beranda
          </Link>
          <span>
            © {new Date().getFullYear()} Clippr · Ide besar, cuplikan bermakna.
          </span>
        </div>
      </div>
    </main>
  );
}
