const leaderboardRowsNode = document.getElementById("leaderboardRows");
const topThreeNode = document.getElementById("leaderTopThree");
const leaderboardStatusNode = document.getElementById("leaderboardStatus");

const LEADERBOARD_TOP_PLAYER = "20SovietSO21";
const LEADERBOARD_CONFIG_ENDPOINT = "/api/leaderboard-config";

function clampLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(1, Math.min(10, Math.round(numeric)));
}

function getLevelBadgePath(level) {
  const safeLevel = clampLevel(level);
  return `levelspng/${safeLevel}.png`;
}

function getLeaderboardStats(playerName) {
  const normalized = String(playerName || "").toLowerCase();
  if (normalized === LEADERBOARD_TOP_PLAYER.toLowerCase()) {
    return {
      level: 10,
      kd: 4.0
    };
  }

  const seed = [...String(playerName || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const level = clampLevel((seed % 10) + 1);
  const kd = Number((((seed % 25) + 14) / 10).toFixed(1));

  return { level, kd };
}

function normalizeFactionOverride(value) {
  if (value == null) {
    return "";
  }

  if (typeof sanitizeFactionValue === "function") {
    const sanitized = sanitizeFactionValue(value);
    return sanitized === "N/A" ? "" : sanitized;
  }

  const normalized = String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!normalized || normalized === "N/A") {
    return "";
  }

  const tokens = normalized
    .split(/[\/,&|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!tokens.length) {
    return "";
  }

  return [...new Set(tokens)].join("/");
}

function normalizeDeviceValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pc" || normalized === "desktop") {
    return "PC";
  }

  if (normalized === "mobile" || normalized === "phone" || normalized === "tablet") {
    return "Mobile";
  }

  if (normalized === "controller" || normalized === "console" || normalized === "gamepad") {
    return "Controller";
  }

  return "Unknown";
}

function normalizePlayerClassValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "engineer") {
    return "Engineer";
  }

  if (normalized === "officer") {
    return "Officer";
  }

  if (normalized === "recon") {
    return "Recon";
  }

  if (normalized === "rifleman") {
    return "Rifleman";
  }

  if (normalized === "skirmisher") {
    return "Skirmisher";
  }

  return "Unknown";
}

function getClassIconMarkup(playerClass, iconClass = "leader-class-icon") {
  const classLabel = normalizePlayerClassValue(playerClass);
  if (typeof getClassIconPath !== "function") {
    return "";
  }

  const iconPath = getClassIconPath(classLabel);
  if (!iconPath) {
    return "";
  }

  return `<img class="${iconClass}" src="${iconPath}" alt="" loading="lazy" aria-hidden="true">`;
}

function getDeviceIconMarkup(device, iconClass = "leader-device-icon") {
  if (typeof getDeviceIconSvg === "function") {
    return getDeviceIconSvg(device, iconClass);
  }

  return "";
}

function normalizeDiscordId(value) {
  const normalized = String(value || "").trim().replace(/[<@!>]/g, "");
  if (/^\d{8,}$/.test(normalized)) {
    return normalized;
  }

  return "";
}

function normalizeOptionalUserId(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return /^\d{3,}$/.test(normalized) ? normalized : "";
}

function normalizeConfigPlayers(config) {
  const raw = config?.players;
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const output = {};
  Object.entries(raw).forEach(([nameKey, stats]) => {
    const key = String(nameKey || "").trim().toLowerCase();
    if (!key) {
      return;
    }

    output[key] = {
      faction: normalizeFactionOverride(stats?.faction),
      class: normalizePlayerClassValue(stats?.class),
      level: clampLevel(stats?.level),
      kd: Number(clampKd(stats?.kd).toFixed(1)),
      device: normalizeDeviceValue(stats?.device)
    };
  });

  return output;
}

function normalizeExtraPlayers(config) {
  const raw = config?.extraPlayers;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .slice(0, 120)
    .map((entry, index) => {
      const item = entry && typeof entry === "object" ? entry : {};
      const name = String(item.name || item.playerName || "").trim();
      if (!name) {
        return null;
      }

      return {
        id: String(item.id || `extra-player-${index}`).trim(),
        name,
        faction: normalizeFactionOverride(item.faction || "N/A") || "N/A",
        class: normalizePlayerClassValue(item.class),
        country: String(item.country || "N/A").trim() || "N/A",
        discordId: normalizeDiscordId(item.discordId),
        userId: normalizeOptionalUserId(item.userId),
        device: normalizeDeviceValue(item.device)
      };
    })
    .filter(Boolean);
}

function normalizeConfigOrder(config, validKeys) {
  const keys = Array.isArray(validKeys) ? validKeys : [];
  const valid = new Set(keys);
  const seen = new Set();
  const ordered = [];

  if (Array.isArray(config?.order)) {
    config.order.forEach((rawKey) => {
      const key = String(rawKey || "").trim().toLowerCase();
      if (!key || !valid.has(key) || seen.has(key)) {
        return;
      }

      seen.add(key);
      ordered.push(key);
    });
  }

  return ordered;
}

function clampKd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1.0;
  }

  return Math.max(0, Math.min(9.9, numeric));
}

async function fetchRemoteConfig() {
  try {
    const response = await fetch(LEADERBOARD_CONFIG_ENDPOINT, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!payload?.ok || !payload?.config || typeof payload.config !== "object") {
      return null;
    }

    return payload.config;
  } catch {
    return null;
  }
}

function getResolvedAvatar(player, avatarMap) {
  return (
    avatarMap.get(Number(player.userId)) ||
    getStaticAvatarUrl(player.userId) ||
    getFallbackAvatarUrl(player.name)
  );
}

function buildTopThreeCard(player, rank, avatarMap) {
  const card = document.createElement("article");
  card.className = `podium-card rank-${rank}`;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open Player ${player.name}`);

  const avatarUrl = getResolvedAvatar(player, avatarMap);
  const fallbackAvatar = getFallbackAvatarUrl(player.name);
  const levelBadgeUrl = getLevelBadgePath(player.level);
  const classLabel = normalizePlayerClassValue(player.playerClass);
  const deviceLabel = normalizeDeviceValue(player.device);
  const classIconMarkup = getClassIconMarkup(classLabel, "podium-class-icon");
  const deviceIconMarkup = getDeviceIconMarkup(deviceLabel, "podium-device-icon");
  const factionMarkup = buildFactionChipHtml(player.faction, {
    chipClass: "leader-faction-chip",
    maxItems: 1,
    includeGroupWrapper: true,
    groupClass: "leader-faction-group"
  });

  card.innerHTML = `
    <span class="podium-rank">#${rank}</span>
    <img class="podium-avatar" src="${avatarUrl}" alt="${player.name} Roblox avatar" loading="lazy" referrerpolicy="no-referrer">
    <div class="podium-body">
      <h2 class="podium-title">${player.name}</h2>
      ${factionMarkup}
      <div class="podium-meta">
        <span class="podium-stat">${countryToFlag(player.country)} ${player.country}</span>
        <span class="podium-stat podium-detail-chip">${classIconMarkup}<span>${classLabel}</span></span>
        <span class="podium-stat podium-detail-chip">${deviceIconMarkup}<span>${deviceLabel}</span></span>
        <span class="podium-stat">K/D ${Number(player.kd).toFixed(1)}</span>
        <span class="podium-stat podium-level"><img class="level-badge" src="${levelBadgeUrl}" alt="Level ${player.level}" loading="lazy">Level ${player.level}</span>
      </div>
    </div>
  `;

  const avatarNode = card.querySelector(".podium-avatar");
  const levelNode = card.querySelector(".level-badge");
  avatarNode.addEventListener("error", () => {
    avatarNode.src = fallbackAvatar;
  });
  levelNode.addEventListener("error", () => {
    levelNode.style.display = "none";
  });

  card.addEventListener("click", () => openModal(player));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openModal(player);
    }
  });

  return card;
}

function buildLeaderboardRow(player, rank, avatarMap) {
  const row = document.createElement("article");
  row.className = "leaderboard-row";
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-label", `Open Player ${player.name}`);

  const avatarUrl = getResolvedAvatar(player, avatarMap);
  const fallbackAvatar = getFallbackAvatarUrl(player.name);
  const levelBadgeUrl = getLevelBadgePath(player.level);
  const classLabel = normalizePlayerClassValue(player.playerClass);
  const deviceLabel = normalizeDeviceValue(player.device);
  const classIconMarkup = getClassIconMarkup(classLabel, "leader-class-icon");
  const deviceIconMarkup = getDeviceIconMarkup(deviceLabel, "leader-device-icon");

  const factionMarkup = buildFactionChipHtml(player.faction, {
    chipClass: "leader-faction-chip",
    maxItems: 2,
    includeGroupWrapper: true,
    groupClass: "leader-faction-group"
  });

  row.innerHTML = `
    <span class="leader-rank rank-${rank <= 3 ? rank : 0}">#${rank}</span>
    <div class="leader-row-main">
      <span class="leader-player">
        <img class="leader-avatar" src="${avatarUrl}" alt="${player.name} Roblox avatar" loading="lazy" referrerpolicy="no-referrer">
        <span>
          <strong class="leader-name">${player.name}</strong>
          <small class="leader-discord">Discord ${player.discordId}</small>
        </span>
      </span>
      <div class="leader-row-meta">
        <span class="leader-detail-chip">${classIconMarkup}<span>${classLabel}</span></span>
        <span class="leader-detail-chip">${deviceIconMarkup}<span>${deviceLabel}</span></span>
        <span class="leader-detail-chip leader-mobile-only">${countryToFlag(player.country)} ${player.country}</span>
        <span class="leader-detail-chip leader-mobile-only">Faction ${splitFactionTokens(player.faction).join("/")}</span>
        <span class="leader-detail-chip leader-mobile-only">K/D ${Number(player.kd).toFixed(1)}</span>
        <span class="leader-detail-chip leader-mobile-only">Level ${player.level}</span>
      </div>
    </div>
    <span class="leader-faction">${factionMarkup}</span>
    <span class="leader-country">${countryToFlag(player.country)} ${player.country}</span>
    <strong class="leader-kd">${Number(player.kd).toFixed(1)}</strong>
    <span class="leader-level"><img class="level-badge" src="${levelBadgeUrl}" alt="Level ${player.level}" loading="lazy"><strong>${player.level}</strong></span>
  `;

  const avatarNode = row.querySelector(".leader-avatar");
  const levelNode = row.querySelector(".level-badge");
  avatarNode.addEventListener("error", () => {
    avatarNode.src = fallbackAvatar;
  });
  levelNode.addEventListener("error", () => {
    levelNode.style.display = "none";
  });

  row.addEventListener("click", () => openModal(player));
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openModal(player);
    }
  });

  return row;
}

function renderLeaderboard(players, avatarMap, options = {}) {
  const {
    syncLabel = "",
    hasManualOrder = false
  } = options;

  topThreeNode.innerHTML = "";
  leaderboardRowsNode.innerHTML = "";

  const topThree = players.slice(0, 3);
  topThree.forEach((player, index) => {
    topThreeNode.append(buildTopThreeCard(player, index + 1, avatarMap));
  });

  players.forEach((player, index) => {
    leaderboardRowsNode.append(buildLeaderboardRow(player, index + 1, avatarMap));
  });

  const modeLabel = hasManualOrder
    ? "Players ranked by Admin custom order."
    : "Players ranked by Level only (K/D does not affect placement).";
  leaderboardStatusNode.textContent = `${players.length} ${modeLabel}${syncLabel}`;
}

async function initLeaderboardPage() {
  if (!leaderboardRowsNode || !topThreeNode || !leaderboardStatusNode) {
    return;
  }

  const lines = await loadPlayerLines();
  const remoteConfig = await fetchRemoteConfig();
  const syncedPlayers = normalizeConfigPlayers(remoteConfig);
  const syncedExtraPlayers = normalizeExtraPlayers(remoteConfig);

  const playersFromLines = lines
    .map(parsePlayerLine)
    .filter(Boolean);

  const seenKeys = new Set(playersFromLines.map((player) => String(player.name || "").trim().toLowerCase()));
  syncedExtraPlayers.forEach((entry) => {
    const key = String(entry.name || "").trim().toLowerCase();
    if (!key || seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    const resolvedUserId = Number(entry.userId || fallbackAvatarId);
    playersFromLines.push({
      name: entry.name,
      faction: entry.faction,
      playerClass: normalizePlayerClassValue(entry.class),
      country: entry.country,
      discordId: entry.discordId,
      userId: Number.isFinite(resolvedUserId) ? resolvedUserId : fallbackAvatarId,
      avatarUrl: "",
      bodyAvatarUrl: "",
      level: 1,
      kd: 0,
      device: normalizeDeviceValue(entry.device)
    });
  });

  const players = playersFromLines
    .map((player, sourceIndex) => {
      const stats = getLeaderboardStats(player.name);
      const key = player.name.toLowerCase();
      const override = syncedPlayers[key];
      player.key = key;
      player.sourceIndex = sourceIndex;
      player.level = override?.level ?? stats.level;
      player.wins = player.level;
      player.kd = override?.kd ?? stats.kd;
      player.playerClass = normalizePlayerClassValue(override?.class ?? player.playerClass);
      player.device = normalizeDeviceValue(override?.device ?? player.device);
      if (override?.faction) {
        player.faction = override.faction;
      }
      return player;
    });

  const configuredOrder = normalizeConfigOrder(remoteConfig, players.map((player) => player.key));
  const orderMap = new Map(configuredOrder.map((key, index) => [key, index]));
  const hasManualOrder = configuredOrder.length > 0;

  players
    .sort((a, b) => {
      const aOrder = orderMap.has(a.key) ? orderMap.get(a.key) : Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.has(b.key) ? orderMap.get(b.key) : Number.MAX_SAFE_INTEGER;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      if (b.level !== a.level) {
        return b.level - a.level;
      }

      return a.sourceIndex - b.sourceIndex;
    });

  const avatarMap = await fetchAvatarUrls(players);

  players.forEach((player) => {
    player.avatarUrl = getResolvedAvatar(player, avatarMap);
    player.bodyAvatarUrl = player.avatarUrl;
    player.wins = player.level;
    delete player.sourceIndex;
  });

  const syncSuffix = remoteConfig?.updatedAt
    ? ` Global sync updated ${new Date(remoteConfig.updatedAt).toLocaleString()}.`
    : "";

  renderLeaderboard(players, avatarMap, {
    syncLabel: syncSuffix,
    hasManualOrder
  });

  if (typeof window.renderFactionNewsFeed === "function") {
    window.renderFactionNewsFeed(players);
  }

  if (typeof window.renderFactionPulse === "function") {
    window.renderFactionPulse(players);
  }
}

initLeaderboardPage();
