const leaderboardRowsNode = document.getElementById("leaderboardRows");
const topThreeNode = document.getElementById("leaderTopThree");
const leaderboardStatusNode = document.getElementById("leaderboardStatus");
const modalRankNode = document.getElementById("modalRank");
const modalRankBadgeNode = document.getElementById("modalRankBadge");
const modalClassNode = document.getElementById("modalClass");
const leaderboardModalPanelNode = document.querySelector("#playerModal .leaderboard-modal-panel");
const rankStructureToggleNode = document.getElementById("rankStructureToggle");
const rankStructurePanelNode = document.getElementById("rankStructurePanel");
const rankStructureCloseNode = document.getElementById("rankStructureClose");

let previousPlayersState = [];
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
  if (normalized === "engi") {
    return "Engineer";
  }

  if (normalized === "engineer") {
    return "Engineer";
  }

  if (normalized === "commander") {
    return "Officer";
  }

  if (normalized === "officer") {
    return "Officer";
  }

  if (normalized === "scout") {
    return "Recon";
  }

  if (normalized === "recon") {
    return "Recon";
  }

  if (normalized === "rifle") {
    return "Rifleman";
  }

  if (normalized === "rifleman") {
    return "Rifleman";
  }

  if (normalized === "skirmisher") {
    return "Skirmisher";
  }

  return "Unknown";
}

function normalizePlayerClassList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
      .split(/[\/,&|;]+/)
      .map((part) => part.trim())
      .filter(Boolean);

  const normalized = [];
  source.forEach((entry) => {
    const role = normalizePlayerClassValue(entry);
    if (role === "Unknown" || normalized.includes(role)) {
      return;
    }

    normalized.push(role);
  });

  return normalized.slice(0, 3);
}

function getSeedFromName(name) {
  return [...String(name || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function getFallbackClassList(name) {
  const pool = ["Rifleman", "Engineer", "Recon", "Officer", "Skirmisher"];
  const seed = getSeedFromName(name);
  const primary = pool[seed % pool.length];
  const secondary = pool[(seed + 2) % pool.length];
  return primary === secondary ? [primary] : [primary, secondary];
}

function resolveClassList(value, name) {
  const normalized = normalizePlayerClassList(value);
  if (normalized.length) {
    return normalized;
  }

  return getFallbackClassList(name);
}

function sortClassListForDisplay(classList) {
  const priority = new Map([
    ["Rifleman", 0],
    ["Skirmisher", 1],
    ["Recon", 2],
    ["Officer", 3],
    ["Engineer", 4],
    ["Unknown", 99]
  ]);

  return [...(Array.isArray(classList) ? classList : [])]
    .map((label, index) => ({
      label,
      index,
      rank: priority.has(label) ? priority.get(label) : 98
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.label);
}

function resolveDeviceValue(value, name) {
  const normalized = normalizeDeviceValue(value);
  if (normalized !== "Unknown") {
    return normalized;
  }

  const pool = ["PC", "Controller", "Mobile"];
  const seed = getSeedFromName(name);
  return pool[seed % pool.length];
}

function getClassChipToneClass(playerClass) {
  const normalized = normalizePlayerClassValue(playerClass).toLowerCase();
  if (normalized === "rifleman") {
    return "chip-class-rifleman";
  }

  if (normalized === "skirmisher") {
    return "chip-class-skirmisher";
  }

  if (normalized === "engineer") {
    return "chip-class-engineer";
  }

  if (normalized === "officer") {
    return "chip-class-officer";
  }

  if (normalized === "recon") {
    return "chip-class-recon";
  }

  return "chip-class-default";
}

function getRankTierClass(rank) {
  const numericRank = Number(rank) || 0;
  if (numericRank === 1) {
    return "rank-tier-1";
  }

  if (numericRank === 2) {
    return "rank-tier-2";
  }

  if (numericRank === 3) {
    return "rank-tier-3";
  }

  return "rank-tier-default";
}

function buildModalClassMarkup(player) {
  const classList = sortClassListForDisplay(
    resolveClassList(player?.playerClasses ?? player?.playerClass, player?.name)
  ).slice(0, 3);
  return classList
    .map((classLabel) => {
      const toneClass = getClassChipToneClass(classLabel);
      const iconMarkup = getClassIconMarkup(classLabel, "modal-class-icon");
      return `<span class="leader-modal-class-chip ${toneClass}">${iconMarkup}<span>${classLabel}</span></span>`;
    })
    .join("");
}

function openLeaderboardModal(player) {
  if (typeof openModal === "function") {
    openModal(player);
  }

  const rank = Number(player?.rank) || 0;

  if (modalRankNode) {
    modalRankNode.textContent = `#${rank}`;
  }

  if (modalRankBadgeNode) {
    modalRankBadgeNode.textContent = `#${rank}`;
  }

  if (modalClassNode) {
    modalClassNode.innerHTML = buildModalClassMarkup(player);
  }

  if (leaderboardModalPanelNode) {
    leaderboardModalPanelNode.classList.remove("rank-tier-1", "rank-tier-2", "rank-tier-3", "rank-tier-default");
    leaderboardModalPanelNode.classList.add(getRankTierClass(rank));
  }
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

  return /^\d{3,14}$/.test(normalized) ? normalized : "";
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

    const classList = normalizePlayerClassList(stats?.classes ?? stats?.class);
    output[key] = {
      faction: normalizeFactionOverride(stats?.faction),
      class: classList[0] || "Unknown",
      classes: classList,
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

      const mappedUserId = Number(avatarIdMap?.get?.(name.toLowerCase()) || 0);
      const normalizedUserId = normalizeOptionalUserId(item.userId);

      return {
        id: String(item.id || `extra-player-${index}`).trim(),
        name,
        faction: normalizeFactionOverride(item.faction || "N/A") || "N/A",
        class: normalizePlayerClassValue(item.class),
        classes: normalizePlayerClassList(item.classes ?? item.class),
        country: String(item.country || "N/A").trim() || "N/A",
        discordId: normalizeDiscordId(item.discordId),
        userId: normalizedUserId || (Number.isFinite(mappedUserId) && mappedUserId > 0 ? String(mappedUserId) : ""),
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
    getRobloxHeadshotUrl(player.userId, 420) ||
    getFallbackAvatarUrl(player.name)
  );
}

function buildTopThreeCard(player, rank, avatarMap) {
  const card = document.createElement("article");
  card.className = `podium-card rank-${rank}`;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open Player ${player.name}`);
  // Set faction flag background image for watermark
  card.style.setProperty('--faction-flag-bg-image', getPrimaryFactionBackgroundImage(player.faction));

  const avatarUrl = getResolvedAvatar(player, avatarMap);
  const fallbackAvatar = getFallbackAvatarUrl(player.name);
  const levelBadgeUrl = getLevelBadgePath(player.level);
  const classList = sortClassListForDisplay(
    resolveClassList(player.playerClasses ?? player.playerClass, player.name)
  );
  const deviceLabel = resolveDeviceValue(player.device, player.name);
  const classChipsMarkup = (classList.length ? classList : ["Unknown"])
    .map((classLabel) => {
      const classIconMarkup = getClassIconMarkup(classLabel, "podium-class-icon");
      const toneClass = getClassChipToneClass(classLabel);
      return `<span class="podium-stat podium-detail-chip ${toneClass}">${classIconMarkup}<span>${classLabel}</span></span>`;
    })
    .join("");
  const deviceIconMarkup = getDeviceIconMarkup(deviceLabel, "podium-device-icon");
  const factionMarkup = buildFactionChipHtml(player.faction, {
    chipClass: "leader-faction-chip",
    maxItems: 1,
    includeGroupWrapper: true,
    groupClass: "leader-faction-group"
  });

  card.innerHTML = `
    <div class="holographic-shine"></div>
    <span class="podium-rank">#${rank}</span>
    <img class="podium-avatar" src="${avatarUrl}" alt="${player.name} Roblox avatar" loading="lazy" referrerpolicy="no-referrer">
    <div class="podium-body">
      <h2 class="podium-title">${player.name}</h2>
      ${factionMarkup}
      <div class="podium-meta">
        <span class="podium-stat">${countryToFlag(player.country)} ${player.country}</span>
        ${classChipsMarkup}
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

  card.addEventListener("click", () => openLeaderboardModal(player));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLeaderboardModal(player);
    }
  });

  return card;
}

function buildLeaderboardRow(player, rank, avatarMap) {
  const row = document.createElement("article");
  row.className = "leaderboard-row";
  row.style.setProperty('--row-index', rank -1);
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-label", `Open Player ${player.name}`);

  const avatarUrl = getResolvedAvatar(player, avatarMap);
  const fallbackAvatar = getFallbackAvatarUrl(player.name);
  const levelBadgeUrl = getLevelBadgePath(player.level);
  const classList = sortClassListForDisplay(
    resolveClassList(player.playerClasses ?? player.playerClass, player.name)
  );
  const deviceLabel = resolveDeviceValue(player.device, player.name);
  const classChipsMarkup = (classList.length ? classList : ["Unknown"])
    .map((classLabel) => {
      const classIconMarkup = getClassIconMarkup(classLabel, "leader-class-icon");
      const toneClass = getClassChipToneClass(classLabel);
      return `<span class="leader-detail-chip ${toneClass}">${classIconMarkup}<span>${classLabel}</span></span>`;
    })
    .join("");
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
        ${classChipsMarkup}
        <span class="leader-detail-chip">${deviceIconMarkup}<span>${deviceLabel}</span></span>
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

  row.addEventListener("click", () => openLeaderboardModal(player));
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLeaderboardModal(player);
    }
  });

  return row;
}

function renderLeaderboard(players, avatarMap, options = {}) {
  const {
    syncLabel = "",
    hasManualOrder = false
  } = options;

  // Podium section intentionally removed for this page version.
  if (topThreeNode) {
    topThreeNode.innerHTML = "";
  }

  // Create a map of current player elements by their key
  const existingRowNodes = new Map();
  leaderboardRowsNode.querySelectorAll('.leaderboard-row').forEach(node => {
    const key = node.dataset.playerKey;
    if (key) {
      existingRowNodes.set(key, node);
    }
  });

  const newPlayerKeys = new Set(players.map(p => p.key));
  const previousPlayerRankMap = new Map(previousPlayersState.map((p, i) => [p.key, i]));

  // Remove players who are no longer on the leaderboard
  existingRowNodes.forEach((node, key) => {
    if (!newPlayerKeys.has(key)) {
      node.style.opacity = '0';
      node.style.transform = 'translateX(-30px)';
      setTimeout(() => node.remove(), 300);
    }
  });

  // Add or update players
  players.forEach((player, index) => {
    const rank = index + 1;
    player.rank = rank;
    const oldRank = previousPlayerRankMap.get(player.key);
    let rowNode = existingRowNodes.get(player.key);

    if (rowNode) {
      // Player exists, update it
      // Update rank display
      const rankNode = rowNode.querySelector('.leader-rank');
      if (rankNode) {
        rankNode.textContent = `#${rank}`;
        rankNode.className = `leader-rank rank-${rank <= 3 ? rank : 0}`;
      }

      // Check for rank change and apply animation
      if (oldRank !== undefined && oldRank !== index) {
        const animationClass = oldRank > index ? 'rank-up' : 'rank-down';
        rowNode.classList.remove('rank-up', 'rank-down');
        // Use a timeout to re-apply the class, forcing a reflow and re-triggering the animation
        setTimeout(() => {
            rowNode.classList.add(animationClass);
            // Clean up the class after animation ends
            rowNode.addEventListener('animationend', () => rowNode.classList.remove(animationClass), { once: true });
        }, 10);
      }

    } else {
      // New player, create and insert new row
      rowNode = buildLeaderboardRow(player, rank, avatarMap);
      rowNode.dataset.playerKey = player.key;
    }

    rowNode.style.setProperty('--row-index', index);
    leaderboardRowsNode.appendChild(rowNode);
  });

  const modeLabel = hasManualOrder
    ? "Players ranked by Admin custom order."
    : "Players ranked by Level only (K/D does not affect placement).";
  leaderboardStatusNode.textContent = `${players.length} ${modeLabel}${syncLabel}`;

  previousPlayersState = [...players];
}

async function loadAndRenderLeaderboard() {
  if (!leaderboardRowsNode || !leaderboardStatusNode) {
    return;
  }

  const [lines, remoteConfig] = await Promise.all([
    loadPlayerLines(),
    fetchRemoteConfig()
  ]);
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
      playerClasses: normalizePlayerClassList(entry.classes ?? entry.class),
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
      const classList = resolveClassList(override?.classes ?? override?.class ?? player.playerClasses ?? player.playerClass, player.name);
      player.playerClasses = classList;
      player.playerClass = classList[0] || "Unknown";
      player.device = resolveDeviceValue(override?.device ?? player.device, player.name);
      if (override?.faction) {
        player.faction = override.faction;
      }
      return player;
    });

  const configuredOrder = normalizeConfigOrder(remoteConfig, players.map((player) => player.key));
  const orderMap = new Map(configuredOrder.map((key, index) => [key, index]));
  const hasManualOrder = configuredOrder.length > 0;

  if (hasManualOrder) {
    players.sort((a, b) => {
      const rankA = orderMap.has(a.key) ? orderMap.get(a.key) : Infinity;
      const rankB = orderMap.has(b.key) ? orderMap.get(b.key) : Infinity;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return b.level - a.level || b.kd - a.kd || a.sourceIndex - b.sourceIndex;
    });
  } else {
    players.sort((a, b) => b.level - a.level || b.kd - a.kd || a.sourceIndex - b.sourceIndex);
  }

  const syncLabel = remoteConfig?.lastSyncTime ? ` (Synced: ${new Date(remoteConfig.lastSyncTime).toLocaleString()})` : "";
  const options = { syncLabel, hasManualOrder };

  // Render immediately so page is interactive while avatar fetch continues in background.
  renderLeaderboard(players, new Map(), options);

  fetchAvatarUrls(players)
    .then((avatarMap) => {
      renderLeaderboard(players, avatarMap, options);
    })
    .catch(() => {});
}

function setupSearch() {
  const searchInput = document.getElementById("leaderboardSearch");
  if (!searchInput) {
    return;
  }

  searchInput.addEventListener("input", (event) => {
    const term = String(event.target?.value || "").trim().toLowerCase();
    leaderboardRowsNode.querySelectorAll(".leaderboard-row").forEach((row) => {
      const key = String(row.dataset.playerKey || "").toLowerCase();
      const shouldShow = !term || key.includes(term);
      row.classList.toggle("hidden", !shouldShow);
    });
  });
}

function setupRankStructurePopup() {
  if (!rankStructureToggleNode || !rankStructurePanelNode || !rankStructureCloseNode) {
    return;
  }

  const setOpen = (open) => {
    rankStructurePanelNode.classList.toggle("open", open);
    rankStructurePanelNode.setAttribute("aria-hidden", String(!open));
    rankStructureToggleNode.setAttribute("aria-expanded", String(open));
  };

  rankStructureToggleNode.addEventListener("click", () => {
    const isOpen = rankStructurePanelNode.classList.contains("open");
    setOpen(!isOpen);
  });

  rankStructureCloseNode.addEventListener("click", () => {
    setOpen(false);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setOpen(false);
    }
  });

  try {
    const seenKey = "leaderboard-structure-seen";
    const seen = window.sessionStorage.getItem(seenKey) === "1";
    if (!seen) {
      setOpen(true);
      window.sessionStorage.setItem(seenKey, "1");
    }
  } catch {
    setOpen(true);
  }
}

function initLeaderboardPage() {
  setupSearch();
  setupRankStructurePopup();
  loadAndRenderLeaderboard();
}

initLeaderboardPage();
