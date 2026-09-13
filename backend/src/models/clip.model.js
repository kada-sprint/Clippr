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

async function findManyByProjectId(projectId) {
  return getPrisma().clip.findMany({
    where: { projectId },
    orderBy: { conceptScore: 'desc' },
    select: clipSelect,
  });
}

module.exports = {
  findManyByProjectId,
};
