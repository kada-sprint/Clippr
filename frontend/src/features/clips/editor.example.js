export const exampleClips = [
  { id: 1, title: 'Memahami konteks dalam prompting', start: 852.5, end: 899.5, subtitle: 'Konteks membantu model memahami tujuan dan menghasilkan jawaban yang lebih relevan.', topic: 'Konteks adalah kunci', terms: ['Instruksi', 'Konteks', 'Jawaban'] },
  { id: 2, title: 'Mengapa instruksi perlu spesifik?', start: 1390, end: 1444, subtitle: 'Instruksi yang spesifik memberi batasan yang jelas tentang hasil yang kita harapkan.', topic: 'Dari ide menjadi instruksi', terms: ['Tujuan', 'Batasan', 'Hasil'] },
  { id: 3, title: 'Evaluasi jawaban secara bertahap', start: 2295, end: 2337, subtitle: 'Periksa jawaban, temukan bagian yang kurang tepat, lalu perbaiki instruksi secara bertahap.', topic: 'Belajar melalui iterasi', terms: ['Periksa', 'Perbaiki', 'Ulangi'] },
];

export function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}
