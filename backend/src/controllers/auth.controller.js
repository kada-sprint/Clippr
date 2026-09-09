const { SESSION_DURATION_MS } = require('../middlewares/session');

function createAuthController({ authenticateGoogle, getCurrentUser }) {
  return {
    async google(req, res) {
      const user = await authenticateGoogle(req.body?.credential);
      req.session = { userId: user.id, expiresAt: Date.now() + SESSION_DURATION_MS };
      res.json({ user });
    },
    async me(req, res) {
      try {
        const user = await getCurrentUser(req.userId);
        res.json({ user });
      } catch (error) {
        if (error.status === 401) req.session = null;
        throw error;
      }
    },
    logout(req, res) {
      req.session = null;
      res.status(204).end();
    },
  };
}

module.exports = { createAuthController };
