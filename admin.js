const ADMIN_TOKEN_KEY = "draxar-admin-token-v1";
const LOGIN_ENDPOINT = "/api/admin/login";
const ADMIN_CONFIG_ENDPOINT = "/api/admin/config";
const BOT_EVENT_ENDPOINT = "/api/admin/bot-event";

const authCardNode = document.getElementById("adminAuthCard");
const panelNode = document.getElementById("adminPanel");
const loginFormNode = document.getElementById("adminLoginForm");
const passwordNode = document.getElementById("adminPassword");
const loginStatusNode = document.getElementById("adminLoginStatus");
const syncInfoNode = document.getElementById("adminSyncInfo");
const rowsNode = document.getElementById("adminRows");
const transferRowsNode = document.getElementById("adminTransferRows");
const reloadButtonNode = document.getElementById("adminReloadBtn");
const saveButtonNode = document.getElementById("adminSaveBtn");
const logoutButtonNode = document.getElementById("adminLogoutBtn");
const addTransferButtonNode = document.getElementById("adminAddTransferBtn");
const addSyncedPlayerButtonNode = document.getElementById("adminAddSyncedPlayerBtn");
const newPlayerNameNode = document.getElementById("adminNewPlayerName");
const newPlayerFactionNode = document.getElementById("adminNewPlayerFaction");
const newPlayerCountryNode = document.getElementById("adminNewPlayerCountry");
const newPlayerDiscordIdNode = document.getElementById("adminNewPlayerDiscordId");
const newPlayerUserIdNode = document.getElementById("adminNewPlayerUserId");
const newPlayerDeviceNode = document.getElementById("adminNewPlayerDevice");
const newPlayerClassPrimaryNode = document.getElementById("adminNewPlayerClassPrimary");
const newPlayerClassSecondaryNode = document.getElementById("adminNewPlayerClassSecondary");
const newPlayerClassTertiaryNode = document.getElementById("adminNewPlayerClassTertiary");
const addPlayerSendDmNode = document.getElementById("adminAddPlayerSendDm");
const addPlayerDmTemplateNode = document.getElementById("adminAddPlayerDmTemplate");
const addPlayerDmStatusNode = document.getElementById("adminAddPlayerDmStatus");
const clearSyncedPlayerInputsButtonNode = document.getElementById("adminClearSyncedPlayerInputsBtn");
const syncedPlayerRowsNode = document.getElementById("adminSyncedPlayerRows");
const notifyIdsNode = document.getElementById("adminNotifyIds");
const notifyMessageNode = document.getElementById("adminNotifyMessage");
const sendNotifyButtonNode = document.getElementById("adminSendNotifyBtn");
const botOpsStatusNode = document.getElementById("adminBotOpsStatus");
const weeklyTopGenerateButtonNode = document.getElementById("adminWeeklyTopGenerateBtn");
const weeklyTopCopyButtonNode = document.getElementById("adminWeeklyTopCopyBtn");
const weeklyTopTitleNode = document.getElementById("adminWeeklyTopTitle");
const weeklyTopWeekNode = document.getElementById("adminWeeklyTopWeek");
const weeklyTopBoardNode = document.getElementById("adminWeeklyTopBoard");
const weeklyTopMessageNode = document.getElementById("adminWeeklyTopMessage");
const weeklyTopStatusNode = document.getElementById("adminWeeklyTopStatus");
const adminTabButtonNodes = Array.from(document.querySelectorAll(".admin-tab-button[data-admin-tab-target]"));
const adminTabPanelNodes = Array.from(document.querySelectorAll(".admin-tab-panel[data-admin-tab-panel]"));

const DEFAULT_ADD_PLAYER_DM_TEMPLATE = [
  "📩 **ASCEND ENTRENCHED — SYSTEM NOTICE**",
  "",
  "You have been **successfully added to the system**.",
  "Your profile is now live on the leaderboard:",
  "🔗 https://dxc-chi.vercel.app",
  "",
  "━━━ 📊 **RANKING STATUS** ━━━",
  "You are **not ranked yet** — your placement will be processed shortly.",
  "Please allow some time for your ranking to appear.",
  "",
  "━━━ 🤖 **AUTOMATED MESSAGE** ━━━",
  "This message was sent automatically by the system.",
  "**Do not reply.**"
].join("\n");

let currentConfig = {
  version: 1,
  updatedAt: null,
  players: {},
  order: [],
  extraPlayers: [],
  transfers: [],
  botSettings: {
    notificationUserIds: []
  }
};
let currentPlayers = [];
let currentExtraPlayers = [];
let currentRosterLines = [];
let currentTransfers = [];
let draggingPlayerKey = "";
let draggingInitialized = false;
const dynamicAvatarUrlMap = new Map();
const pendingAvatarUserIds = new Set();

function setAddPlayerDmStatus(message, isError = false) {
  if (!addPlayerDmStatusNode) {
    return;
  }

  addPlayerDmStatusNode.textContent = message;
  addPlayerDmStatusNode.classList.toggle("error", isError);
}

function initializeAddPlayerDmTemplate() {
  if (!addPlayerDmTemplateNode) {
    return;
  }

  if (!String(addPlayerDmTemplateNode.value || "").trim()) {
    addPlayerDmTemplateNode.value = DEFAULT_ADD_PLAYER_DM_TEMPLATE;
  }
}

function getAddPlayerDmMessage(playerName) {
  const rawTemplate = String(addPlayerDmTemplateNode?.value || DEFAULT_ADD_PLAYER_DM_TEMPLATE);
  const safePlayerName = String(playerName || "Player").trim() || "Player";
  return rawTemplate.replace(/\{\{\s*player\s*\}\}/gi, safePlayerName).trim();
}

async function resolveRobloxUserIdByUsername(username) {
  const normalizedName = String(username || "").trim();
  if (!normalizedName) {
    return "";
  }

  const mappedId = avatarIdMap?.get?.(normalizedName.toLowerCase());
  if (mappedId) {
    return String(mappedId);
  }

  try {
    const response = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        usernames: [normalizedName],
        excludeBannedUsers: false
      })
    });

    if (!response.ok) {
      return "";
    }

    const payload = await response.json().catch(() => ({}));
    const first = Array.isArray(payload?.data) ? payload.data[0] : null;
    const userId = Number(first?.id);

    if (!Number.isFinite(userId) || userId <= 0) {
      return "";
    }

    avatarIdMap?.set?.(normalizedName.toLowerCase(), userId);
    return String(userId);
  } catch {
    return "";
  }
}

async function fetchDynamicAvatarUrlForUserId(userId) {
  const normalizedId = String(userId || "").trim();
  if (!/^\d{3,}$/.test(normalizedId)) {
    return "";
  }

  if (dynamicAvatarUrlMap.has(normalizedId)) {
    return dynamicAvatarUrlMap.get(normalizedId) || "";
  }

  const endpoint = typeof getThumbnailApiUrl === "function"
    ? getThumbnailApiUrl([normalizedId])
    : `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(normalizedId)}&size=720x720&format=Png&isCircular=false`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      return "";
    }

    const payload = await response.json().catch(() => ({}));
    const imageUrl = String(payload?.data?.[0]?.imageUrl || "").trim();
    if (!imageUrl) {
      return "";
    }

    dynamicAvatarUrlMap.set(normalizedId, imageUrl);
    return imageUrl;
  } catch {
    return "";
  }
}

function getAdminAvatarUrl(player) {
  const staticAvatar = getStaticAvatarUrl(player?.userId);
  if (staticAvatar) {
    return staticAvatar;
  }

  const normalizedUserId = String(player?.userId || "").trim();
  if (dynamicAvatarUrlMap.has(normalizedUserId)) {
    return dynamicAvatarUrlMap.get(normalizedUserId) || "";
  }

  return getFallbackAvatarUrl(player?.name);
}

async function hydrateAvatarNode(node, player) {
  if (!node || !player) {
    return;
  }

  const staticAvatar = getStaticAvatarUrl(player.userId);
  if (staticAvatar) {
    return;
  }

  const normalizedUserId = String(player.userId || "").trim();
  if (!/^\d{3,}$/.test(normalizedUserId) || normalizedUserId === String(fallbackAvatarId)) {
    return;
  }

  if (pendingAvatarUserIds.has(normalizedUserId)) {
    return;
  }

  pendingAvatarUserIds.add(normalizedUserId);
  node.dataset.avatarUserId = normalizedUserId;

  try {
    const dynamicUrl = await fetchDynamicAvatarUrlForUserId(normalizedUserId);
    if (!dynamicUrl) {
      return;
    }

    if (node.dataset.avatarUserId === normalizedUserId) {
      node.src = dynamicUrl;
    }
  } finally {
    pendingAvatarUserIds.delete(normalizedUserId);
  }
}

async function sendPlayerAddedDm(discordId, playerName) {
  const token = getStoredToken();
  const normalizedDiscordId = normalizeDiscordId(discordId);
  const message = getAddPlayerDmMessage(playerName);

  if (!token) {
    throw new Error("Not signed in.");
  }

  if (!normalizedDiscordId) {
    throw new Error("No valid Discord ID for DM.");
  }

  if (!message) {
    throw new Error("DM template is empty.");
  }

  const result = await requestJson(BOT_EVENT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      eventType: "notify",
      title: "ASCEND ENTRENCHED - SYSTEM NOTICE",
      message,
      recipientIds: [normalizedDiscordId]
    })
  });

  if (!result.ok) {
    const details = Array.isArray(result.data?.details) && result.data.details.length
      ? ` (${result.data.details.join("; ")})`
      : "";
    throw new Error(`${String(result.data?.error || "Failed to dispatch DM")}${details}`);
  }

  return true;
}

function renderAdminNewsFeed(players) {
  if (typeof window.renderFactionNewsFeed !== "function") {
    return;
  }

  window.renderFactionNewsFeed(Array.isArray(players) ? players : []);
}

function safeText(value) {
  if (typeof escapeHtml === "function") {
    return escapeHtml(value);
  }

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDefaultStats(playerName) {
  const normalized = String(playerName || "").toLowerCase();
  if (normalized === "20sovietso21") {
    return { level: 10, kd: 4.0 };
  }

  const seed = [...String(playerName || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const level = Math.max(1, Math.min(10, (seed % 10) + 1));
  const kd = Number((((seed % 25) + 14) / 10).toFixed(1));
  return { level, kd };
}

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

  return Math.max(0, Math.min(9.9, Number(numeric.toFixed(1))));
}

function normalizeFactionValue(faction) {
  if (typeof sanitizeFactionValue === "function") {
    return sanitizeFactionValue(faction);
  }

  const normalized = String(faction || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!normalized || normalized === "N/A") {
    return "N/A";
  }

  const tokens = normalized
    .split(/[\/,&|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!tokens.length) {
    return "N/A";
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

function normalizeExtraPlayerEntry(raw, index = 0) {
  const entry = raw && typeof raw === "object" ? raw : {};
  const name = String(entry.name || entry.playerName || "").trim();

  return {
    id: String(entry.id || `extra-player-${Date.now()}-${index}`).trim(),
    name,
    faction: normalizeFactionValue(entry.faction || "N/A"),
    country: String(entry.country || "N/A").trim() || "N/A",
    discordId: normalizeDiscordId(entry.discordId),
    userId: normalizeOptionalUserId(entry.userId),
    class: normalizePlayerClassValue(entry.class),
    classes: normalizePlayerClassList(entry.classes ?? entry.class),
    device: normalizeDeviceValue(entry.device)
  };
}

function normalizeExtraPlayers(rawExtraPlayers) {
  if (!Array.isArray(rawExtraPlayers)) {
    return [];
  }

  return rawExtraPlayers
    .slice(0, 120)
    .map((entry, index) => normalizeExtraPlayerEntry(entry, index))
    .filter((entry) => Boolean(entry.name));
}

function createPlayerFromSyncedEntry(entry) {
  const name = String(entry?.name || "").trim();
  const lower = name.toLowerCase();
  const mappedUserId = typeof avatarIdMap?.get === "function" ? avatarIdMap.get(lower) : null;
  const resolvedUserId = Number(entry?.userId || mappedUserId || fallbackAvatarId);
  const classList = normalizePlayerClassList(entry?.classes ?? entry?.class);

  return {
    name,
    faction: normalizeFactionValue(entry?.faction || "N/A"),
    country: String(entry?.country || "N/A").trim() || "N/A",
    discordId: normalizeDiscordId(entry?.discordId),
    userId: Number.isFinite(resolvedUserId) ? resolvedUserId : fallbackAvatarId,
    avatarUrl: "",
    bodyAvatarUrl: "",
    level: 1,
    kd: 1.0,
    playerClasses: classList,
    playerClass: classList[0] || normalizePlayerClassValue(entry?.class),
    device: normalizeDeviceValue(entry?.device),
    isExtra: true
  };
}

function buildMergedRosterPlayers(lines, extraPlayers) {
  const merged = [];
  const seenKeys = new Set();

  (Array.isArray(lines) ? lines : [])
    .map(parsePlayerLine)
    .filter(Boolean)
    .forEach((player) => {
      const key = String(player.name || "").trim().toLowerCase();
      if (!key || seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);
      merged.push({ ...player, device: "Unknown", isExtra: false });
    });

  normalizeExtraPlayers(extraPlayers).forEach((entry) => {
    const key = String(entry.name || "").trim().toLowerCase();
    if (!key || seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    merged.push(createPlayerFromSyncedEntry(entry));
  });

  return merged;
}

function resetSyncedPlayerInputs() {
  if (newPlayerNameNode) {
    newPlayerNameNode.value = "";
  }

  if (newPlayerFactionNode) {
    newPlayerFactionNode.value = "N/A";
  }

  if (newPlayerCountryNode) {
    newPlayerCountryNode.value = "";
  }

  if (newPlayerDiscordIdNode) {
    newPlayerDiscordIdNode.value = "";
  }

  if (newPlayerUserIdNode) {
    newPlayerUserIdNode.value = "";
  }

  if (newPlayerDeviceNode) {
    newPlayerDeviceNode.value = "Unknown";
  }

  if (newPlayerClassPrimaryNode) {
    newPlayerClassPrimaryNode.value = "Unknown";
  }

  if (newPlayerClassSecondaryNode) {
    newPlayerClassSecondaryNode.value = "Unknown";
  }

  if (newPlayerClassTertiaryNode) {
    newPlayerClassTertiaryNode.value = "Unknown";
  }
}

function removeSyncedPlayerFromState(predicate, statusMessage = "Synced player removed locally. Click Save Global Sync to publish.") {
  const rowValues = collectRowValues();
  const rowOrder = collectRowOrder();
  currentConfig = {
    ...currentConfig,
    players: {
      ...(currentConfig?.players && typeof currentConfig.players === "object" ? currentConfig.players : {}),
      ...rowValues
    },
    order: rowOrder.length ? rowOrder : (Array.isArray(currentConfig?.order) ? currentConfig.order : [])
  };

  const beforeCount = currentExtraPlayers.length;
  currentExtraPlayers = currentExtraPlayers.filter((item) => !predicate(item));

  if (currentExtraPlayers.length === beforeCount) {
    return;
  }

  const mergedRosterPlayers = buildMergedRosterPlayers(currentRosterLines, currentExtraPlayers);
  currentPlayers = mergePlayersWithConfig(mergedRosterPlayers, currentConfig, currentExtraPlayers);
  renderRows(currentPlayers);
  renderSyncedPlayerRows(currentExtraPlayers);
  renderTransferRows(currentTransfers);
  renderAdminNewsFeed(currentPlayers);
  renderWeeklyTopTenPreview();
  setSyncStatus(statusMessage);
}

function buildSyncedClassChips(entry) {
  const classes = normalizePlayerClassList(entry?.classes ?? entry?.class);
  if (!classes.length) {
    return "<span>Unknown</span>";
  }

  return classes
    .map((role) => `<span>${safeText(role)}</span>`)
    .join("");
}

function renderSyncedPlayerRows(players) {
  if (!syncedPlayerRowsNode) {
    return;
  }

  syncedPlayerRowsNode.innerHTML = "";

  if (!Array.isArray(players) || !players.length) {
    const empty = document.createElement("p");
    empty.className = "admin-transfer-empty";
    empty.textContent = "No synced players added from Admin yet.";
    syncedPlayerRowsNode.append(empty);
    return;
  }

  players.forEach((entry, index) => {
    const row = document.createElement("article");
    row.className = "admin-transfer-row";
    row.dataset.syncedPlayerId = entry.id || `extra-player-${index}`;

    row.innerHTML = `
      <span>${safeText(entry.name)}</span>
      <span>${safeText(entry.faction)}</span>
      <span class="admin-synced-classes">${buildSyncedClassChips(entry)}</span>
      <span>${safeText(entry.country)}</span>
      <span>${safeText(entry.discordId || "-")}</span>
      <span>${safeText(entry.userId || "Auto")}</span>
      <span>${safeText(entry.device)}</span>
      <span>Admin Sync</span>
      <span><button type="button" class="admin-button danger admin-synced-player-delete">Remove</button></span>
    `;

    const removeNode = row.querySelector(".admin-synced-player-delete");
    removeNode?.addEventListener("click", () => {
      removeSyncedPlayerFromState((item) => item.id === row.dataset.syncedPlayerId);
    });

    syncedPlayerRowsNode.append(row);
  });
}

function normalizeTransferStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "official" || value === "agreed") {
    return value;
  }

  return "rumor";
}

function normalizeTransferDate(dateValue) {
  const value = String(dateValue || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return "";
}

function normalizeTransferEntry(raw, index = 0) {
  const entry = raw && typeof raw === "object" ? raw : {};
  const playerName = String(entry.playerName || "").trim();
  const fromFaction = normalizeFactionValue(entry.fromFaction || "N/A");
  const toFaction = normalizeFactionValue(entry.toFaction || "N/A");

  return {
    id: String(entry.id || `transfer-${Date.now()}-${index}`).trim(),
    playerName,
    fromFaction,
    toFaction,
    fee: String(entry.fee || "").trim(),
    transferDate: normalizeTransferDate(entry.transferDate),
    status: normalizeTransferStatus(entry.status),
    note: String(entry.note || "").trim().slice(0, 240)
  };
}

function normalizeTransfers(rawTransfers) {
  if (!Array.isArray(rawTransfers)) {
    return [];
  }

  return rawTransfers
    .slice(0, 120)
    .map((entry, index) => normalizeTransferEntry(entry, index))
    .filter((entry) => Boolean(entry.playerName));
}

function setLoginStatus(message, isError = false) {
  if (!loginStatusNode) {
    return;
  }

  loginStatusNode.textContent = message;
  loginStatusNode.classList.toggle("error", isError);
}

function setSyncStatus(message, isError = false) {
  if (!syncInfoNode) {
    return;
  }

  syncInfoNode.textContent = message;
  syncInfoNode.classList.toggle("error", isError);
}

function setBotOpsStatus(message, isError = false) {
  if (!botOpsStatusNode) {
    return;
  }

  botOpsStatusNode.textContent = message;
  botOpsStatusNode.classList.toggle("error", isError);
}

function setWeeklyTopStatus(message, isError = false) {
  if (!weeklyTopStatusNode) {
    return;
  }

  weeklyTopStatusNode.textContent = message;
  weeklyTopStatusNode.classList.toggle("error", isError);
}

function getDefaultWeeklyTopWeekLabel() {
  const now = new Date();
  const month = now.toLocaleString(undefined, { month: "short" });
  const day = String(now.getDate()).padStart(2, "0");
  const year = now.getFullYear();
  return `Week of ${month} ${day}, ${year}`;
}

function getWeeklyTopTenPlayers() {
  if (!Array.isArray(currentPlayers) || !currentPlayers.length) {
    return [];
  }

  return currentPlayers.slice(0, 10).map((player, index) => ({
    ...player,
    weeklyRank: index + 1
  }));
}

function buildWeeklyFactionMarkup(faction) {
  const normalized = normalizeFactionValue(faction);
  if (typeof buildFactionChipHtml === "function") {
    return buildFactionChipHtml(normalized, {
      chipClass: "admin-weekly-faction-chip",
      maxItems: 1
    });
  }

  return `<span class="admin-weekly-faction-chip">${safeText(normalized)}</span>`;
}

function buildWeeklyTopTenMessage(topTenPlayers, headline, weekLabel) {
  const title = String(headline || "").trim() || "Weekly Top 10 in Ascend Entrenched";
  const week = String(weekLabel || "").trim() || getDefaultWeeklyTopWeekLabel();

  const lines = [
    title,
    week,
    "",
    "Top 10 Operators"
  ];

  topTenPlayers.forEach((player, index) => {
    const faction = normalizeFactionValue(player.faction);
    const country = String(player.country || "N/A").trim() || "N/A";
    const level = clampLevel(player.level);
    const kd = clampKd(player.kd).toFixed(1);
    lines.push(`#${index + 1} ${player.name} | ${faction} | ${country} | LVL ${level} | K/D ${kd}`);
  });

  lines.push("");
  lines.push("Weekly Top 10 in Ascend Entrenched. Keep grinding and see you on the battlefield.");
  return lines.join("\n");
}

function renderWeeklyTopTenPreview(options = {}) {
  if (!weeklyTopBoardNode || !weeklyTopMessageNode) {
    return;
  }

  const { announce = false } = options;
  const topTenPlayers = getWeeklyTopTenPlayers();
  const headline = String(weeklyTopTitleNode?.value || "").trim() || "Weekly Top 10 in Ascend Entrenched";
  const weekLabel = String(weeklyTopWeekNode?.value || "").trim() || getDefaultWeeklyTopWeekLabel();

  if (!topTenPlayers.length) {
    weeklyTopBoardNode.innerHTML = `
      <article class="admin-weekly-empty">
        <h3>No ranking data yet</h3>
        <p>Load admin roster data first, then generate your weekly Top 10 board.</p>
      </article>
    `;
    weeklyTopMessageNode.value = "";
    if (announce) {
      setWeeklyTopStatus("No players loaded yet for weekly Top 10.", true);
    }
    return;
  }

  const topThree = topTenPlayers.slice(0, 3);
  const lowerRanks = topTenPlayers.slice(3);

  const podiumMarkup = topThree.map((player) => {
    const rank = Number(player.weeklyRank);
    const avatarUrl = getStaticAvatarUrl(player.userId) || getFallbackAvatarUrl(player.name);
    const factionMarkup = buildWeeklyFactionMarkup(player.faction);
    const level = clampLevel(player.level);
    const kd = clampKd(player.kd).toFixed(1);

    return `
      <article class="admin-weekly-podium-card rank-${rank}">
        <span class="admin-weekly-rank">#${rank}</span>
        <img class="admin-weekly-avatar" src="${avatarUrl}" alt="${safeText(player.name)} avatar" loading="lazy" referrerpolicy="no-referrer">
        <h3>${safeText(player.name)}</h3>
        <div class="admin-weekly-faction-wrap">${factionMarkup}</div>
        <p>${countryToFlag(player.country)} ${safeText(player.country || "N/A")}</p>
        <div class="admin-weekly-stats">
          <span>LVL ${level}</span>
          <span>K/D ${kd}</span>
        </div>
      </article>
    `;
  }).join("");

  const rowsMarkup = lowerRanks.map((player) => {
    const rank = Number(player.weeklyRank);
    const avatarUrl = getStaticAvatarUrl(player.userId) || getFallbackAvatarUrl(player.name);
    const factionMarkup = buildWeeklyFactionMarkup(player.faction);
    const level = clampLevel(player.level);
    const kd = clampKd(player.kd).toFixed(1);

    return `
      <article class="admin-weekly-row">
        <span class="admin-weekly-row-rank">#${rank}</span>
        <img class="admin-weekly-row-avatar" src="${avatarUrl}" alt="${safeText(player.name)} avatar" loading="lazy" referrerpolicy="no-referrer">
        <div class="admin-weekly-row-main">
          <strong>${safeText(player.name)}</strong>
          <div class="admin-weekly-row-meta">
            <span>${countryToFlag(player.country)} ${safeText(player.country || "N/A")}</span>
            <span>${factionMarkup}</span>
          </div>
        </div>
        <div class="admin-weekly-row-stats">
          <span>LVL ${level}</span>
          <span>K/D ${kd}</span>
        </div>
      </article>
    `;
  }).join("");

  weeklyTopBoardNode.innerHTML = `
    <div class="admin-weekly-board-head">
      <div>
        <h3>${safeText(headline)}</h3>
        <p>${safeText(weekLabel)}</p>
      </div>
      <span class="admin-weekly-board-tag">Ascend Entrenched Rankings</span>
    </div>
    <div class="admin-weekly-podium">${podiumMarkup}</div>
    <div class="admin-weekly-list">${rowsMarkup}</div>
  `;

  weeklyTopMessageNode.value = buildWeeklyTopTenMessage(topTenPlayers, headline, weekLabel);
  if (announce) {
    setWeeklyTopStatus(`Weekly Top 10 generated for ${topTenPlayers.length} players.`);
  }
}

function onWeeklyTopGenerateClick() {
  syncCurrentPlayersFromInputs();
  renderWeeklyTopTenPreview({ announce: true });
}

async function onWeeklyTopCopyClick() {
  const text = String(weeklyTopMessageNode?.value || "").trim();
  if (!text) {
    setWeeklyTopStatus("Generate a weekly Top 10 message first.", true);
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else if (weeklyTopMessageNode) {
      weeklyTopMessageNode.focus();
      weeklyTopMessageNode.select();
      document.execCommand("copy");
      weeklyTopMessageNode.setSelectionRange(0, 0);
      weeklyTopMessageNode.blur();
    }

    setWeeklyTopStatus("Weekly Top 10 message copied to clipboard.");
  } catch {
    setWeeklyTopStatus("Copy failed. Select the message manually and copy.", true);
  }
}

function normalizeDiscordIds(rawValue) {
  const values = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue || "")
      .split(/[\s,|;]+/)
      .filter(Boolean);

  return [...new Set(
    values
      .map((value) => String(value || "").trim().replace(/[<@!>]/g, ""))
      .filter((value) => /^\d{8,}$/.test(value))
  )];
}

function renderBotSettings(config) {
  const settings = config?.botSettings && typeof config.botSettings === "object"
    ? config.botSettings
    : {};

  if (notifyIdsNode) {
    const ids = normalizeDiscordIds(settings.notificationUserIds);
    notifyIdsNode.value = ids.join(", ");
  }
}

function getStoredToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function storeToken(token) {
  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function setPanelVisible(isVisible) {
  authCardNode.classList.toggle("hidden", isVisible);
  panelNode.classList.toggle("hidden", !isVisible);
}

function activateAdminTab(tabName) {
  const activeTab = String(tabName || "leaderboard").trim().toLowerCase();

  adminTabButtonNodes.forEach((buttonNode) => {
    const target = String(buttonNode.dataset.adminTabTarget || "").trim().toLowerCase();
    buttonNode.classList.toggle("active", target === activeTab);
  });

  adminTabPanelNodes.forEach((panelTabNode) => {
    const panelName = String(panelTabNode.dataset.adminTabPanel || "").trim().toLowerCase();
    panelTabNode.classList.toggle("hidden", panelName !== activeTab);
  });
}

function setupAdminTabs() {
  if (!adminTabButtonNodes.length || !adminTabPanelNodes.length) {
    return;
  }

  adminTabButtonNodes.forEach((buttonNode) => {
    buttonNode.addEventListener("click", () => {
      activateAdminTab(buttonNode.dataset.adminTabTarget || "leaderboard");
    });
  });

  activateAdminTab("leaderboard");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function login(password) {
  const result = await requestJson(LOGIN_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ password })
  });

  if (!result.ok || !result.data?.token) {
    throw new Error(result.data?.error || "Login failed");
  }

  return result.data.token;
}

async function fetchAdminConfig(token) {
  const result = await requestJson(ADMIN_CONFIG_ENDPOINT, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!result.ok) {
    throw new Error(result.data?.error || "Failed to load admin config");
  }

  return result.data?.config || {
    version: 1,
    updatedAt: null,
    players: {},
    order: [],
    extraPlayers: [],
    transfers: [],
    botSettings: {
      notificationUserIds: []
    }
  };
}

async function saveAdminConfig(token, config) {
  const result = await requestJson(ADMIN_CONFIG_ENDPOINT, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(config)
  });

  if (!result.ok) {
    throw new Error(result.data?.error || "Failed to save config");
  }

  return {
    config: result.data?.config || config,
    botDispatch: result.data?.botDispatch || null
  };
}

function buildLevelOptions(selectedLevel) {
  const safeLevel = clampLevel(selectedLevel);
  const options = [];

  for (let level = 1; level <= 10; level += 1) {
    const selected = level === safeLevel ? " selected" : "";
    options.push(`<option value="${level}"${selected}>${level}</option>`);
  }

  return options.join("");
}

function buildClassOptions(selectedClass) {
  const safeClass = normalizePlayerClassValue(selectedClass);
  return ["Unknown", "Engineer", "Officer", "Recon", "Rifleman", "Skirmisher"]
    .map((role) => `<option value="${role}"${role === safeClass ? " selected" : ""}>${role}</option>`)
    .join("");
}

function buildClassSelects(selectedClasses, playerKey) {
  const classes = normalizePlayerClassList(selectedClasses);
  const slots = [classes[0] || "Unknown", classes[1] || "Unknown", classes[2] || "Unknown"];

  return slots
    .map((selectedClass, index) => {
      return `
        <select class="admin-class-select" data-player-key="${safeText(playerKey)}" data-class-slot="${index}">
          ${buildClassOptions(selectedClass)}
        </select>
      `;
    })
    .join("");
}

function buildDeviceOptions(selectedDevice) {
  const safeDevice = normalizeDeviceValue(selectedDevice);
  return ["Unknown", "PC", "Mobile", "Controller"]
    .map((device) => `<option value="${device}"${device === safeDevice ? " selected" : ""}>${device}</option>`)
    .join("");
}

function formatSyncTime(isoValue) {
  if (!isoValue) {
    return "Never";
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function normalizeOrderKeys(rawOrder, validKeys) {
  const valid = new Set(validKeys);
  const seen = new Set();
  const ordered = [];

  if (Array.isArray(rawOrder)) {
    rawOrder.forEach((rawKey) => {
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

function renderRows(players) {
  rowsNode.innerHTML = "";

  players.forEach((player, index) => {
    const row = document.createElement("article");
    row.className = "admin-row";
    row.dataset.playerKey = player.key;
    row.dataset.playerClasses = normalizePlayerClassList(player.playerClasses ?? player.playerClass).join("|");
    row.dataset.playerDevice = normalizeDeviceValue(player.device);

    const avatarUrl = getAdminAvatarUrl(player);
    const fallback = getFallbackAvatarUrl(player.name);
    const country = `${countryToFlag(player.country)} ${player.country}`;

    row.innerHTML = `
      <span class="admin-order-cell">
        <span class="admin-rank-pill">#${index + 1}</span>
        <span class="admin-drag-handle" draggable="true" aria-hidden="true" title="Drag to reorder">::</span>
      </span>
      <span class="admin-player-cell">
        <img class="admin-avatar" src="${avatarUrl}" alt="${safeText(player.name)} avatar" loading="lazy" referrerpolicy="no-referrer">
        <strong>${safeText(player.name)}</strong>
      </span>
      <span>
        <input class="admin-faction-input" data-player-key="${safeText(player.key)}" type="text" maxlength="36" value="${safeText(normalizeFactionValue(player.faction))}" placeholder="AH/URF">
      </span>
      <span class="admin-country">${safeText(country)}</span>
      <span>
        <div class="admin-class-stack">
          ${buildClassSelects(player.playerClasses ?? player.playerClass, player.key)}
        </div>
      </span>
      <span>
        <select class="admin-device-select" data-player-key="${safeText(player.key)}">
          ${buildDeviceOptions(player.device)}
        </select>
      </span>
      <span>
        <select class="admin-level-select" data-player-key="${safeText(player.key)}">
          ${buildLevelOptions(player.level)}
        </select>
      </span>
      <span>
        <input class="admin-kd-input" data-player-key="${safeText(player.key)}" type="number" step="0.1" min="0" max="9.9" value="${Number(player.kd).toFixed(1)}">
      </span>
      <span class="admin-row-action">
        ${player.isExtra
          ? '<button type="button" class="admin-button danger admin-row-remove-btn">Remove</button>'
          : '<span class="admin-status">Core</span>'}
      </span>
    `;

    const avatarNode = row.querySelector(".admin-avatar");
    const dragHandleNode = row.querySelector(".admin-drag-handle");
    avatarNode.addEventListener("error", () => {
      avatarNode.src = fallback;
    });
    hydrateAvatarNode(avatarNode, player);

    dragHandleNode.addEventListener("dragstart", (event) => {
      draggingPlayerKey = player.key;
      row.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", player.key);
      }
    });

    dragHandleNode.addEventListener("dragend", () => {
      draggingPlayerKey = "";
      row.classList.remove("dragging");
      rowsNode.querySelectorAll(".admin-row.drag-over").forEach((node) => {
        node.classList.remove("drag-over");
      });

      syncCurrentPlayersFromDom();
      renderRows(currentPlayers);
      renderWeeklyTopTenPreview();
      setSyncStatus("Order updated locally. Click Save Global Sync to publish.");
    });

    const removeButtonNode = row.querySelector(".admin-row-remove-btn");
    removeButtonNode?.addEventListener("click", () => {
      const removeKey = String(player.key || "").trim().toLowerCase();
      removeSyncedPlayerFromState((item) => String(item?.name || "").trim().toLowerCase() === removeKey);
    });

    rowsNode.append(row);
  });

  initDragAndDrop();
}

function buildTransferStatusOptions(selectedStatus) {
  const safeStatus = normalizeTransferStatus(selectedStatus);
  return ["rumor", "agreed", "official"]
    .map((status) => {
      const selected = status === safeStatus ? " selected" : "";
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      return `<option value="${status}"${selected}>${label}</option>`;
    })
    .join("");
}

function getSortedCurrentPlayerNames() {
  return [...new Set(
    currentPlayers
      .map((player) => String(player?.name || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function findCurrentPlayerByName(playerName) {
  const needle = String(playerName || "").trim().toLowerCase();
  if (!needle) {
    return null;
  }

  return currentPlayers.find((player) => String(player?.name || "").trim().toLowerCase() === needle) || null;
}

function ensureTransferPlayerDatalist(playerNames) {
  const listId = "adminTransferPlayerList";
  let listNode = document.getElementById(listId);

  if (!listNode) {
    listNode = document.createElement("datalist");
    listNode.id = listId;
    document.body.append(listNode);
  }

  listNode.innerHTML = playerNames
    .map((name) => `<option value="${safeText(name)}"></option>`)
    .join("");

  return listId;
}

function renderTransferRows(transfers) {
  if (!transferRowsNode) {
    return;
  }

  const playerNames = getSortedCurrentPlayerNames();
  const playerListId = ensureTransferPlayerDatalist(playerNames);

  transferRowsNode.innerHTML = "";

  if (!Array.isArray(transfers) || !transfers.length) {
    const empty = document.createElement("p");
    empty.className = "admin-transfer-empty";
    empty.textContent = "No transfer entries yet. Click Add Transfer.";
    transferRowsNode.append(empty);
    return;
  }

  transfers.forEach((transfer, index) => {
    const row = document.createElement("article");
    row.className = "admin-transfer-row";
    row.dataset.transferId = transfer.id || `transfer-${index}`;

    row.innerHTML = `
      <span class="admin-transfer-player-wrap">
        <input class="admin-transfer-input admin-transfer-player" type="text" maxlength="40" list="${playerListId}" value="${safeText(transfer.playerName)}" placeholder="Player name">
        <small class="admin-transfer-player-hint"></small>
      </span>
      <span><input class="admin-transfer-input admin-transfer-from" type="text" maxlength="24" value="${safeText(transfer.fromFaction)}" placeholder="From faction"></span>
      <span><input class="admin-transfer-input admin-transfer-to" type="text" maxlength="24" value="${safeText(transfer.toFaction)}" placeholder="To faction"></span>
      <span><input class="admin-transfer-input admin-transfer-fee" type="text" maxlength="30" value="${safeText(transfer.fee)}" placeholder="Fee / terms"></span>
      <span><input class="admin-transfer-input admin-transfer-date" type="date" value="${safeText(normalizeTransferDate(transfer.transferDate))}"></span>
      <span>
        <select class="admin-transfer-select admin-transfer-status">
          ${buildTransferStatusOptions(transfer.status)}
        </select>
      </span>
      <span><input class="admin-transfer-input admin-transfer-note" type="text" maxlength="240" value="${safeText(transfer.note)}" placeholder="Brief note"></span>
      <span><button type="button" class="admin-button danger admin-transfer-delete">Remove</button></span>
    `;

    const playerInputNode = row.querySelector(".admin-transfer-player");
    const fromInputNode = row.querySelector(".admin-transfer-from");
    const playerHintNode = row.querySelector(".admin-transfer-player-hint");

    const syncPlayerHint = () => {
      const rosterPlayer = findCurrentPlayerByName(playerInputNode?.value || "");
      const hasRosterMatch = Boolean(rosterPlayer);
      row.classList.toggle("admin-transfer-has-player", hasRosterMatch);

      if (playerHintNode) {
        playerHintNode.textContent = hasRosterMatch
          ? `Current faction: ${rosterPlayer.faction}`
          : "Use a current player for quick faction auto-fill";
      }

      if (!hasRosterMatch || !fromInputNode) {
        return;
      }

      const currentFrom = normalizeFactionValue(fromInputNode.value || "N/A");
      if (currentFrom === "N/A") {
        fromInputNode.value = rosterPlayer.faction;
      }
    };

    playerInputNode?.addEventListener("change", syncPlayerHint);
    playerInputNode?.addEventListener("blur", syncPlayerHint);
    syncPlayerHint();

    const deleteButtonNode = row.querySelector(".admin-transfer-delete");
    deleteButtonNode?.addEventListener("click", () => {
      currentTransfers = currentTransfers.filter((item) => item.id !== row.dataset.transferId);
      renderTransferRows(currentTransfers);
      setSyncStatus("Transfer removed locally. Click Save Global Sync to publish.");
    });

    transferRowsNode.append(row);
  });
}

function collectTransferValues() {
  if (!transferRowsNode) {
    return [];
  }

  return Array.from(transferRowsNode.querySelectorAll(".admin-transfer-row[data-transfer-id]"))
    .map((row, index) => {
      const playerName = String(row.querySelector(".admin-transfer-player")?.value || "").trim();
      const rosterPlayer = findCurrentPlayerByName(playerName);
      const rawFromFaction = String(row.querySelector(".admin-transfer-from")?.value || "").trim();
      const fromFaction = normalizeFactionValue(rawFromFaction || rosterPlayer?.faction || "N/A");
      const toFaction = normalizeFactionValue(row.querySelector(".admin-transfer-to")?.value || "N/A");

      if (!playerName || fromFaction === "N/A" || toFaction === "N/A") {
        return null;
      }

      return normalizeTransferEntry({
        id: String(row.dataset.transferId || `transfer-${Date.now()}-${index}`).trim(),
        playerName,
        fromFaction,
        toFaction,
        fee: row.querySelector(".admin-transfer-fee")?.value || "",
        transferDate: row.querySelector(".admin-transfer-date")?.value || "",
        status: row.querySelector(".admin-transfer-status")?.value || "rumor",
        note: row.querySelector(".admin-transfer-note")?.value || ""
      }, index);
    })
    .filter(Boolean);
}

function createBlankTransfer() {
  return {
    id: `transfer-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    playerName: "",
    fromFaction: "N/A",
    toFaction: "N/A",
    fee: "",
    transferDate: "",
    status: "rumor",
    note: ""
  };
}

function getDragAfterElement(container, pointerY) {
  const candidateRows = [...container.querySelectorAll(".admin-row[data-player-key]:not(.dragging)")];
  let closest = {
    offset: Number.NEGATIVE_INFINITY,
    element: null
  };

  candidateRows.forEach((row) => {
    const rect = row.getBoundingClientRect();
    const offset = pointerY - rect.top - rect.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: row };
    }
  });

  return closest.element;
}

function initDragAndDrop() {
  if (draggingInitialized || !rowsNode) {
    return;
  }

  draggingInitialized = true;

  rowsNode.addEventListener("dragover", (event) => {
    const draggingRow = rowsNode.querySelector(".admin-row.dragging");
    if (!draggingRow) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const afterElement = getDragAfterElement(rowsNode, event.clientY);
    rowsNode.querySelectorAll(".admin-row.drag-over").forEach((node) => {
      node.classList.remove("drag-over");
    });

    if (!afterElement) {
      rowsNode.appendChild(draggingRow);
      return;
    }

    afterElement.classList.add("drag-over");
    rowsNode.insertBefore(draggingRow, afterElement);
  });

  rowsNode.addEventListener("drop", (event) => {
    if (!draggingPlayerKey) {
      return;
    }

    event.preventDefault();
  });
}

function mergePlayersWithConfig(players, config, extraPlayers = []) {
  const extraMap = new Map(
    normalizeExtraPlayers(extraPlayers).map((entry) => [String(entry.name || "").trim().toLowerCase(), entry])
  );

  const merged = players.map((player, sourceIndex) => {
      const key = player.name.toLowerCase();
      const override = config?.players?.[key] || {};
      const extra = extraMap.get(key) || null;
      const defaults = getDefaultStats(player.name);
      const classList = normalizePlayerClassList(override.classes ?? override.class ?? player.playerClasses ?? player.playerClass);

      return {
        ...player,
        sourceIndex,
        key,
        faction: normalizeFactionValue(override.faction ?? player.faction),
        level: clampLevel(override.level ?? defaults.level),
        kd: clampKd(override.kd ?? defaults.kd),
        playerClasses: classList,
        playerClass: classList[0] || normalizePlayerClassValue(player.playerClass),
        device: normalizeDeviceValue(override.device ?? extra?.device ?? player.device),
        isExtra: Boolean(extra)
      };
    });

  const orderedKeys = normalizeOrderKeys(config?.order, merged.map((player) => player.key));
  const orderMap = new Map(orderedKeys.map((key, index) => [key, index]));
  const hasManualOrder = orderedKeys.length > 0;

  return merged
    .sort((a, b) => {
      if (hasManualOrder) {
        const aOrder = orderMap.has(a.key) ? orderMap.get(a.key) : Number.MAX_SAFE_INTEGER;
        const bOrder = orderMap.has(b.key) ? orderMap.get(b.key) : Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
      }

      if (b.level !== a.level) {
        return b.level - a.level;
      }

      return a.sourceIndex - b.sourceIndex;
    })
    .map(({ sourceIndex, ...player }) => player);
}

function syncCurrentPlayersFromDom() {
  const values = collectRowValues();
  const order = collectRowOrder();
  const byKey = new Map(currentPlayers.map((player) => [player.key, player]));

  currentPlayers = order.map((key) => {
    const player = byKey.get(key);
    if (!player) {
      return null;
    }

    const next = values[key];
    return {
      ...player,
      faction: next ? next.faction : player.faction,
      playerClasses: next ? normalizePlayerClassList(next.classes ?? next.class) : player.playerClasses,
      playerClass: next ? normalizePlayerClassValue(next.class) : player.playerClass,
      device: next ? normalizeDeviceValue(next.device) : player.device,
      level: next ? next.level : player.level,
      kd: next ? next.kd : player.kd
    };
  }).filter(Boolean);
}

function syncCurrentPlayersFromInputs() {
  const values = collectRowValues();
  currentPlayers = currentPlayers.map((player) => {
    const next = values[player.key];
    if (!next) {
      return player;
    }

    return {
      ...player,
      faction: next.faction,
      playerClasses: normalizePlayerClassList(next.classes ?? next.class),
      playerClass: normalizePlayerClassValue(next.class),
      device: normalizeDeviceValue(next.device),
      level: next.level,
      kd: next.kd
    };
  });
}

function collectRowOrder() {
  return Array.from(rowsNode.querySelectorAll(".admin-row[data-player-key]"))
    .map((row) => String(row.dataset.playerKey || "").trim().toLowerCase())
    .filter(Boolean);
}

function collectRowValues() {
  const result = {};

  const rowNodes = rowsNode.querySelectorAll(".admin-row[data-player-key]");
  rowNodes.forEach((row) => {
    const key = String(row.dataset.playerKey || "").trim().toLowerCase();
    if (!key) {
      return;
    }

    const factionNode = row.querySelector(".admin-faction-input");
    const classNodes = Array.from(row.querySelectorAll(".admin-class-select"));
    const deviceNode = row.querySelector(".admin-device-select");
    const levelNode = row.querySelector(".admin-level-select");
    const kdNode = row.querySelector(".admin-kd-input");

    const faction = normalizeFactionValue(factionNode ? factionNode.value : "N/A");
    const classes = normalizePlayerClassList(
      classNodes.length
        ? classNodes.map((node) => node.value)
        : String(row.dataset.playerClasses || "").split("|")
    );
    const playerClass = classes[0] || "Unknown";
    const device = normalizeDeviceValue(deviceNode ? deviceNode.value : row.dataset.playerDevice);
    const level = clampLevel(levelNode ? levelNode.value : 1);
    const kd = clampKd(kdNode ? kdNode.value : 1.0);

    result[key] = { faction, class: playerClass, classes, level, kd, device };
  });

  return result;
}

async function loadPanelData() {
  const token = getStoredToken();
  if (!token) {
    setPanelVisible(false);
    return;
  }

  setPanelVisible(true);
  setSyncStatus("Loading players and global sync data...");

  try {
    const [lines, config] = await Promise.all([
      loadPlayerLines(),
      fetchAdminConfig(token)
    ]);

    currentRosterLines = Array.isArray(lines) ? lines : [];

    currentConfig = config;
    currentExtraPlayers = normalizeExtraPlayers(config?.extraPlayers);
    const mergedRosterPlayers = buildMergedRosterPlayers(currentRosterLines, currentExtraPlayers);
    currentPlayers = mergePlayersWithConfig(mergedRosterPlayers, config, currentExtraPlayers);
    currentTransfers = normalizeTransfers(config?.transfers);
    renderRows(currentPlayers);
    renderTransferRows(currentTransfers);
    renderSyncedPlayerRows(currentExtraPlayers);
    renderAdminNewsFeed(currentPlayers);
    renderBotSettings(config);
    renderWeeklyTopTenPreview();

    const hasManualOrder = Array.isArray(config?.order) && config.order.length > 0;
    const modeText = hasManualOrder
      ? "Mode: custom admin order"
      : "Mode: leaderboard rank (Level only, K/D ignored)";

    setSyncStatus(`Loaded ${currentPlayers.length} Players (${currentExtraPlayers.length} admin-synced). ${modeText}. Drag with the :: handle to reorder. Last global sync: ${formatSyncTime(config.updatedAt)}.`);
    setBotOpsStatus("DM sender ready.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load panel data";

    if (/unauthorized/i.test(message)) {
      storeToken("");
      setPanelVisible(false);
      setLoginStatus("Session expired. Please sign in again.", true);
      return;
    }

    setSyncStatus(message, true);
  }
}

async function onLoginSubmit(event) {
  event.preventDefault();
  const password = String(passwordNode.value || "").trim();

  if (!password) {
    setLoginStatus("Enter password first.", true);
    return;
  }

  setLoginStatus("Signing in...");

  try {
    const token = await login(password);
    storeToken(token);
    passwordNode.value = "";
    setLoginStatus("Login successful.");
    await loadPanelData();
  } catch (error) {
    setLoginStatus(error instanceof Error ? error.message : "Login failed", true);
  }
}

async function onSaveClick() {
  const token = getStoredToken();
  if (!token) {
    setSyncStatus("Not signed in.", true);
    setPanelVisible(false);
    return;
  }

  setSyncStatus("Saving global sync...");

  try {
    syncCurrentPlayersFromDom();
    const players = collectRowValues();
    const order = collectRowOrder();
    currentTransfers = collectTransferValues();
    const saveResult = await saveAdminConfig(token, {
      players,
      order,
      extraPlayers: currentExtraPlayers,
      transfers: currentTransfers
    });
    const saved = saveResult.config;
    currentConfig = saved;
    currentExtraPlayers = normalizeExtraPlayers(saved?.extraPlayers);
    const mergedRosterPlayers = buildMergedRosterPlayers(currentRosterLines, currentExtraPlayers);
    currentPlayers = mergePlayersWithConfig(mergedRosterPlayers, saved, currentExtraPlayers);
    currentTransfers = normalizeTransfers(saved?.transfers);
    renderRows(currentPlayers);
    renderTransferRows(currentTransfers);
    renderSyncedPlayerRows(currentExtraPlayers);
    renderAdminNewsFeed(currentPlayers);
    renderWeeklyTopTenPreview();

    const botDispatch = saveResult.botDispatch;
    const botSuffix = botDispatch
      ? ` Bot push: ${botDispatch.sent}/${botDispatch.attempted} sent${botDispatch.failed ? `, ${botDispatch.failed} failed` : ""}${botDispatch.skipped ? `, ${botDispatch.skipped} skipped` : ""}.`
      : "";

    setSyncStatus(`Global sync saved. Mode: custom admin order. Updated: ${formatSyncTime(saved.updatedAt)}.${botSuffix}`);
  } catch (error) {
    setSyncStatus(error instanceof Error ? error.message : "Save failed", true);
  }
}

async function onSendNotifyClick() {
  const token = getStoredToken();
  if (!token) {
    setBotOpsStatus("Not signed in.", true);
    return;
  }

  const message = String(notifyMessageNode?.value || "").trim();
  const ids = normalizeDiscordIds(notifyIdsNode?.value || "");

  if (!ids.length) {
    setBotOpsStatus("Add at least one Discord user ID.", true);
    return;
  }

  if (!message) {
    setBotOpsStatus("Enter a message to send.", true);
    return;
  }

  setBotOpsStatus(`Sending message to ${ids.length} IDs...`);

  try {
    const result = await requestJson(BOT_EVENT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        eventType: "notify",
        title: "Ascend Entrenched Admin Broadcast",
        message,
        recipientIds: ids
      })
    });

    if (!result.ok) {
      const details = Array.isArray(result.data?.details) && result.data.details.length
        ? ` (${result.data.details.join("; ")})`
        : "";
      const rawError = String(result.data?.error || "Failed to dispatch bot notification.");
      if (/unauthorized webhook request|forbidden|unauthorized/i.test(rawError)) {
        setBotOpsStatus("Bot rejected webhook auth. You are signed into admin, but BOT_WEBHOOK_SECRET (and bot endpoint auth) must match.", true);
        return;
      }

      setBotOpsStatus(`${rawError}${details}`, true);
      return;
    }

    const dispatch = result.data?.dispatch || {};
    if (dispatch.skipped) {
      setBotOpsStatus(`DM sender skipped: ${dispatch.reason || "webhook is disabled or not configured"}.`, true);
      return;
    }

    const queueInfo = dispatch?.data && typeof dispatch.data === "object" ? dispatch.data : {};
    const queuePosition = Number.isFinite(Number(queueInfo.queuePosition)) ? Number(queueInfo.queuePosition) : null;
    const queueSuffix = queuePosition ? ` Queue position: ${queuePosition}.` : "";
    setBotOpsStatus(`DM job accepted for ${ids.length} Discord IDs.${queueSuffix}`);
  } catch (error) {
    setBotOpsStatus(error instanceof Error ? error.message : "Failed to dispatch bot notification.", true);
  }
}

function onLogoutClick() {
  storeToken("");
  setPanelVisible(false);
  setLoginStatus("Logged out.");
}

async function onAddSyncedPlayerClick() {
  setAddPlayerDmStatus(addPlayerSendDmNode?.checked
    ? "DM on add is enabled."
    : "DM on add is disabled.");

  const playerName = String(newPlayerNameNode?.value || "").trim();
  if (!playerName) {
    setSyncStatus("Enter a player username before adding.", true);
    return;
  }

  const existingKey = playerName.toLowerCase();
  if (currentPlayers.some((player) => String(player?.name || "").trim().toLowerCase() === existingKey)) {
    setSyncStatus("That player already exists in the roster sync list.", true);
    return;
  }

  const chosenClasses = normalizePlayerClassList([
    newPlayerClassPrimaryNode?.value,
    newPlayerClassSecondaryNode?.value,
    newPlayerClassTertiaryNode?.value
  ]);

  let resolvedUserId = normalizeOptionalUserId(newPlayerUserIdNode?.value);
  if (!resolvedUserId) {
    resolvedUserId = await resolveRobloxUserIdByUsername(playerName);
    if (resolvedUserId && newPlayerUserIdNode) {
      newPlayerUserIdNode.value = resolvedUserId;
    }
  }

  const nextEntry = normalizeExtraPlayerEntry({
    id: `extra-player-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: playerName,
    faction: newPlayerFactionNode?.value,
    country: newPlayerCountryNode?.value,
    discordId: newPlayerDiscordIdNode?.value,
    userId: resolvedUserId,
    device: newPlayerDeviceNode?.value,
    classes: chosenClasses,
    class: chosenClasses[0] || "Unknown"
  });

  if (nextEntry.country === "N/A") {
    setSyncStatus("Enter a country for the synced player.", true);
    return;
  }

  const rowValues = collectRowValues();
  const rowOrder = collectRowOrder();
  currentConfig = {
    ...currentConfig,
    players: {
      ...(currentConfig?.players && typeof currentConfig.players === "object" ? currentConfig.players : {}),
      ...rowValues
    },
    order: rowOrder.length ? rowOrder : (Array.isArray(currentConfig?.order) ? currentConfig.order : [])
  };

  currentExtraPlayers = [...currentExtraPlayers, nextEntry];
  const mergedRosterPlayers = buildMergedRosterPlayers(currentRosterLines, currentExtraPlayers);
  currentPlayers = mergePlayersWithConfig(mergedRosterPlayers, currentConfig, currentExtraPlayers);
  renderRows(currentPlayers);
  renderSyncedPlayerRows(currentExtraPlayers);
  renderTransferRows(currentTransfers);
  renderAdminNewsFeed(currentPlayers);
  renderWeeklyTopTenPreview();

  if (resolvedUserId) {
    fetchDynamicAvatarUrlForUserId(resolvedUserId).catch(() => {});
  }

  let dmStatusSuffix = "";
  if (addPlayerSendDmNode?.checked) {
    if (!nextEntry.discordId) {
      dmStatusSuffix = " DM skipped (missing valid Discord ID).";
      setAddPlayerDmStatus("DM skipped: player has no valid Discord ID.", true);
    } else {
      try {
        await sendPlayerAddedDm(nextEntry.discordId, nextEntry.name);
        dmStatusSuffix = " DM sent.";
        setAddPlayerDmStatus(`DM sent to ${nextEntry.name}.`);
      } catch (error) {
        const dmError = error instanceof Error ? error.message : "Failed to send DM.";
        dmStatusSuffix = " DM failed.";
        setAddPlayerDmStatus(dmError, true);
      }
    }
  } else {
    setAddPlayerDmStatus("DM on add is disabled.");
  }

  resetSyncedPlayerInputs();
  setSyncStatus(`Synced player added locally. Click Save Global Sync to publish.${dmStatusSuffix}`);
}

function onClearSyncedPlayerInputsClick() {
  resetSyncedPlayerInputs();
  setSyncStatus("Add Player fields were cleared.");
}

function onAddTransferClick() {
  currentTransfers = [...currentTransfers, createBlankTransfer()];
  renderTransferRows(currentTransfers);
  setSyncStatus("Transfer added locally. Click Save Global Sync to publish.");
}

loginFormNode.addEventListener("submit", onLoginSubmit);
reloadButtonNode.addEventListener("click", loadPanelData);
saveButtonNode.addEventListener("click", onSaveClick);
logoutButtonNode.addEventListener("click", onLogoutClick);
if (sendNotifyButtonNode) {
  sendNotifyButtonNode.addEventListener("click", onSendNotifyClick);
}
if (addTransferButtonNode) {
  addTransferButtonNode.addEventListener("click", onAddTransferClick);
}
if (addSyncedPlayerButtonNode) {
  addSyncedPlayerButtonNode.addEventListener("click", onAddSyncedPlayerClick);
}
if (clearSyncedPlayerInputsButtonNode) {
  clearSyncedPlayerInputsButtonNode.addEventListener("click", onClearSyncedPlayerInputsClick);
}
if (weeklyTopGenerateButtonNode) {
  weeklyTopGenerateButtonNode.addEventListener("click", onWeeklyTopGenerateClick);
}
if (weeklyTopCopyButtonNode) {
  weeklyTopCopyButtonNode.addEventListener("click", onWeeklyTopCopyClick);
}
if (weeklyTopTitleNode) {
  weeklyTopTitleNode.addEventListener("input", () => renderWeeklyTopTenPreview());
}
if (weeklyTopWeekNode) {
  weeklyTopWeekNode.addEventListener("input", () => renderWeeklyTopTenPreview());
}
if (addPlayerSendDmNode) {
  addPlayerSendDmNode.addEventListener("change", () => {
    setAddPlayerDmStatus(addPlayerSendDmNode.checked
      ? "DM on add is enabled."
      : "DM on add is disabled.");
  });
}

initializeAddPlayerDmTemplate();
setAddPlayerDmStatus(addPlayerSendDmNode?.checked
  ? "DM on add is enabled."
  : "DM on add is disabled.");
setupAdminTabs();

if (getStoredToken()) {
  loadPanelData();
} else {
  setPanelVisible(false);
}
