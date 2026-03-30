const QUEUE_ROLE_NAME = 'Looking for 1v1';

async function getQueueRole(guild) {
  const fromCache = guild.roles.cache.find((role) => role.name === QUEUE_ROLE_NAME);
  if (fromCache) {
    return fromCache;
  }

  const roles = await guild.roles.fetch().catch(() => null);
  if (!roles) {
    return null;
  }

  return roles.find((role) => role && role.name === QUEUE_ROLE_NAME) || null;
}

async function ensureQueueRole(guild) {
  const existing = await getQueueRole(guild);
  if (existing) {
    return existing;
  }

  return guild.roles.create({
    name: QUEUE_ROLE_NAME,
    mentionable: false,
    reason: '1v1 queue role auto-created by bot',
  });
}

module.exports = {
  QUEUE_ROLE_NAME,
  getQueueRole,
  ensureQueueRole,
};
