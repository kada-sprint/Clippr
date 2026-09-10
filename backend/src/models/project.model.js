const { getPrisma } = require('../config/prisma');

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

async function deleteIfEmpty(id, userId) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const project = await transaction.project.findFirst({
      where: { id, userId },
      select: projectSelect,
    });
    if (!project) return { state: 'missing' };
    if (!isEmpty(project)) return { state: 'not_empty' };
    await transaction.project.delete({ where: { id } });
    return { state: 'deleted' };
  });
}

module.exports = {
  listByUserId,
  createForUser,
  findByIdForUser,
  updateSetupIfEmpty,
  deleteIfEmpty,
};
