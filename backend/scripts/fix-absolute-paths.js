/**
 * One-time migration: convert absolute media paths in the database to relative paths.
 *
 * Usage:
 *   node scripts/fix-absolute-paths.js
 *
 * Reads MEDIA_ROOT from env (defaults to backend/). For each project/clip row that
 * has an absolute path starting with MEDIA_ROOT, strips the prefix to make it relative.
 * Rows that are already relative (no leading slash) are left untouched.
 */

const { getPrisma } = require('../src/config/prisma');
const env = require('../src/config/env');

function toRelative(absolutePath, root) {
  if (!absolutePath) return absolutePath;
  // Already relative (doesn't start with /)
  if (!absolutePath.startsWith('/')) return absolutePath;
  const normalizedRoot = root.endsWith('/') ? root : root + '/';
  if (absolutePath.startsWith(normalizedRoot)) {
    return absolutePath.slice(normalizedRoot.length);
  }
  // Path is outside MEDIA_ROOT — leave it and let the caller decide
  return absolutePath;
}

async function main() {
  const prisma = getPrisma();
  const root = env.mediaRoot.endsWith('/') ? env.mediaRoot : env.mediaRoot + '/';
  let updatedProjects = 0;
  let updatedClips = 0;

  // Fix projects.sourceVideoPath
  const projects = await prisma.project.findMany({
    where: { sourceVideoPath: { not: null } },
    select: { id: true, sourceVideoPath: true },
  });
  for (const project of projects) {
    const relative = toRelative(project.sourceVideoPath, root);
    if (relative !== project.sourceVideoPath) {
      await prisma.project.update({
        where: { id: project.id },
        data: { sourceVideoPath: relative },
      });
      updatedProjects++;
    }
  }

  // Fix clips.clipVideoPath, clips.subtendedVideoPath, clips.srtPath
  const clips = await prisma.clip.findMany({
    where: {
      OR: [
        { clipVideoPath: { not: null } },
        { subtitledVideoPath: { not: null } },
        { srtPath: { not: null } },
      ],
    },
    select: { id: true, clipVideoPath: true, subtitledVideoPath: true, srtPath: true },
  });
  for (const clip of clips) {
    const data = {};
    const newClipVideoPath = toRelative(clip.clipVideoPath, root);
    if (newClipVideoPath !== clip.clipVideoPath) data.clipVideoPath = newClipVideoPath;
    const newSubtitledVideoPath = toRelative(clip.subtitledVideoPath, root);
    if (newSubtitledVideoPath !== clip.subtitledVideoPath) data.subtitledVideoPath = newSubtitledVideoPath;
    const newSrtPath = toRelative(clip.srtPath, root);
    if (newSrtPath !== clip.srtPath) data.srtPath = newSrtPath;
    if (Object.keys(data).length > 0) {
      await prisma.clip.update({ where: { id: clip.id }, data });
      updatedClips++;
    }
  }

  console.log(`Migration complete: ${updatedProjects} projects, ${updatedClips} clips updated.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Migration failed:', error);
  await prisma?.$disconnect();
  process.exit(1);
});
