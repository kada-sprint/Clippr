import { useState } from 'react';
import Icon from '../../../components/Icon.jsx';

export default function VocabularyInput() {
  const [terms, setTerms] = useState([]);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');

  function addTerms(values) {
    const unique = [];
    for (const value of values) {
      const term = value.trim();
      if (!term) continue;
      if (![...terms, ...unique].some((item) => item.toLocaleLowerCase('id') === term.toLocaleLowerCase('id'))) unique.push(term);
    }
    if (terms.length + unique.length > 20) {
      setMessage('Maksimal 20 istilah. Hapus istilah yang tidak diperlukan sebelum menambahkan lagi.');
      return false;
    }
    if (!unique.length) setMessage('Istilah kosong atau sudah ada di kamus.');
    else { setTerms([...terms, ...unique]); setMessage(`${unique.length} istilah ditambahkan.`); }
    return true;
  }

  return (
    <section className="vocabulary-section" aria-labelledby="vocabulary-title">
      <div className="ingestion-section-title"><h2 id="vocabulary-title"><Icon name="edit" size={19} /> Kamus Istilah Teknis</h2><span className="vocabulary-count">{terms.length}/20 istilah terdaftar</span></div>
      <p className="ingestion-description" id="vocabulary-help">Tambahkan istilah khusus agar transkripsi mengenali materi Anda. Pisahkan dengan koma atau tekan Enter.</p>
      <div className="vocabulary-field">
        {terms.map((term) => <span className="vocabulary-chip" key={term}>{term}<button type="button" aria-label={`Hapus istilah ${term}`} onClick={() => { setTerms(terms.filter((item) => item !== term)); setMessage(`${term} dihapus.`); }}><Icon name="close" size={13} /></button></span>)}
        <input aria-label="Istilah teknis" aria-describedby="vocabulary-help vocabulary-message" value={input} placeholder={terms.length ? '+ Ketik istilah lalu tekan Enter…' : 'Contoh: PyTorch, Prompt Engineering…'} onChange={(event) => {
          const value = event.target.value;
          const pieces = value.split(/[,\n]/);
          if (pieces.length > 1) {
            const remaining = pieces.pop();
            if (addTerms(pieces)) setInput(remaining);
            else setInput(value);
          } else setInput(value);
        }} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (addTerms(input.split(/[,\n]/))) setInput('');
          }
        }} />
      </div>
      <p className="vocabulary-message" id="vocabulary-message" role="status">{message}</p>
    </section>
  );
}
