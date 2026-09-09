const paths = {
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  play: 'm9 5 11 7-11 7V5Z',
  upload: 'M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4',
  check: 'm5 12 4 4L19 6',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  globe: 'M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  video: 'M3 5h18v14H3V5Zm6 0v14M3 14h6',
  user: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21v-3a7 7 0 0 1 14 0v3',
  slide: 'M3 4h18v14H3V4Zm9 14v3m-4 0h8M7 9h10M7 13h6',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z',
  download: 'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
  close: 'm6 6 12 12M6 18 18 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  plus: 'M12 5v14M5 12h14',
  chevron: 'm6 9 6 6 6-6',
};

export default function Icon({ name, size = 18, className = '' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={paths[name] || paths.spark} /></svg>;
}
