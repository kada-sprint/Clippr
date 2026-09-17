const { createProjectService } = require('../services/project.service');

/**
 * Controller untuk menangani HTTP request dan response terkait fitur proyek
 */
function createProjectController({
  projectService = createProjectService(),
} = {}) {
  return {
    async list(req, res, next) {
      try {
        const projects = await projectService.list(req.userId);
        res.json({ projects });
      } catch (error) {
        next(error);
      }
    },
    async create(req, res, next) {
      try {
        const project = await projectService.create(req.userId, req.body);
        res.status(201).json({ project });
      } catch (error) {
        next(error);
      }
    },
    async get(req, res, next) {
      try {
        const project = await projectService.get(req.userId, req.params.id);
        res.json({ project });
      } catch (error) {
        next(error);
      }
    },
    async update(req, res, next) {
      try {
        const project = await projectService.update(req.userId, req.params.id, req.body);
        res.json({ project });
      } catch (error) {
        next(error);
      }
    },
    async remove(req, res, next) {
      try {
        await projectService.remove(req.userId, req.params.id);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createProjectController };
