const { getPrisma } = require('../config/prisma');
const { withProjectLock } = require('./project-lock');
const { isProjectBusy } = require('../utils/project-status');

const projectSelect = {
  id: true,
  userId: true,
  sourceVideoPath: true,
  selectedLayout: true,
  customVocabulary: true,
  status: true,
  processingStage: true,
  transcriptJson: true,
  lastEditActivityAt: true,
  sourceExpiresAt: true,
  createdAt: true,
  _count: { select: { clips: true } },
  clips: { select: { status: true } },
};

async function listByUserId(userId) {
  return getPrisma().project.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: projectSelect,
  });
}

async function createForUser(userId) {
  return getPrisma().project.create({
    data: { userId, status: 'idle', processingStage: null },
    select: projectSelect,
  });
}

async function findByIdForUser(id, userId) {
  return getPrisma().project.findFirst({
    where: { id, userId },
    select: projectSelect,
  });
}

function isEmpty(project) {
  return project.status === 'idle' &&
    project.processingStage === null &&
    project.sourceVideoPath === null &&
    project.transcriptJson === null &&
    project._count.clips === 0;
}

async function updateSetupIfEmpty(id, userId, data) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const project = await transaction.project.findFirst({
      where: { id, userId },
      select: projectSelect,
    });
    if (!project) return { state: 'missing' };
    if (!isEmpty(project)) return { state: 'not_editable' };
    const updated = await transaction.project.update({
      where: { id },
      data,
      select: projectSelect,
    });
    return { state: 'updated', project: updated };
  });
}

async function deleteIfInactive(id, userId, removeMedia) {
  // Persist the intent before touching disk. If cleanup times out or the process
  // exits, upload/render still reject this project and DELETE can resume safely.
  const admission = await withProjectLock(id, userId, async (transaction) => {
    const project = await transaction.project.findFirst({ where: { id, userId }, select: projectSelect });
    if (!project) return { state: 'missing' };
    if (isProjectBusy(project)) return { state: 'busy' };
    await transaction.project.update({ where: { id }, data: { status: 'deleting', processingStage: null } });
    return { state: 'admitted' };
  });
  if (admission.state !== 'admitted') return admission;
  return withProjectLock(id, userId, async (transaction) => {
    const project = await transaction.project.findFirst({
      where: { id, userId },
      select: {
        ...projectSelect,
        clips: { select: { id: true, status: true, clipVideoPath: true, subtitledVideoPath: true, srtPath: true } },
      },
    });
    if (!project) return { state: 'missing' };
    if (isProjectBusy(project)) return { state: 'busy' };
    await removeMedia(project);
    await transaction.clip.deleteMany({ where: { projectId: id } });
    await transaction.llmCall.deleteMany({ where: { projectId: id } });
    await transaction.project.delete({ where: { id } });
    return { state: 'deleted' };
  });
}

async function updateLastEditActivity(projectId) {
  return getPrisma().project.update({
    where: { id: projectId },
    data: { lastEditActivityAt: new Date() },
    select: { id: true, lastEditActivityAt: true },
  });
}

module.exports = {
  listByUserId,
  createForUser,
  findByIdForUser,
  updateSetupIfEmpty,
  deleteIfInactive,
  updateLastEditActivity,
};
