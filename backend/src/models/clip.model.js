const { getPrisma } = require('../config/prisma');

const clipSelect = {
  id: true,
  title: true,
  startTime: true,
  endTime: true,
  clipVideoPath: true,
  subtitledVideoPath: true,
  status: true,
};

const clipSelectDetail = {
  ...clipSelect,
  transcriptJson: true,
  subtitleStyle: true,
  conceptScore: true,
  pedagogicalReason: true,
};

async function findManyByProjectId(projectId) {
  return getPrisma().clip.findMany({
    where: { projectId },
    orderBy: { conceptScore: 'desc' },
    select: clipSelect,
  });
}

async function findByIdWithOwnership(clipId, userId) {
  return getPrisma().clip.findFirst({
    where: {
      id: clipId,
      project: { userId },
    },
    select: {
      ...clipSelectDetail,
      project: { select: { id: true, userId: true } },
    },
  });
}

async function findById(clipId) {
  return getPrisma().clip.findUnique({
    where: { id: clipId },
    select: clipSelectDetail,
  });
}

async function findTranscriptById(clipId) {
  return getPrisma().clip.findUnique({
    where: { id: clipId },
    select: { id: true, transcriptJson: true },
  });
}

async function updateById(clipId, data) {
  return getPrisma().clip.update({
    where: { id: clipId },
    data,
    select: clipSelectDetail,
  });
}

module.exports = {
  findManyByProjectId,
  findByIdWithOwnership,
  findById,
  findTranscriptById,
  updateById,
};
