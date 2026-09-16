const { randomUUID } = require('node:crypto');
const { getPrisma } = require('../config/prisma');
const { withProjectLock } = require('./project-lock');
const AppError = require('../utils/app-error');

const activeStatuses = ['pending', 'running'];

async function assertNoActiveJob(transaction, projectId) {
  if (await transaction.processingJob.findFirst({ where: { projectId, status: { in: activeStatuses } } })) {
    throw new AppError(409, 'PROJECT_BUSY', 'Proyek masih memiliki pekerjaan dalam antrean.');
  }
}

function create(transaction, projectId, clipId = null, checkpoint = null) {
  return transaction.processingJob.create({
    data: { projectId, clipId, checkpoint, kind: clipId ? 'render-clip' : 'pipeline' },
  });
}

function listUnfinished() {
  return getPrisma().processingJob.findMany({
    where: { status: { in: activeStatuses } },
    select: { id: true, projectId: true, clipId: true, kind: true, status: true, attemptToken: true },
    orderBy: { createdAt: 'asc' },
  });
}

async function withJob(id, action) {
  const target = await getPrisma().processingJob.findUnique({ where: { id }, include: { project: true } });
  if (!target) return null;
  return withProjectLock(target.projectId, target.project.userId, async (transaction) => {
    const job = await transaction.processingJob.findUnique({ where: { id }, include: { project: true, clip: true } });
    if (!job || job.project.status === 'deleting') return null;
    return action(transaction, job);
  });
}

function claim(id) {
  return withJob(id, async (transaction, job) => {
    if (job.status !== 'pending') return null;
    const attemptToken = randomUUID();
    const updated = await transaction.processingJob.update({ where: { id }, data: {
      status: 'running', attemptToken, attempts: { increment: 1 }, errorCode: null,
    } });
    return { ...job, ...updated };
  });
}

function guarded(id, token, action) {
  return withJob(id, async (transaction, job) => {
    if (job.status !== 'running' || job.attemptToken !== token) {
      throw new AppError(409, 'STALE_ATTEMPT', 'Percobaan job sudah tidak aktif.');
    }
    return action(transaction, job);
  }).then((result) => {
    if (result === null) throw new AppError(404, 'JOB_MISSING', 'Pekerjaan tidak tersedia.');
    return result;
  });
}

function fail(id, token, code, terminal) {
  return withJob(id, async (transaction, job) => {
    if (!activeStatuses.includes(job.status) || (token && job.attemptToken !== token)) return;
    await transaction.processingJob.update({ where: { id }, data: {
      status: terminal ? 'failed' : 'pending', attemptToken: null, errorCode: code,
    } });
    if (terminal) {
      if (job.clipId) {
        await transaction.clip.update({ where: { id: job.clipId }, data: { status: 'error' } });
      } else {
        await transaction.project.update({ where: { id: job.projectId }, data: { status: 'error' } });
        await transaction.clip.updateMany({ where: { projectId: job.projectId, status: 'rendering' }, data: { status: 'error' } });
      }
    }
  });
}

function retry(id) {
  return withJob(id, async (transaction, job) => {
    if (job.status !== 'failed') throw new AppError(409, 'JOB_NOT_FAILED', 'Hanya job gagal yang dapat diulang.');
    await assertNoActiveJob(transaction, job.projectId);
    if (!job.project.sourceVideoPath) throw new AppError(400, 'SOURCE_MISSING', 'Upload ulang sumber diperlukan.');
    if (job.clipId) {
      await transaction.clip.update({ where: { id: job.clipId }, data: { status: 'rendering' } });
    } else {
      await transaction.project.update({ where: { id: job.projectId }, data: { status: 'processing' } });
    }
    return create(transaction, job.projectId, job.clipId, job.checkpoint);
  });
}

module.exports = { activeStatuses, assertNoActiveJob, create, listUnfinished, claim, guarded, fail, retry };
