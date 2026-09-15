const INVALID_CHARS_RE = /[\/\\:*?"<>|&]/g;

function sanitizeTitle(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(INVALID_CHARS_RE, '')
    .slice(0, 50);
}

function buildExportBasename(clip, projectName) {
  let base = sanitizeTitle(clip.title);
  if (!base) {
    const shortId = (clip.id || '').slice(0, 6);
    base = projectName
      ? `${sanitizeTitle(projectName)}-clip-${shortId}`
      : `clip-${shortId}`;
  } else if (clip._duplicate) {
    base = `${base}-${(clip.id || '').slice(0, 6)}`;
  }
  return base;
}

module.exports = { buildExportBasename, sanitizeTitle };
