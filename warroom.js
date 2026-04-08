const warRoomClockNode = document.getElementById("warRoomClock");
const warRoomChampionNode = document.getElementById("warRoomChampion");
const warRoomAvgKdNode = document.getElementById("warRoomAvgKd");
const warRoomPlayerCountNode = document.getElementById("warRoomPlayerCount");
const warRoomPowerRowsNode = document.getElementById("warRoomPowerRows");
const warRoomTopOperatorsNode = document.getElementById("warRoomTopOperators");
const warRoomSyncNode = document.getElementById("warRoomSync");
const warRoomMapFrameNode = document.getElementById("warRoomMapFrame");
const warRoomMapImageNode = document.getElementById("warRoomMapImage");
const warRoomMapStatusNode = document.getElementById("warRoomMapStatus");
const warRoomMapLeadersNode = document.getElementById("warRoomMapLeaders");
const warRoomHotspotsNode = document.getElementById("warRoomHotspots");
const warRoomHotspotInfoNode = document.getElementById("warRoomHotspotInfo");

const LEADERBOARD_TOP_PLAYER = "20SovietSO21";
const LEADERBOARD_CONFIG_ENDPOINT = "/api/leaderboard-config";

const MAP_HOTSPOT_LAYOUT = [
  { token: "AH", label: "Austria-Hungary", x: 21.5, y: 47.5 },
  { token: "URF", label: "URF", x: 48.5, y: 32.5 },
  { token: "DK", label: "DK", x: 39.5, y: 56.5 },
  { token: "CZSK", label: "Czechoslovakia", x: 13.5, y: 74.5 },
  { token: "NDV", label: "NDV", x: 81.5, y: 34 },
  { token: "RKA", label: "RKA", x: 57, y: 22.5 },
  { token: "TWA", label: "TWA", x: 59, y: 45.5 },
  { token: "TCL", label: "TCL", x: 73.5, y: 51 },
  { token: "TAE", label: "TAE", x: 88.5, y: 57 },
  { token: "AEF", label: "AEF", x: 62.5, y: 55 }
];

let warRoomClockIntervalId = null;
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
    return 1.0;
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

function getFactionMomentum(players) {
  const momentumMap = new Map();

  players.forEach((player, index) => {
    const tokens = [...new Set(
      splitFactionTokens(player.faction).filter((token) => String(token || "").toUpperCase() !== "N/A")
    )];

    if (!tokens.length) {
      return;
    }

    const level = clampLevel(player.level);
    const kd = clampKd(player.kd);
    const impact = getPlayerImpact(level, kd, index);

    tokens.forEach((token) => {
      const current = momentumMap.get(token) || {
        token,
        members: 0,
        totalLevel: 0,
        totalKd: 0,
        score: 0
      };

      current.members += 1;
      current.totalLevel += level;
      current.totalKd += kd;
      current.score += impact;

      momentumMap.set(token, current);
    });
  });

  return [...momentumMap.values()].sort((a, b) => b.score - a.score);
}

function getPlayerImpact(level, kd, rankIndex) {
  return (level * 12) + (kd * 18) + Math.max(0, 14 - rankIndex);
}

function getFactionIntelMap(players, factions) {
  const intelMap = new Map(
    factions.map((faction) => [faction.token, {
      ...faction,
      topOperator: null,
      topImpact: -1
    }])
  );

  players.forEach((player, index) => {
    const tokens = [...new Set(
      splitFactionTokens(player.faction).filter((token) => String(token || "").toUpperCase() !== "N/A")
    )];
    if (!tokens.length) {
      return;
    }

    const level = clampLevel(player.level);
    const kd = clampKd(player.kd);
    const impact = getPlayerImpact(level, kd, index);

    tokens.forEach((token) => {
      if (!intelMap.has(token)) {
        intelMap.set(token, {
          token,
          members: 0,
          totalLevel: 0,
          totalKd: 0,
          score: 0,
          topOperator: null,
          topImpact: -1
        });
      }

      const current = intelMap.get(token);
      if (impact > current.topImpact) {
        current.topImpact = impact;
        current.topOperator = {
          name: player.name,
          kd,
          level
        };
      }
    });
  });

  return intelMap;
}

function getEscaper() {
  if (typeof escapeHtml === "function") {
    return escapeHtml;
  }

  return (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
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
  if (!warRoomClockNode) {
    return;
  }

  updateWarRoomClock();

  if (warRoomClockIntervalId) {
    clearInterval(warRoomClockIntervalId);
  }

  warRoomClockIntervalId = window.setInterval(updateWarRoomClock, 1000);
}

function renderFactionMomentum(factions) {
  if (!warRoomPowerRowsNode) {
    return;
  }

  if (!factions.length) {
    warRoomPowerRowsNode.innerHTML = '<p class="warroom-empty">No faction momentum data is available yet.</p>';
    return;
  }

  const safe = getEscaper();
  const maxScore = Math.max(1, ...factions.map((faction) => faction.score));

  warRoomPowerRowsNode.innerHTML = factions.slice(0, 6).map((faction, index) => {
    const safeToken = safe(faction.token);
    const progress = Math.max(8, Math.round((faction.score / maxScore) * 100));
    const avgLevel = faction.totalLevel / faction.members;
    const avgKd = faction.totalKd / faction.members;
    const label = index === 0
      ? "Holding the frontline"
      : index === 1
        ? "Launching counter-push"
        : "Reinforcing sectors";
    const flagPath = typeof getFactionFlagPath === "function" ? getFactionFlagPath(faction.token) : "";
    const flagMarkup = flagPath
      ? `<img class="faction-flag-icon" src="${flagPath}" alt="${safeToken} flag" loading="lazy">`
      : "";

    return `
      <article class="warroom-row">
        <div class="warroom-row-head">
          <span class="warroom-row-faction">${flagMarkup}${safeToken}</span>
          <strong>${Math.round(faction.score)} pts</strong>
        </div>
        <div class="warroom-row-track" role="presentation">
          <span style="width:${progress}%"></span>
        </div>
        <p>${label} • ${faction.members} players • Avg Lvl ${avgLevel.toFixed(1)} • Avg K/D ${avgKd.toFixed(2)}</p>
      </article>
    `;
  }).join("");
}

function renderTopOperators(players, avatarMap) {
  if (!warRoomTopOperatorsNode) {
    return;
  }

  const safe = getEscaper();

  warRoomTopOperatorsNode.innerHTML = players.slice(0, 8).map((player, index) => {
    const avatar = avatarMap.get(Number(player.userId)) || getStaticAvatarUrl(player.userId) || getFallbackAvatarUrl(player.name);
    const faction = splitFactionTokens(player.faction).join("/");

    return `
      <article class="warroom-operator-row">
        <span class="warroom-operator-rank">#${index + 1}</span>
        <img src="${avatar}" alt="${safe(player.name)} avatar" loading="lazy" referrerpolicy="no-referrer">
        <div>
          <strong>${safe(player.name)}</strong>
          <p>${safe(faction)} • ${countryToFlag(player.country)} ${safe(player.country)}</p>
        </div>
        <span class="warroom-operator-kd">K/D ${Number(player.kd).toFixed(1)}</span>
      </article>
    `;
  }).join("");
}

function bindMapHoverEffect() {
  if (!warRoomMapFrameNode) {
    return;
  }

  warRoomMapFrameNode.addEventListener("mousemove", (event) => {
    const rect = warRoomMapFrameNode.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((event.clientY - rect.top) / rect.height) * 100;
    warRoomMapFrameNode.style.setProperty("--mx", `${xPercent.toFixed(2)}%`);
    warRoomMapFrameNode.style.setProperty("--my", `${yPercent.toFixed(2)}%`);
  });

  warRoomMapFrameNode.addEventListener("mouseleave", () => {
    warRoomMapFrameNode.style.removeProperty("--mx");
    warRoomMapFrameNode.style.removeProperty("--my");
  });
}

function renderMapLeaders(factions) {
  if (!warRoomMapLeadersNode || !warRoomMapStatusNode) {
    return;
  }

  if (!factions.length) {
    warRoomMapStatusNode.textContent = "No active faction overlays available.";
    warRoomMapLeadersNode.innerHTML = "";
    return;
  }

  const safe = getEscaper();
  const maxScore = Math.max(1, ...factions.map((faction) => faction.score));

  warRoomMapStatusNode.textContent = "Faction overlays synced from current leaderboard momentum.";
  warRoomMapLeadersNode.innerHTML = factions.slice(0, 5).map((faction, index) => {
    const intensity = Math.max(12, Math.round((faction.score / maxScore) * 100));
    const safeToken = safe(faction.token);
    const flagPath = typeof getFactionFlagPath === "function" ? getFactionFlagPath(faction.token) : "";
    const flagMarkup = flagPath
      ? `<img class="faction-flag-icon" src="${flagPath}" alt="${safeToken} flag" loading="lazy">`
      : "";
    const stateLabel = index === 0
      ? "Dominating"
      : index === 1
        ? "Contest"
        : "Holding";

    return `
      <article class="warroom-map-badge" style="--intensity:${intensity}%">
        <strong>${flagMarkup}${safeToken}</strong>
        <span>${Math.round(faction.score)} pts • ${stateLabel}</span>
      </article>
    `;
  }).join("");
}

function setHotspotInfo(token, intelMap, mode = "Hover") {
  if (!warRoomHotspotInfoNode) {
    return;
  }

  const safe = getEscaper();
  const info = MAP_HOTSPOT_LAYOUT.find((spot) => spot.token === token);
  const label = info?.label || token;
  const details = intelMap.get(token);
  const flagPath = typeof getFactionFlagPath === "function" ? getFactionFlagPath(token) : "";
  const flagMarkup = flagPath
    ? `<img class="faction-flag-icon" src="${flagPath}" alt="${safe(token)} flag" loading="lazy">`
    : "";

  if (!details) {
    warRoomHotspotInfoNode.innerHTML = `
      <strong>${flagMarkup}${safe(label)} • No active operators</strong>
      <p>This region has no tracked players in the current leaderboard snapshot.</p>
    `;
    return;
  }

  const topOperator = details.topOperator
    ? `${safe(details.topOperator.name)} (K/D ${Number(details.topOperator.kd).toFixed(1)}, Lvl ${details.topOperator.level})`
    : "Unknown";

  warRoomHotspotInfoNode.innerHTML = `
    <strong>${flagMarkup}${safe(label)} • ${safe(mode)} Intel</strong>
    <p>${Math.round(details.score)} points • ${details.members} operators • Top operator: ${topOperator}</p>
  `;
}

function resetHotspotInfo() {
  if (!warRoomHotspotInfoNode) {
    return;
  }

  warRoomHotspotInfoNode.innerHTML = "<strong>Hover a map hotspot</strong><p>Move over a faction region to inspect live points and top operator.</p>";
}

function renderMapHotspots(factions, intelMap) {
  if (!warRoomHotspotsNode) {
    return;
  }

  warRoomHotspotsNode.innerHTML = "";
}

async function initWarRoomPage() {
  if (!warRoomPowerRowsNode || !warRoomTopOperatorsNode) {
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
      player.kd = override?.kd ?? stats.kd;
      return player;
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

  const avatarMap = await fetchAvatarUrls(players);
  const factions = getFactionMomentum(players);
  const factionIntelMap = getFactionIntelMap(players, factions);

  if (warRoomPlayerCountNode) {
    warRoomPlayerCountNode.textContent = String(players.length);
  }

  const avgKd = players.length
    ? players.reduce((sum, player) => sum + clampKd(player.kd), 0) / players.length
    : 0;
  if (warRoomAvgKdNode) {
    warRoomAvgKdNode.textContent = avgKd.toFixed(2);
  }

  if (warRoomChampionNode) {
    if (factions.length) {
      warRoomChampionNode.textContent = `${factions[0].token} (${factions[0].members} players)`;
    } else {
      warRoomChampionNode.textContent = "No faction intel";
    }
  }

  if (warRoomSyncNode) {
    warRoomSyncNode.textContent = remoteConfig?.updatedAt
      ? `Synced with global config: ${new Date(remoteConfig.updatedAt).toLocaleString()}`
      : "Using current local leaderboard snapshot.";
  }

  if (warRoomMapImageNode && warRoomMapStatusNode) {
    warRoomMapImageNode.addEventListener("error", () => {
      warRoomMapStatusNode.textContent = "Map image not found. Expected file: map eoe.png";
    }, { once: true });
  }

  renderFactionMomentum(factions);
  renderTopOperators(players, avatarMap);
  renderMapLeaders(factions);
  renderMapHotspots(factions, factionIntelMap);
  startWarRoomClock();
  bindMapHoverEffect();
}

initWarRoomPage();
