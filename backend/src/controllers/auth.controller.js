function createAuthController(authenticateGoogle) {
  return async function google(req, res) {
    const user = await authenticateGoogle(req.body?.credential);
    res.set('Cache-Control', 'no-store').json({ user });
  };
}

module.exports = { createAuthController };
