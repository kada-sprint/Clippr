const { getPrisma } = require('../config/prisma');

async function listExpired(now) {
  const prisma = getPrisma();

  const projects = await prisma.project.findMany({
    where: {
      sourceExpiresAt: { lte: now },
      sourceVideoPath: { not: null },
    },
    select: {
      id: true,
      sourceVideoPath: true,
      sourceExpiresAt: true,
    },
  });

  const clips = await prisma.clip.findMany({
    where: {
      exportExpiresAt: { lte: now },
      OR: [
        { clipVideoPath: { not: null } },
        { subtitledVideoPath: { not: null } },
        { srtPath: { not: null } },
      ],
    },
    select: {
      id: true,
      projectId: true,
      clipVideoPath: true,
      subtitledVideoPath: true,
      srtPath: true,
      exportExpiresAt: true,
    },
  });

  const results = [];

  for (const project of projects) {
    results.push({
      id: project.id,
      kind: 'source',
      path: project.sourceVideoPath,
      expiresAt: project.sourceExpiresAt,
    });
  }

  for (const clip of clips) {
    if (clip.clipVideoPath) {
      results.push({
        id: clip.id,
        kind: 'mp4',
        path: clip.clipVideoPath,
        expiresAt: clip.exportExpiresAt,
        projectId: clip.projectId,
      });
    }
    if (clip.subtitledVideoPath) {
      results.push({
        id: clip.id,
        kind: 'mp4',
        path: clip.subtitledVideoPath,
        expiresAt: clip.exportExpiresAt,
        projectId: clip.projectId,
      });
    }
    if (clip.srtPath) {
      results.push({
        id: clip.id,
        kind: 'srt',
        path: clip.srtPath,
        expiresAt: clip.exportExpiresAt,
        projectId: clip.projectId,
      });
    }
  }

  return results;
}

async function withCleanupClaim(candidate, now, callback) {
  const prisma = getPrisma();
  const projectId = candidate.projectId || candidate.id;

  return prisma.$transaction(async (transaction) => {
    // Lock the project row to prevent concurrent operations
    await transaction.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;

    // Check for active jobs — defer if any are running
    const activeJob = await transaction.processingJob.findFirst({
      where: { projectId, status: { in: ['pending', 'running'] } },
      select: { id: true },
    });
    if (activeJob) return;

    // Fresh snapshot inside the lock
    let media = null;
    let clearPath = null;

    if (candidate.kind === 'source') {
      const project = await transaction.project.findUnique({
        where: { id: candidate.id },
        select: { id: true, sourceVideoPath: true, sourceExpiresAt: true },
      });
      if (!project || !project.sourceVideoPath || !project.sourceExpiresAt || project.sourceExpiresAt > now) return;
      media = { id: project.id, kind: 'source', path: project.sourceVideoPath, expiresAt: project.sourceExpiresAt };
      clearPath = async () => {
        await transaction.processingJob.deleteMany({ where: { projectId: project.id } });
        await transaction.clip.deleteMany({ where: { projectId: project.id } });
        await transaction.llmCall.deleteMany({ where: { projectId: project.id } });
        await transaction.project.delete({ where: { id: project.id } });
      };
    } else {
      const clip = await transaction.clip.findUnique({
        where: { id: candidate.id },
        select: { id: true, projectId: true, clipVideoPath: true, subtitledVideoPath: true, srtPath: true, exportExpiresAt: true },
      });
      if (!clip || !clip.exportExpiresAt || clip.exportExpiresAt > now) return;

      const pathField = candidate.kind === 'srt' ? 'srtPath'
        : candidate.path === clip.subtitledVideoPath ? 'subtitledVideoPath'
        : 'clipVideoPath';
      const currentPath = clip[pathField];
      if (!currentPath) return;

      media = { id: clip.id, kind: candidate.kind, path: currentPath, expiresAt: clip.exportExpiresAt };
      clearPath = async () => {
        await transaction.clip.update({
          where: { id: clip.id },
          data: { [pathField]: null },
        });
      };
    }

    await callback({ media, clearPath });
  }, { timeout: 10000 });
}

module.exports = { listExpired, withCleanupClaim };
