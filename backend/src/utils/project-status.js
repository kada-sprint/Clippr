function isProjectBusy(project) {
  return !['idle', 'error', 'deleting'].includes(project.status) ||
    (project.processingJobs || []).some((job) => ['pending', 'running'].includes(job.status)) ||
    (project.clips || []).some((clip) => ['rendering', 'processing'].includes(clip.status));
}

module.exports = { isProjectBusy };
