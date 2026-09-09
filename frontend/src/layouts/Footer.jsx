import Icon from '../components/Icon.jsx';

export default function Footer() {
  return <footer className="site-footer">
    <div className="container footer-main">
      <div className="footer-about"><a href="#beranda" className="brand"><img src="/favicon.svg" alt="" width="30" height="30" />Clippr<span>.</span></a><p>Ide besar, dalam cuplikan bermakna.<br />Hidupkan kembali pengetahuan dari webinar Anda menjadi pembelajaran yang mudah dibagikan.</p><span className="made-for">Dibuat untuk para pendidik Indonesia.</span></div>
      <div className="footer-links"><h3>Jelajahi Clippr</h3><a href="#konsep">Kelengkapan konsep</a><a href="#layout">Pilihan layout</a><a href="#fitur">Editor & subtitle</a><a href="#cara-kerja">Cara kerja</a></div>
      <div className="privacy-card" id="privasi"><h3><Icon name="shield" size={15} /> Privasi dalam setiap proses</h3><p>Kebijakan retensi Clippr membatasi penyimpanan media. Metadata proyek dan transkrip tetap tersimpan.</p><div className="retention-grid"><div><span>VIDEO SUMBER</span><strong>24 jam sejak upload</strong><small>Termasuk upload ulang berhasil</small></div><div><span>HASIL EKSPOR</span><strong>24 jam sejak render</strong><small>Berlaku untuk MP4 dan SRT</small></div></div></div>
    </div>
    <div className="container footer-bottom"><span><i className="status-dot" /> Dirancang untuk pembelajaran yang utuh</span><div><a href="#privasi">Kebijakan retensi</a><a href="#faq">Bantuan</a><span>© {new Date().getFullYear()} Clippr</span></div></div>
  </footer>;
}
