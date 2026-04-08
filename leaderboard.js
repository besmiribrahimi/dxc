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
      level: clampLevel(stats?.level),
      kd: Number(clampKd(stats?.kd).toFixed(1))
    };
  });

  return output;
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
        <span>${countryToFlag(player.country)} ${player.country}</span>
        <span>Faction ${splitFactionTokens(player.faction).join("/")}</span>
        <span>K/D ${Number(player.kd).toFixed(1)}</span>
        <span>Level ${player.level}</span>
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

  const players = lines
    .map(parsePlayerLine)
    .filter(Boolean)
    .map((player, sourceIndex) => {
      const stats = getLeaderboardStats(player.name);
      const key = player.name.toLowerCase();
      const override = syncedPlayers[key];
      player.key = key;
      player.sourceIndex = sourceIndex;
      player.level = override?.level ?? stats.level;
      player.wins = player.level;
      player.kd = override?.kd ?? stats.kd;
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
}

initLeaderboardPage();
