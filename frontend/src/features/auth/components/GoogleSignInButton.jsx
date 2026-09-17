import { useEffect, useRef, useState } from 'react';

let sdkPromise;

function loadGoogleSdk() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client?hl=id';
    script.async = true;
    const timeout = setTimeout(() => fail(), 15000);
    function fail() {
      clearTimeout(timeout);
      script.remove();
      sdkPromise = undefined;
      reject(new Error('Google belum dapat dimuat. Periksa koneksi atau pemblokir konten, lalu coba lagi.'));
    }
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timeout);
      if (!window.google?.accounts?.id) return fail();
      resolve(window.google.accounts.id);
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export default function GoogleSignInButton({ onCredential, disabled }) {
  const buttonRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    let active = true;
    let resizeObserver;
    setReady(false);
    setError('');
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
      setError('Login Google belum dikonfigurasi. Silakan hubungi pengelola Clippr.');
      return;
    }
    loadGoogleSdk().then((google) => {
      if (!active) return;
      google.initialize({ client_id: clientId, auto_select: false, ux_mode: 'popup', callback: (response) => {
        if (active) onCredential(response.credential);
      } });
      let renderedWidth = 0;
      const renderButton = () => {
        if (!active) return;
        const width = Math.floor(Math.min(360, buttonRef.current.clientWidth));
        if (!width || width === renderedWidth) return;
        renderedWidth = width;
        buttonRef.current.replaceChildren();
        google.renderButton(buttonRef.current, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
          text: 'continue_with', locale: 'id', width,
        });
      };
      renderButton();
      resizeObserver = new ResizeObserver(renderButton);
      resizeObserver.observe(buttonRef.current);
      setReady(true);
    }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; resizeObserver?.disconnect(); };
  }, [attempt, clientId, onCredential]);

  return <div className="google-sign-in">
    {!ready && !error && <p className="auth-status" role="status">Memuat Google Sign-In…</p>}
    <div className="google-button-slot" ref={buttonRef} inert={disabled ? true : undefined} aria-busy={disabled} />
    {error && <div className="auth-error" role="alert"><p>{error}</p><button className="text-button" onClick={() => setAttempt(attempt + 1)}>Coba lagi</button></div>}
  </div>;
}
