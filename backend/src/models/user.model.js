const { getPrisma } = require('../config/prisma');

async function upsertGoogleUser(profile) {
  const { id, ...data } = profile;
  return getPrisma().user.upsert({
    where: { id },
    create: profile,
    update: data,
    select: { id: true, email: true, displayName: true, avatarUrl: true },
  });
}

async function findUserById(id) {
  return getPrisma().user.findUnique({
    where: { id },
    select: { id: true, email: true, displayName: true, avatarUrl: true },
  });
}

module.exports = { upsertGoogleUser, findUserById };
