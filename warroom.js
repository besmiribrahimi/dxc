const warRoomClockNode = document.getElementById("warRoomClock");
const warRoomChampionNode = document.getElementById("warRoomChampion");
const warRoomAvgKdNode = document.getElementById("warRoomAvgKd");
const warRoomPlayerCountNode = document.getElementById("warRoomPlayerCount");
const warRoomFactionCountNode = document.getElementById("warRoomFactionCount");
const warRoomContestedNode = document.getElementById("warRoomContested");
const warRoomSyncNode = document.getElementById("warRoomSync");
const warRoomFactionCardsNode = document.getElementById("warRoomFactionCards");
const warRoomTopOperatorsNode = document.getElementById("warRoomTopOperators");
const warRoomFactionTableNode = document.getElementById("warRoomFactionTable");
const warRoomCountryRowsNode = document.getElementById("warRoomCountryRows");
const warRoomKdBandsNode = document.getElementById("warRoomKdBands");
const warRoomLevelBandsNode = document.getElementById("warRoomLevelBands");
const warRoomFactionShareNode = document.getElementById("warRoomFactionShare");
const warRoomRefreshNode = document.getElementById("warRoomRefresh");

const LEADERBOARD_TOP_PLAYER = "20SovietSO21";
const LEADERBOARD_CONFIG_ENDPOINT = "/api/leaderboard-config";

let warRoomClockIntervalId = null;
let warRoomLoadPending = false;

function clampLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(1, Math.min(10, Math.round(numeric)));
}

function clampKd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(0, Math.min(9.9, numeric));
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

function normalizeConfigUserId(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (/^\d{3,14}$/.test(normalized)) {
    return normalized;
  }

  const pathMatch = normalized.match(/\/users\/(\d{3,14})(?:\/|$|\?)/i);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  const queryMatch = normalized.match(/[?&]userId=(\d{3,14})(?:&|$)/i);
  if (queryMatch?.[1]) {
    return queryMatch[1];
  }

  return "";
}

function normalizeConfigExtraPlayers(config) {
  const raw = config?.extraPlayers;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .slice(0, 120)
    .map((entry) => {
      const item = entry && typeof entry === "object" ? entry : {};
      const name = String(item.name || item.playerName || "").trim();
      if (!name) {
        return null;
      }

      const key = name.toLowerCase();
      const mappedUserId = Number(typeof window.avatarIdMap?.get === "function" ? window.avatarIdMap.get(key) : 0);
      const parsedUserId = Number(normalizeConfigUserId(item.userId));
      const resolvedUserId = Number.isFinite(parsedUserId) && parsedUserId > 0
        ? parsedUserId
        : (Number.isFinite(mappedUserId) && mappedUserId > 0 ? mappedUserId : fallbackAvatarId);

      const faction = typeof sanitizeFactionValue === "function"
        ? sanitizeFactionValue(item.faction || "N/A")
        : (String(item.faction || "N/A").trim().toUpperCase() || "N/A");

      return {
        name,
        faction,
        country: String(item.country || "N/A").trim() || "N/A",
        discordId: String(item.discordId || "").trim(),
        userId: resolvedUserId,
        avatarUrl: "",
        bodyAvatarUrl: "",
        level: 1,
        kd: 1,
        playerClasses: [],
        playerClass: "Unknown",
        device: "Unknown"
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

function getPlayerImpact(level, kd, rankIndex) {
  return (level * 12) + (kd * 18) + Math.max(0, 14 - rankIndex);
}

function getEscaper() {
  if (typeof escapeHtml === "function") {
    return escapeHtml;
  }

  return (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateWarRoomClock() {
  if (!warRoomClockNode) {
    return;
  }

  warRoomClockNode.textContent = new Date().toLocaleTimeString("en-GB", {
    hour12: false,
    timeZone: "UTC"
  });
}

function startWarRoomClock() {
  updateWarRoomClock();

  if (warRoomClockIntervalId) {
    clearInterval(warRoomClockIntervalId);
  }

  warRoomClockIntervalId = window.setInterval(updateWarRoomClock, 1000);
}

function buildFactionStats(players) {
  const factions = new Map();

  players.forEach((player, rankIndex) => {
    const tokens = [...new Set(
      splitFactionTokens(player.faction).filter((token) => String(token || "").toUpperCase() !== "N/A")
    )];

    if (!tokens.length) {
      return;
    }

    const level = clampLevel(player.level);
    const kd = clampKd(player.kd);
    const impact = getPlayerImpact(level, kd, rankIndex);

    tokens.forEach((token) => {
      if (!factions.has(token)) {
        factions.set(token, {
          token,
          members: 0,
          score: 0,
          totalLevel: 0,
          totalKd: 0,
          topOperator: null,
          topImpact: -1,
          countries: new Set()
        });
      }

      const row = factions.get(token);
      row.members += 1;
      row.score += impact;
      row.totalLevel += level;
      row.totalKd += kd;
      row.countries.add(String(player.country || "N/A"));

      if (impact > row.topImpact) {
        row.topImpact = impact;
        row.topOperator = {
          name: player.name,
          level,
          kd
        };
      }
    });
  });

  return [...factions.values()].sort((a, b) => b.score - a.score);
}

function renderMetrics(players, factions) {
  if (warRoomPlayerCountNode) {
    warRoomPlayerCountNode.textContent = String(players.length);
  }

  if (warRoomFactionCountNode) {
    warRoomFactionCountNode.textContent = String(factions.length);
  }

  const avgKd = players.length
    ? players.reduce((sum, player) => sum + clampKd(player.kd), 0) / players.length
    : 0;

  if (warRoomAvgKdNode) {
    warRoomAvgKdNode.textContent = avgKd.toFixed(2);
  }

  if (warRoomChampionNode) {
    if (factions.length) {
      warRoomChampionNode.textContent = `${factions[0].token} ${Math.round(factions[0].score)} pts`;
    } else {
      warRoomChampionNode.textContent = "No data";
    }
  }

  if (warRoomContestedNode) {
    if (factions.length < 2) {
      warRoomContestedNode.textContent = "No rivalry";
    } else {
      const gap = Math.max(0, Math.round(factions[0].score - factions[1].score));
      warRoomContestedNode.textContent = `${gap} pts`;
    }
  }
}

function renderFactionCards(factions) {
  if (!warRoomFactionCardsNode) {
    return;
  }

  if (!factions.length) {
    warRoomFactionCardsNode.innerHTML = '<p class="warroom-empty">No faction pressure data available.</p>';
    return;
  }

  const safe = getEscaper();
  const maxScore = Math.max(1, ...factions.map((faction) => faction.score));

  warRoomFactionCardsNode.innerHTML = factions.slice(0, 8).map((faction, index) => {
    const safeToken = safe(faction.token);
    const score = Math.round(faction.score);
    const avgLevel = faction.totalLevel / Math.max(1, faction.members);
    const avgKd = faction.totalKd / Math.max(1, faction.members);
    const progress = Math.max(8, Math.round((faction.score / maxScore) * 100));
    const pressure = index === 0
      ? "Frontline leader"
      : index === 1
        ? "Primary challenger"
        : "Holding sectors";
    const flagPath = typeof getFactionFlagPath === "function" ? getFactionFlagPath(faction.token) : "";
    const flagMarkup = flagPath
      ? `<img class="faction-flag-icon" src="${flagPath}" alt="${safeToken} flag" loading="lazy">`
      : "";
    const topOperator = faction.topOperator
      ? `${safe(faction.topOperator.name)} (K/D ${faction.topOperator.kd.toFixed(1)})`
      : "Unknown";

    return `
      <article class="warroom-faction-card">
        <div class="warroom-faction-head">
          <span class="warroom-token">${flagMarkup}${safeToken}</span>
          <strong class="warroom-score">${score} pts</strong>
        </div>
        <div class="warroom-track" role="presentation">
          <span style="width:${progress}%"></span>
        </div>
        <p class="warroom-meta">${pressure} • ${faction.members} players • Avg Lvl ${avgLevel.toFixed(1)} • Avg K/D ${avgKd.toFixed(2)} • Lead operator: ${topOperator}</p>
      </article>
    `;
  }).join("");
}

function renderTopOperators(players, avatarMap) {
  if (!warRoomTopOperatorsNode) {
    return;
  }

  if (!players.length) {
    warRoomTopOperatorsNode.innerHTML = '<p class="warroom-empty">No player data available.</p>';
    return;
  }

  const safe = getEscaper();

  warRoomTopOperatorsNode.innerHTML = players.slice(0, 10).map((player, index) => {
    const level = clampLevel(player.level);
    const kd = clampKd(player.kd);
    const impact = Math.round(getPlayerImpact(level, kd, index));
    const fallbackAvatar = getFallbackAvatarUrl(player.name);
    const avatar = (typeof avatarMap?.get === "function" ? avatarMap.get(Number(player.userId)) : null)
      || getRobloxHeadshotUrl(player.userId, 420)
      || getStaticAvatarUrl(player.userId)
      || fallbackAvatar;
    const faction = splitFactionTokens(player.faction).join("/");

    return `
      <article class="warroom-operator-row">
        <span class="warroom-operator-rank">#${index + 1}</span>
        <img src="${avatar}" data-fallback="${safe(fallbackAvatar)}" alt="${safe(player.name)} avatar" loading="lazy" referrerpolicy="no-referrer">
        <div>
          <strong>${safe(player.name)}</strong>
          <p>${safe(faction)} • ${countryToFlag(player.country)} ${safe(player.country)} • Lvl ${level} • K/D ${kd.toFixed(1)}</p>
        </div>
        <span class="warroom-operator-score">${impact} pts</span>
      </article>
    `;
  }).join("");

  warRoomTopOperatorsNode.querySelectorAll(".warroom-operator-row img").forEach((imageNode) => {
    const fallback = String(imageNode.getAttribute("data-fallback") || "").trim();
    if (!fallback) {
      return;
    }

    imageNode.addEventListener("error", () => {
      if (imageNode.src === fallback) {
        return;
      }

      imageNode.src = fallback;
    }, { once: true });
  });
}

function renderFactionTable(factions) {
  if (!warRoomFactionTableNode) {
    return;
  }

  if (!factions.length) {
    warRoomFactionTableNode.innerHTML = '<p class="warroom-empty">No faction matchup data available.</p>';
    return;
  }

  const safe = getEscaper();

  warRoomFactionTableNode.innerHTML = factions.slice(0, 8).map((faction, index) => {
    const nextFaction = factions[index + 1];
    const gap = nextFaction ? Math.max(0, Math.round(faction.score - nextFaction.score)) : 0;
    const avgKd = faction.totalKd / Math.max(1, faction.members);
    const flagPath = typeof getFactionFlagPath === "function" ? getFactionFlagPath(faction.token) : "";
    const safeToken = safe(faction.token);
    const flagMarkup = flagPath
      ? `<img class="faction-flag-icon" src="${flagPath}" alt="${safeToken} flag" loading="lazy">`
      : "";

    return `
      <article class="warroom-table-row">
        <span class="warroom-table-rank">#${index + 1}</span>
        <div class="warroom-table-main">
          <strong>${flagMarkup} ${safeToken}</strong>
          <p>${faction.members} players • Avg K/D ${avgKd.toFixed(2)}</p>
        </div>
        <span class="warroom-gap-chip">Gap ${gap} pts</span>
        <span class="warroom-points-chip">${Math.round(faction.score)} pts</span>
      </article>
    `;
  }).join("");
}

function renderCountryRows(players) {
  if (!warRoomCountryRowsNode) {
    return;
  }

  if (!players.length) {
    warRoomCountryRowsNode.innerHTML = '<p class="warroom-empty">No country presence data available.</p>';
    return;
  }

  const counts = new Map();
  players.forEach((player) => {
    const key = String(player.country || "N/A").trim() || "N/A";
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(1, ...sorted.map((entry) => entry[1]));
  const safe = getEscaper();

  warRoomCountryRowsNode.innerHTML = sorted.slice(0, 10).map(([country, count]) => {
    const ratio = Math.round((count / maxCount) * 100);
    const percent = Math.round((count / Math.max(1, players.length)) * 100);

    return `
      <article class="warroom-country-row">
        <div class="warroom-country-head">
          <strong>${countryToFlag(country)} ${safe(country)}</strong>
          <span>${count} players (${percent}%)</span>
        </div>
        <div class="warroom-bar" role="presentation">
          <span style="width:${Math.max(10, ratio)}%"></span>
        </div>
      </article>
    `;
  }).join("");
}

function renderMiniRows(node, rows) {
  if (!node) {
    return;
  }

  const maxValue = Math.max(1, ...rows.map((row) => row.value));
  const safe = getEscaper();

  node.innerHTML = rows.map((row) => {
    const ratio = Math.round((row.value / maxValue) * 100);

    return `
      <article class="warroom-mini-row">
        <div class="warroom-mini-head">
          <strong>${safe(row.label)}</strong>
          <span>${row.value}</span>
        </div>
        <div class="warroom-bar" role="presentation">
          <span style="width:${Math.max(10, ratio)}%"></span>
        </div>
      </article>
    `;
  }).join("");
}

function renderDistribution(players, factions) {
  const kdBands = [
    { label: "0.0-0.9", value: 0 },
    { label: "1.0-1.9", value: 0 },
    { label: "2.0-2.9", value: 0 },
    { label: "3.0+", value: 0 }
  ];

  const levelBands = [
    { label: "Lvl 1-3", value: 0 },
    { label: "Lvl 4-6", value: 0 },
    { label: "Lvl 7-8", value: 0 },
    { label: "Lvl 9-10", value: 0 }
  ];

  players.forEach((player) => {
    const kd = clampKd(player.kd);
    const level = clampLevel(player.level);

    if (kd < 1) {
      kdBands[0].value += 1;
    } else if (kd < 2) {
      kdBands[1].value += 1;
    } else if (kd < 3) {
      kdBands[2].value += 1;
    } else {
      kdBands[3].value += 1;
    }

    if (level <= 3) {
      levelBands[0].value += 1;
    } else if (level <= 6) {
      levelBands[1].value += 1;
    } else if (level <= 8) {
      levelBands[2].value += 1;
    } else {
      levelBands[3].value += 1;
    }
  });

  const factionShare = factions.slice(0, 6).map((faction) => ({
    label: faction.token,
    value: faction.members
  }));

  renderMiniRows(warRoomKdBandsNode, kdBands);
  renderMiniRows(warRoomLevelBandsNode, levelBands);
  renderMiniRows(warRoomFactionShareNode, factionShare.length ? factionShare : [{ label: "No faction data", value: 0 }]);
}

async function gatherPlayers() {
  const [lines, remoteConfig] = await Promise.all([
    loadPlayerLines(),
    fetchRemoteConfig()
  ]);

  const syncedPlayers = normalizeConfigPlayers(remoteConfig);
  const parsedPlayers = lines
    .map(parsePlayerLine)
    .filter(Boolean);

  const players = [];
  const seenKeys = new Set();

  parsedPlayers.forEach((player) => {
    const key = String(player.name || "").trim().toLowerCase();
    if (!key || seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    players.push(player);
  });

  normalizeConfigExtraPlayers(remoteConfig).forEach((extraPlayer) => {
    const key = String(extraPlayer.name || "").trim().toLowerCase();
    if (!key || seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    players.push(extraPlayer);
  });

  players.forEach((player, sourceIndex) => {
    const stats = getLeaderboardStats(player.name);
    const key = String(player.name || "").toLowerCase();
    const override = syncedPlayers[key];
    player.key = key;
    player.sourceIndex = sourceIndex;
    player.level = override?.level ?? stats.level;
    player.kd = override?.kd ?? stats.kd;
  });

  const configuredOrder = normalizeConfigOrder(remoteConfig, players.map((player) => player.key));
  const orderMap = new Map(configuredOrder.map((key, index) => [key, index]));

  players.sort((a, b) => {
    const aOrder = orderMap.has(a.key) ? orderMap.get(a.key) : Number.MAX_SAFE_INTEGER;
    const bOrder = orderMap.has(b.key) ? orderMap.get(b.key) : Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    if (b.level !== a.level) {
      return b.level - a.level;
    }

    if (b.kd !== a.kd) {
      return b.kd - a.kd;
    }

    return a.sourceIndex - b.sourceIndex;
  });

  return { players, remoteConfig };
}

async function loadAndRenderWarRoom() {
  if (warRoomLoadPending) {
    return;
  }

  warRoomLoadPending = true;
  if (warRoomRefreshNode) {
    warRoomRefreshNode.disabled = true;
    warRoomRefreshNode.textContent = "Refreshing...";
  }

  try {
    const { players, remoteConfig } = await gatherPlayers();
    const avatarMap = await fetchAvatarUrls(players);
    const factions = buildFactionStats(players);

    renderMetrics(players, factions);
    renderFactionCards(factions);
    renderTopOperators(players, avatarMap);
    renderFactionTable(factions);
    renderCountryRows(players);
    renderDistribution(players, factions);

    if (warRoomSyncNode) {
      warRoomSyncNode.textContent = remoteConfig?.updatedAt
        ? `Synced: ${new Date(remoteConfig.updatedAt).toLocaleString()}`
        : "Synced from local roster snapshot";
    }
  } finally {
    warRoomLoadPending = false;
    if (warRoomRefreshNode) {
      warRoomRefreshNode.disabled = false;
      warRoomRefreshNode.textContent = "Refresh Analytics";
    }
  }
}

function initWarRoomPage() {
  if (!warRoomFactionCardsNode || !warRoomTopOperatorsNode) {
    return;
  }

  startWarRoomClock();
  loadAndRenderWarRoom();

  if (warRoomRefreshNode) {
    warRoomRefreshNode.addEventListener("click", () => {
      loadAndRenderWarRoom();
    });
  }
}

initWarRoomPage();
