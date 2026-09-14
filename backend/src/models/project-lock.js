const { getPrisma } = require('../config/prisma');

// Upload admission, render admission and deletion must lock the same row first.
function withProjectLock(id, userId, action) {
  return getPrisma().$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM projects WHERE id = ${id}::uuid AND user_id = ${userId} FOR UPDATE`;
    return action(transaction);
  }, { timeout: 10000 });
}

module.exports = { withProjectLock };
