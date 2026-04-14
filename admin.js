const ADMIN_TOKEN_KEY = "draxar-admin-token-v1";
const LOGIN_ENDPOINT = "/api/admin/login";
const ADMIN_CONFIG_ENDPOINT = "/api/admin/config";
const BOT_EVENT_ENDPOINT = "/api/admin/bot-event";
const ADMIN_WEB_SYNC_ENDPOINT = "/api/leaderboard-config";

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
const refreshInsightsButtonNode = document.getElementById("adminRefreshInsightsBtn");
const exportInsightsButtonNode = document.getElementById("adminExportInsightsBtn");
const webInsightsGridNode = document.getElementById("adminWebInsightsGrid");
const webInsightsStatusNode = document.getElementById("adminWebInsightsStatus");
const matchRowsNode = document.getElementById("adminMatchRows");
const postMatchButtonNode = document.getElementById("adminPostMatchBtn");
const matchTitleNode = document.getElementById("adminMatchTitle");
const matchTeamANode = document.getElementById("adminMatchTeamA");
const matchTeamBNode = document.getElementById("adminMatchTeamB");
const matchScoreANode = document.getElementById("adminMatchScoreA");
const matchScoreBNode = document.getElementById("adminMatchScoreB");
const matchCasualtiesANode = document.getElementById("adminMatchCasualtiesA");
const matchCasualtiesBNode = document.getElementById("adminMatchCasualtiesB");
const matchDateNode = document.getElementById("adminMatchDate");
const matchMediaNode = document.getElementById("adminMatchMedia");
const matchTypeTabButtonNodes = Array.from(document.querySelectorAll(".admin-matches-type-tab[data-admin-match-type-tab]"));
const adminTabButtonNodes = Array.from(document.querySelectorAll(".admin-tab-button[data-admin-tab-target]"));
const adminTabPanelNodes = Array.from(document.querySelectorAll(".admin-tab-panel[data-admin-tab-panel]"));

const DEFAULT_ADD_PLAYER_DM_TEMPLATE = [
  "📩 **ASCEND ENTRENCHED — SYSTEM NOTICE**",
  "",
  "You have been **successfully added to the system**.",
  "Your profile is now live on the leaderboard:",
  "🔗 https://ascendentrenched.xyz",
  "",
  "━━━ 📊 **RANKING STATUS** ━━━",
  "You are **not ranked yet** — your placement will be processed shortly.",
  "Please allow some time for your ranking to appear.",
  "",
  "━━━ 🤖 **AUTOMATED MESSAGE** ━━━",
  "This message was sent automatically by the system.",
  "**Do not reply.**"
].join("\n");
const MAX_CLIP_UPLOAD_BYTES = 2 * 1024 * 1024;

let currentConfig = {
  version: 1,
  updatedAt: null,
  players: {},
  order: [],
  extraPlayers: [],
  transfers: [],
  matches: [],
  botSettings: {
    notificationUserIds: []
  }
};
let currentPlayers = [];
let currentExtraPlayers = [];
let currentRosterLines = [];
let currentTransfers = [];
let currentMatches = [];
let activeMatchTypeTab = "finished";
let draggingPlayerKey = "";
let draggingInitialized = false;
let editingSyncedPlayerId = "";
let cachedEndpointInsights = [];
let insightsRefreshInFlight = false;
const dynamicAvatarUrlMap = new Map();
const pendingAvatarUserIds = new Set();

// Match Entry State
let matchTeamARoster = [];
let matchTeamBRoster = [];
const MATCH_CALCULATE_ENDPOINT = "/api/admin/match-calculate";

function warnDirectAdminAccess() {
  const pathname = String(window.location.pathname || "").toLowerCase();
  const isAdminPath = pathname.endsWith("/entrenched-sysadmin-ops-portal.html") || pathname.endsWith("entrenched-sysadmin-ops-portal.html") || pathname.endsWith("/admin");
  if (!isAdminPath) {
    return;
  }

  const warningKey = "draxar-admin-route-warning-v1";
  if (window.sessionStorage.getItem(warningKey) === "1") {
    return;
  }

  window.sessionStorage.setItem(warningKey, "1");
  window.alert("Warning: /entrenched-sysadmin-ops-portal.html is restricted to authorized admins only. Clips are temporarily hidden.");
}

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

  if (/^\d{3,}$/.test(normalizedUserId) && normalizedUserId !== String(fallbackAvatarId)) {
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(normalizedUserId)}&width=420&height=420&format=png`;
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
  return { elo: 1000, wins: 0, losses: 0, lastEloChange: 0 };
}

function clampElo(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1000;
  }

  return Math.max(1000, Math.min(4000, Math.round(numeric)));
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

  return /^\d{3,14}$/.test(normalized) ? normalized : "";
}

function normalizeUserIdInput(value) {
  const directId = normalizeOptionalUserId(value);
  if (directId) {
    return directId;
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const pathMatch = raw.match(/\/users\/(\d{3,14})(?:\/|$|\?)/i);
  if (pathMatch?.[1]) {
    return normalizeOptionalUserId(pathMatch[1]);
  }

  const queryMatch = raw.match(/[?&]userId=(\d{3,14})(?:&|$)/i);
  if (queryMatch?.[1]) {
    return normalizeOptionalUserId(queryMatch[1]);
  }

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withProtocol);
    const parsedPathMatch = parsed.pathname.match(/\/users\/(\d{3,14})(?:\/|$)/i);
    if (parsedPathMatch?.[1]) {
      return normalizeOptionalUserId(parsedPathMatch[1]);
    }

    const parsedQueryId = parsed.searchParams.get("userId");
    if (parsedQueryId) {
      return normalizeOptionalUserId(parsedQueryId);
    }
  } catch {
    return "";
  }

  return "";
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
    userId: normalizeUserIdInput(entry.userId),
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
  const normalizedUserId = normalizeOptionalUserId(entry?.userId);
  const resolvedUserId = Number(normalizedUserId || mappedUserId || fallbackAvatarId);
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
  editingSyncedPlayerId = "";

  if (addSyncedPlayerButtonNode) {
    addSyncedPlayerButtonNode.textContent = "Add Synced Player";
  }

  if (clearSyncedPlayerInputsButtonNode) {
    clearSyncedPlayerInputsButtonNode.textContent = "Clear Fields";
  }

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

function populateSyncedPlayerInputs(entry) {
  if (!entry || typeof entry !== "object") {
    return;
  }

  editingSyncedPlayerId = String(entry.id || "").trim();

  if (addSyncedPlayerButtonNode) {
    addSyncedPlayerButtonNode.textContent = "Update Synced Player";
  }

  if (clearSyncedPlayerInputsButtonNode) {
    clearSyncedPlayerInputsButtonNode.textContent = "Cancel Edit";
  }

  if (newPlayerNameNode) {
    newPlayerNameNode.value = String(entry.name || "").trim();
  }

  if (newPlayerFactionNode) {
    newPlayerFactionNode.value = normalizeFactionValue(entry.faction || "N/A");
  }

  if (newPlayerCountryNode) {
    newPlayerCountryNode.value = String(entry.country || "").trim();
  }

  if (newPlayerDiscordIdNode) {
    newPlayerDiscordIdNode.value = String(entry.discordId || "").trim();
  }

  if (newPlayerUserIdNode) {
    newPlayerUserIdNode.value = String(entry.userId || "").trim();
  }

  if (newPlayerDeviceNode) {
    newPlayerDeviceNode.value = normalizeDeviceValue(entry.device);
  }

  const classes = normalizePlayerClassList(entry.classes ?? entry.class);
  if (newPlayerClassPrimaryNode) {
    newPlayerClassPrimaryNode.value = classes[0] || "Unknown";
  }

  if (newPlayerClassSecondaryNode) {
    newPlayerClassSecondaryNode.value = classes[1] || "Unknown";
  }

  if (newPlayerClassTertiaryNode) {
    newPlayerClassTertiaryNode.value = classes[2] || "Unknown";
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
  const editingRemoved = editingSyncedPlayerId
    && !currentExtraPlayers.some((item) => item.id === editingSyncedPlayerId);

  if (currentExtraPlayers.length === beforeCount) {
    return;
  }

  if (editingRemoved) {
    resetSyncedPlayerInputs();
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
      <span class="admin-synced-actions">
        <button type="button" class="admin-button secondary admin-synced-player-edit">Edit</button>
        <button type="button" class="admin-button danger admin-synced-player-delete">Remove</button>
      </span>
    `;

    const editNode = row.querySelector(".admin-synced-player-edit");
    editNode?.addEventListener("click", () => {
      const target = currentExtraPlayers.find((item) => item.id === row.dataset.syncedPlayerId);
      if (!target) {
        setSyncStatus("Unable to find that synced player entry for editing.", true);
        return;
      }

      populateSyncedPlayerInputs(target);
      newPlayerNameNode?.focus();
      setSyncStatus(`Editing ${target.name}. Click Update Synced Player to apply changes.`);
    });

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

function normalizeMatchMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return "";
}

function setActiveMatchTypeTab(nextType) {
  activeMatchTypeTab = nextType;

  matchTypeTabButtonNodes.forEach((buttonNode) => {
    buttonNode.classList.toggle("active", buttonNode.dataset.adminMatchTypeTab === nextType);
  });

  renderMatchRows();
}

function resetMatchComposer() {
  if (matchTitleNode) matchTitleNode.value = "";
  if (matchTeamANode) matchTeamANode.value = "";
  if (matchTeamBNode) matchTeamBNode.value = "";
  if (matchScoreANode) matchScoreANode.value = "";
  if (matchScoreBNode) matchScoreBNode.value = "";
  if (matchCasualtiesANode) matchCasualtiesANode.value = "";
  if (matchCasualtiesBNode) matchCasualtiesBNode.value = "";
  if (matchDateNode) matchDateNode.value = new Date().toISOString().split('T')[0];
  if (matchMediaNode) matchMediaNode.value = "";
}

function renderMatchRows() {
  if (!matchRowsNode) return;
  matchRowsNode.innerHTML = "";

  const filtered = currentMatches.filter(m => m.type === activeMatchTypeTab);

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "admin-transfer-empty";
    empty.textContent = `No ${activeMatchTypeTab} matches added yet.`;
    matchRowsNode.append(empty);
    return;
  }

  filtered.forEach((match) => {
    const row = document.createElement("article");
    row.className = "admin-transfer-row";
    row.innerHTML = `
      <span>${safeText(match.title)}</span>
      <span style="font-size:0.8rem">${safeText(match.teamA)} vs ${safeText(match.teamB)}</span>
      <span>${match.type === 'finished' ? `${match.scoreA} - ${match.scoreB}` : 'TBD'}</span>
      <span style="font-size:0.75rem">${match.casualtiesA || 0} / ${match.casualtiesB || 0}</span>
      <span>${match.date}</span>
      <span class="admin-synced-actions">
        <button type="button" class="admin-button danger admin-match-delete">Remove</button>
      </span>
    `;

    row.querySelector(".admin-match-delete")?.addEventListener("click", () => {
      currentMatches = currentMatches.filter(m => m.id !== match.id);
      renderMatchRows();
      setSyncStatus("Match removed locally. Click Save Global Sync to publish.");
    });

    matchRowsNode.append(row);
  });
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

function setWebInsightsStatus(message, isError = false) {
  if (!webInsightsStatusNode) {
    return;
  }

  webInsightsStatusNode.textContent = message;
  webInsightsStatusNode.classList.toggle("error", isError);
}

function formatInsightDuration(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value < 0) {
    return "n/a";
  }

  return `${Math.round(value)} ms`;
}

function formatInsightBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) {
    return "n/a";
  }

  if (value < 1024) {
    return `${Math.round(value)} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let scaled = value / 1024;
  let index = 0;

  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024;
    index += 1;
  }

  return `${scaled.toFixed(1)} ${units[index]}`;
}

function safeStorageSize(storage) {
  try {
    return Number(storage?.length || 0);
  } catch {
    return 0;
  }
}

function getFactionCount(players) {
  const factions = new Set();

  (Array.isArray(players) ? players : []).forEach((player) => {
    const normalized = normalizeFactionValue(player?.faction || "N/A");

    normalized
      .split("/")
      .map((token) => String(token || "").trim().toUpperCase())
      .filter((token) => token && token !== "N/A")
      .forEach((token) => factions.add(token));
  });

  return factions.size;
}

function getMatchCountSummary() {
  const upcoming = (Array.isArray(currentMatches) ? currentMatches : []).filter(m => m.type === "upcoming").length;
  const finished = (Array.isArray(currentMatches) ? currentMatches : []).filter(m => m.type === "finished").length;
  return `${finished} finished / ${upcoming} upcoming`;
}

function getPerformanceInsightRows() {
  const navigationEntry = performance.getEntriesByType("navigation")[0] || null;
  const paintEntries = performance.getEntriesByType("paint");
  const firstPaintEntry = paintEntries.find((entry) => entry.name === "first-paint") || null;
  const firstContentfulPaintEntry = paintEntries.find((entry) => entry.name === "first-contentful-paint") || null;
  const heapMemory = performance?.memory || null;

  return [
    {
      label: "Navigation Type",
      value: navigationEntry?.type || "unknown"
    },
    {
      label: "DOM Interactive",
      value: formatInsightDuration(navigationEntry?.domInteractive)
    },
    {
      label: "DOM Complete",
      value: formatInsightDuration(navigationEntry?.domComplete)
    },
    {
      label: "Load Event End",
      value: formatInsightDuration(navigationEntry?.loadEventEnd)
    },
    {
      label: "First Paint",
      value: formatInsightDuration(firstPaintEntry?.startTime)
    },
    {
      label: "First Contentful Paint",
      value: formatInsightDuration(firstContentfulPaintEntry?.startTime)
    },
    {
      label: "JS Heap Used",
      value: formatInsightBytes(heapMemory?.usedJSHeapSize)
    }
  ];
}

function buildWebInsightCard(title, rows) {
  const rowMarkup = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      return `
        <div class="admin-insight-row">
          <span>${safeText(row?.label || "Metric")}</span>
          <strong>${safeText(row?.value || "n/a")}</strong>
        </div>
      `;
    })
    .join("");

  return `
    <article class="admin-insight-card">
      <h3>${safeText(title)}</h3>
      <div class="admin-insight-rows">${rowMarkup}</div>
    </article>
  `;
}

function buildWebInsightCards() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const isOnline = Boolean(navigator.onLine);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const languages = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages.join(", ")
    : (navigator.language || "unknown");

  const networkParts = [];
  if (connection?.effectiveType) {
    networkParts.push(`type ${String(connection.effectiveType).toUpperCase()}`);
  }

  if (Number.isFinite(Number(connection?.downlink))) {
    networkParts.push(`${Number(connection.downlink).toFixed(1)} Mbps`);
  }

  if (Number.isFinite(Number(connection?.rtt))) {
    networkParts.push(`${Math.round(Number(connection.rtt))} ms RTT`);
  }

  const hasManualOrder = Array.isArray(currentConfig?.order) && currentConfig.order.length > 0;
  const endpointRows = cachedEndpointInsights.length
    ? cachedEndpointInsights.map((item) => ({
      label: item.label,
      value: `${item.statusLabel} | ${item.latencyLabel}`
    }))
    : [{
      label: "Diagnostics",
      value: "Not probed yet"
    }];

  return [
    {
      title: "Site Runtime",
      rows: [
        { label: "Path", value: window.location.pathname || "/" },
        { label: "Host", value: window.location.host || "unknown" },
        { label: "Protocol", value: window.location.protocol === "https:" ? "HTTPS" : "HTTP" },
        { label: "Online", value: isOnline ? "Yes" : "No" },
        { label: "Local Time", value: new Date().toLocaleString() },
        { label: "Timezone", value: timezone }
      ]
    },
    {
      title: "Browser and Device",
      rows: [
        { label: "Platform", value: navigator.userAgentData?.platform || navigator.platform || "unknown" },
        { label: "Languages", value: languages },
        { label: "Viewport", value: `${window.innerWidth}x${window.innerHeight}` },
        { label: "Screen", value: `${window.screen?.width || "?"}x${window.screen?.height || "?"}` },
        { label: "Cookies Enabled", value: navigator.cookieEnabled ? "Yes" : "No" },
        { label: "Touch Points", value: String(Number(navigator.maxTouchPoints || 0)) },
        { label: "Connection", value: networkParts.join(" | ") || "Unavailable" }
      ]
    },
    {
      title: "Content Snapshot",
      rows: [
        { label: "Roster Players", value: String(currentPlayers.length) },
        { label: "Admin Synced Extras", value: String(currentExtraPlayers.length) },
        { label: "Transfers", value: String(currentTransfers.length) },
        { label: "Matches", value: getMatchCountSummary() },
        { label: "Unique Factions", value: String(getFactionCount(currentPlayers)) },
        { label: "Sync Mode", value: hasManualOrder ? "Custom admin order" : "ELO-ranked" },
        { label: "Last Global Sync", value: formatSyncTime(currentConfig?.updatedAt) }
      ]
    },
    {
      title: "Performance",
      rows: getPerformanceInsightRows()
    },
    {
      title: "Storage",
      rows: [
        { label: "Local Storage Keys", value: String(safeStorageSize(window.localStorage)) },
        { label: "Session Storage Keys", value: String(safeStorageSize(window.sessionStorage)) },
        { label: "Admin Token Present", value: getStoredToken() ? "Yes" : "No" }
      ]
    },
    {
      title: "Endpoint Diagnostics",
      rows: endpointRows
    }
  ];
}

function renderWebInsights() {
  if (!webInsightsGridNode) {
    return;
  }

  webInsightsGridNode.innerHTML = buildWebInsightCards()
    .map((card) => buildWebInsightCard(card.title, card.rows))
    .join("");
}

function buildWebInsightsExportPayload() {
  const cards = buildWebInsightCards().map((card) => ({
    title: String(card?.title || "Section"),
    rows: (Array.isArray(card?.rows) ? card.rows : []).map((row) => ({
      label: String(row?.label || "Metric"),
      value: String(row?.value || "n/a")
    }))
  }));

  return {
    generatedAt: new Date().toISOString(),
    page: {
      path: window.location.pathname || "/",
      host: window.location.host || "unknown",
      href: window.location.href || ""
    },
    summary: {
      players: currentPlayers.length,
      syncedExtraPlayers: currentExtraPlayers.length,
      transfers: currentTransfers.length,
      clips: currentClips.length,
      lastGlobalSync: currentConfig?.updatedAt || null
    },
    endpointDiagnostics: Array.isArray(cachedEndpointInsights) ? cachedEndpointInsights : [],
    cards
  };
}

function downloadInsightsJson(payload) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `admin-web-insights-${timestamp}.json`;
  const data = `${JSON.stringify(payload, null, 2)}\n`;
  const blob = new Blob([data], { type: "application/json;charset=utf-8" });
  const blobUrl = window.URL.createObjectURL(blob);

  const linkNode = document.createElement("a");
  linkNode.href = blobUrl;
  linkNode.download = fileName;
  linkNode.rel = "noreferrer";
  document.body.append(linkNode);
  linkNode.click();
  linkNode.remove();
  window.URL.revokeObjectURL(blobUrl);

  return fileName;
}

async function onExportInsightsClick() {
  if (!cachedEndpointInsights.length) {
    await refreshWebInsights({ probeEndpoints: true });
  }

  try {
    const payload = buildWebInsightsExportPayload();
    const fileName = downloadInsightsJson(payload);
    setWebInsightsStatus(`Insights exported: ${fileName}`);
  } catch {
    setWebInsightsStatus("Failed to export insights JSON.", true);
  }
}

function formatEndpointProbeLabel(statusCode) {
  if (!Number.isFinite(statusCode) || statusCode <= 0) {
    return "unreachable";
  }

  if (statusCode >= 200 && statusCode < 300) {
    return `ok (${statusCode})`;
  }

  if (statusCode === 401 || statusCode === 403) {
    return `auth required (${statusCode})`;
  }

  if (statusCode === 405) {
    return `reachable (${statusCode})`;
  }

  if (statusCode >= 500) {
    return `server error (${statusCode})`;
  }

  return `http ${statusCode}`;
}

async function probeInsightEndpoint(endpoint, token) {
  const startedAt = performance.now();
  const headers = {
    Accept: "application/json,text/plain,*/*"
  };

  if (endpoint.requiresAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(endpoint.url, {
      method: endpoint.method || "GET",
      cache: "no-store",
      headers
    });

    const elapsed = performance.now() - startedAt;
    return {
      label: endpoint.label,
      statusCode: response.status,
      statusLabel: formatEndpointProbeLabel(response.status),
      latencyLabel: formatInsightDuration(elapsed)
    };
  } catch {
    const elapsed = performance.now() - startedAt;
    return {
      label: endpoint.label,
      statusCode: 0,
      statusLabel: "unreachable",
      latencyLabel: formatInsightDuration(elapsed)
    };
  }
}

async function probeWebInsightEndpoints() {
  const token = getStoredToken();
  const endpoints = [
    { label: "Web sync config", url: ADMIN_WEB_SYNC_ENDPOINT, method: "GET", requiresAuth: false },
    { label: "Admin login", url: LOGIN_ENDPOINT, method: "GET", requiresAuth: false },
    { label: "Admin config", url: ADMIN_CONFIG_ENDPOINT, method: "GET", requiresAuth: true },
    { label: "Bot event", url: BOT_EVENT_ENDPOINT, method: "GET", requiresAuth: true },
    { label: "Roster source", url: "discordlink", method: "GET", requiresAuth: false },
    { label: "News file new.txt", url: "new.txt", method: "GET", requiresAuth: false },
    { label: "News file news.txt", url: "news.txt", method: "GET", requiresAuth: false }
  ];

  return Promise.all(endpoints.map((endpoint) => probeInsightEndpoint(endpoint, token)));
}

async function refreshWebInsights(options = {}) {
  const shouldProbeEndpoints = options.probeEndpoints !== false;
  renderWebInsights();

  if (!shouldProbeEndpoints) {
    setWebInsightsStatus(`Insights updated at ${new Date().toLocaleTimeString()}.`);
    return;
  }

  if (insightsRefreshInFlight) {
    setWebInsightsStatus("Insights refresh already in progress.");
    return;
  }

  insightsRefreshInFlight = true;
  setWebInsightsStatus("Refreshing endpoint diagnostics...");

  try {
    cachedEndpointInsights = await probeWebInsightEndpoints();
    renderWebInsights();
    setWebInsightsStatus(`Insights refreshed at ${new Date().toLocaleTimeString()}.`);
  } catch {
    setWebInsightsStatus("Failed to refresh endpoint diagnostics.", true);
  } finally {
    insightsRefreshInFlight = false;
  }
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
    const elo = Number(player.elo) || 1000;
    const wins = Number(player.wins) || 0;
    const losses = Number(player.losses) || 0;
    lines.push(`#${index + 1} ${player.name} | ${faction} | ${country} | ELO ${elo} | W/L ${wins}/${losses}`);
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
    const elo = Number(player.elo) || 1000;
    const wins = Number(player.wins) || 0;
    const losses = Number(player.losses) || 0;

    return `
      <article class="admin-weekly-podium-card rank-${rank}">
        <span class="admin-weekly-rank">#${rank}</span>
        <img class="admin-weekly-avatar" src="${avatarUrl}" alt="${safeText(player.name)} avatar" loading="lazy" referrerpolicy="no-referrer">
        <h3>${safeText(player.name)}</h3>
        <div class="admin-weekly-faction-wrap">${factionMarkup}</div>
        <p>${countryToFlag(player.country)} ${safeText(player.country || "N/A")}</p>
        <div class="admin-weekly-stats">
          <span>ELO ${elo}</span>
          <span>W/L ${wins}/${losses}</span>
        </div>
      </article>
    `;
  }).join("");

  const rowsMarkup = lowerRanks.map((player) => {
    const rank = Number(player.weeklyRank);
    const avatarUrl = getStaticAvatarUrl(player.userId) || getFallbackAvatarUrl(player.name);
    const factionMarkup = buildWeeklyFactionMarkup(player.faction);
    const elo = Number(player.elo) || 1000;
    const wins = Number(player.wins) || 0;
    const losses = Number(player.losses) || 0;

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
          <span>ELO ${elo}</span>
          <span>W/L ${wins}/${losses}</span>
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

  if (activeTab === "insights") {
    if (!cachedEndpointInsights.length) {
      refreshWebInsights({ probeEndpoints: true });
      return;
    }

    renderWebInsights();
    setWebInsightsStatus("Showing cached insights. Click Refresh Insights to probe endpoints again.");
  }
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
    clips: [],
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

function buildLevelOptions(selectedElo) {
  const options = [];
  [1000, 1200, 1500, 2000, 2500, 3000].forEach(elo => {
    const selected = (Number(selectedElo) || 1000) === elo ? " selected" : "";
    options.push(`<option value="${elo}"${selected}>ELO ${elo}</option>`);
  });
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

  const maxRank = Math.max(1, players.length);

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
        <input class="admin-rank-input" type="number" min="1" max="${maxRank}" value="${index + 1}" aria-label="Set rank for ${safeText(player.name)}">
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
        <input class="admin-elo-input" data-player-key="${safeText(player.key)}" type="number" value="${player.elo || 1000}">
      </span>
      <span>
        <input class="admin-wins-input" data-player-key="${safeText(player.key)}" type="number" value="${player.wins || 0}">
      </span>
      <span>
        <input class="admin-losses-input" data-player-key="${safeText(player.key)}" type="number" value="${player.losses || 0}">
      </span>
      <span class="admin-row-action">
        ${player.isExtra
          ? '<button type="button" class="admin-button danger admin-row-remove-btn">Remove</button>'
          : '<span class="admin-status">Core</span>'}
      </span>
    `;

    const avatarNode = row.querySelector(".admin-avatar");
    const dragHandleNode = row.querySelector(".admin-drag-handle");
    const rankInputNode = row.querySelector(".admin-rank-input");
    avatarNode.addEventListener("error", () => {
      avatarNode.src = fallback;
    });
    hydrateAvatarNode(avatarNode, player);

    const applyRankInputOrder = () => {
      if (!rankInputNode) {
        return;
      }

      const requestedRank = Number.parseInt(String(rankInputNode.value || ""), 10);
      const targetRank = Number.isFinite(requestedRank)
        ? Math.max(1, Math.min(maxRank, requestedRank))
        : index + 1;

      rankInputNode.value = String(targetRank);

      syncCurrentPlayersFromDom();
      const currentIndex = currentPlayers.findIndex((entry) => entry.key === player.key);
      if (currentIndex < 0) {
        return;
      }

      const destinationIndex = targetRank - 1;
      if (destinationIndex === currentIndex) {
        return;
      }

      const [moved] = currentPlayers.splice(currentIndex, 1);
      currentPlayers.splice(destinationIndex, 0, moved);
      renderRows(currentPlayers);
      renderWeeklyTopTenPreview();
      setSyncStatus("Rank updated locally. Click Save Global Sync to publish.");
    };

    rankInputNode?.addEventListener("change", applyRankInputOrder);
    rankInputNode?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      applyRankInputOrder();
    });

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
        elo: clampElo(override.elo ?? defaults.elo),
        wins: Number(override.wins ?? defaults.wins) || 0,
        losses: Number(override.losses ?? defaults.losses) || 0,
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
      elo: next ? next.elo : player.elo,
      wins: next ? next.wins : player.wins,
      losses: next ? next.losses : player.losses
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
      elo: next.elo,
      wins: next.wins,
      losses: next.losses
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

    const eloNode = row.querySelector(".admin-elo-input");
    const winsNode = row.querySelector(".admin-wins-input");
    const lossesNode = row.querySelector(".admin-losses-input");

    const faction = normalizeFactionValue(factionNode ? factionNode.value : "N/A");
    const classes = normalizePlayerClassList(
      classNodes.length
        ? classNodes.map((node) => node.value)
        : String(row.dataset.playerClasses || "").split("|")
    );
    const playerClass = classes[0] || "Unknown";
    const device = normalizeDeviceValue(deviceNode ? deviceNode.value : row.dataset.playerDevice);
    const elo = Number(eloNode ? eloNode.value : 1000) || 1000;
    const wins = Number(winsNode ? winsNode.value : 0) || 0;
    const losses = Number(lossesNode ? lossesNode.value : 0) || 0;

    result[key] = { faction, class: playerClass, classes, elo, wins, losses, device };
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
    currentMatches = config?.matches || (Array.isArray(config?.clips) ? config.clips.map(c => ({ id: c.id, title: c.title, teamA: c.player || 'COMMUNITY', teamB: 'N/A', type: 'finished', date: new Date().toISOString().split('T')[0] })) : []);
    renderRows(currentPlayers);
    renderTransferRows(currentTransfers);
    renderSyncedPlayerRows(currentExtraPlayers);
    renderMatchRows();
    renderAdminNewsFeed(currentPlayers);
    renderBotSettings(config);
    renderWeeklyTopTenPreview();
    renderWebInsights();

    const hasManualOrder = Array.isArray(config?.order) && config.order.length > 0;
    const modeText = hasManualOrder
      ? "Mode: custom admin order"
      : "Mode: ELO ranked";

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
    currentClips = collectClipValues();
    const saveResult = await saveAdminConfig(token, {
      players,
      order,
      extraPlayers: currentExtraPlayers,
      transfers: currentTransfers,
      clips: currentClips
    });
    const saved = saveResult.config;
    currentConfig = saved;
    currentExtraPlayers = normalizeExtraPlayers(saved?.extraPlayers);
    const mergedRosterPlayers = buildMergedRosterPlayers(currentRosterLines, currentExtraPlayers);
    currentPlayers = mergePlayersWithConfig(mergedRosterPlayers, saved, currentExtraPlayers);
    currentTransfers = normalizeTransfers(saved?.transfers);
    currentClips = normalizeClips(saved?.clips);
    renderRows(currentPlayers);
    renderTransferRows(currentTransfers);
    renderSyncedPlayerRows(currentExtraPlayers);
    renderClipRows();
    renderAdminNewsFeed(currentPlayers);
    renderWeeklyTopTenPreview();
    renderWebInsights();

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

  const editTarget = editingSyncedPlayerId
    ? currentExtraPlayers.find((item) => item.id === editingSyncedPlayerId)
    : null;

  if (editingSyncedPlayerId && !editTarget) {
    resetSyncedPlayerInputs();
    setSyncStatus("Edit target no longer exists. Please try again.", true);
    return;
  }

  const existingKey = playerName.toLowerCase();
  const editPlayerKey = String(editTarget?.name || "").trim().toLowerCase();
  if (currentPlayers.some((player) => {
    const playerKey = String(player?.name || "").trim().toLowerCase();
    return playerKey === existingKey && (!editTarget || playerKey !== editPlayerKey);
  })) {
    setSyncStatus("That player already exists in the roster sync list.", true);
    return;
  }

  const chosenClasses = normalizePlayerClassList([
    newPlayerClassPrimaryNode?.value,
    newPlayerClassSecondaryNode?.value,
    newPlayerClassTertiaryNode?.value
  ]);

  let resolvedUserId = normalizeUserIdInput(newPlayerUserIdNode?.value);
  if (!resolvedUserId) {
    resolvedUserId = await resolveRobloxUserIdByUsername(playerName);
    if (resolvedUserId && newPlayerUserIdNode) {
      newPlayerUserIdNode.value = resolvedUserId;
    }
  }

  const nextEntry = normalizeExtraPlayerEntry({
    id: editTarget?.id || `extra-player-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
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

  if (editTarget) {
    currentExtraPlayers = currentExtraPlayers.map((item) => {
      if (item.id !== editTarget.id) {
        return item;
      }

      return nextEntry;
    });
  } else {
    currentExtraPlayers = [...currentExtraPlayers, nextEntry];
  }

  const mergedRosterPlayers = buildMergedRosterPlayers(currentRosterLines, currentExtraPlayers);
  currentPlayers = mergePlayersWithConfig(mergedRosterPlayers, currentConfig, currentExtraPlayers);
  renderRows(currentPlayers);
  renderSyncedPlayerRows(currentExtraPlayers);
  renderTransferRows(currentTransfers);
  renderAdminNewsFeed(currentPlayers);
  renderWeeklyTopTenPreview();
  renderWebInsights();

  if (resolvedUserId) {
    fetchDynamicAvatarUrlForUserId(resolvedUserId).catch(() => {});
  }

  let dmStatusSuffix = "";
  if (!editTarget && addPlayerSendDmNode?.checked) {
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
    setAddPlayerDmStatus(editTarget
      ? "Player updated locally. DM is only sent on new adds."
      : "DM on add is disabled.");
  }

  resetSyncedPlayerInputs();
  setSyncStatus(`${editTarget ? "Synced player updated" : "Synced player added"} locally. Click Save Global Sync to publish.${dmStatusSuffix}`);
}

function onClearSyncedPlayerInputsClick() {
  const wasEditing = Boolean(editingSyncedPlayerId);
  resetSyncedPlayerInputs();
  setSyncStatus(wasEditing ? "Edit canceled and fields were cleared." : "Add Player fields were cleared.");
}

function onAddTransferClick() {
  currentTransfers = [...currentTransfers, createBlankTransfer()];
  renderTransferRows(currentTransfers);
  renderWebInsights();
  setSyncStatus("Transfer added locally. Click Save Global Sync to publish.");
}

function onPostMatchClick() {
  const title = String(matchTitleNode?.value || "").trim();
  const teamA = String(matchTeamANode?.value || "").trim().toUpperCase();
  const teamB = String(matchTeamBNode?.value || "").trim().toUpperCase();

  if (!title || !teamA || !teamB) {
    setSyncStatus("Title and teams are required.", true);
    return;
  }

  const match = {
    id: `match-${Date.now()}`,
    type: activeMatchTypeTab,
    title,
    teamA,
    teamB,
    scoreA: parseInt(matchScoreANode?.value) || 0,
    scoreB: parseInt(matchScoreBNode?.value) || 0,
    casualtiesA: parseInt(matchCasualtiesANode?.value) || 0,
    casualtiesB: parseInt(matchCasualtiesBNode?.value) || 0,
    date: matchDateNode?.value || new Date().toISOString().split('T')[0],
    mediaUrl: matchMediaNode?.value || ""
  };

  currentMatches = [...currentMatches, match];
  renderMatchRows();
  resetMatchComposer();
  setSyncStatus("Match history entry added locally. Click Save Global Sync to publish.");
}

function renderMatchRosters() {
  const rosterA = document.getElementById("matchTeamARoster");
  const rosterB = document.getElementById("matchTeamBRoster");
  if (!rosterA || !rosterB) return;

  const renderRoster = (roster, team, teamLabel) => {
    roster.innerHTML = team.map(player => `
      <div class="match-player-row">
        <span class="match-player-name">${safeText(player.name)}</span>
        <input type="number" class="match-player-score" value="${player.score || 0}" data-team="${teamLabel}" data-player="${safeText(player.name)}" placeholder="Score">
        <button class="match-player-remove" data-team="${teamLabel}" data-player="${safeText(player.name)}">&times;</button>
      </div>
    `).join("");

    roster.querySelectorAll(".match-player-score").forEach(input => {
      input.addEventListener("change", (e) => {
        const p = team.find(pl => pl.name === e.target.dataset.player);
        if (p) p.score = parseInt(e.target.value) || 0;
      });
    });

    roster.querySelectorAll(".match-player-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const playerName = e.target.dataset.player;
        if (teamLabel === "A") {
          matchTeamARoster = matchTeamARoster.filter(p => p.name !== playerName);
        } else {
          matchTeamBRoster = matchTeamBRoster.filter(p => p.name !== playerName);
        }
        renderMatchRosters();
      });
    });
  };

  renderRoster(rosterA, matchTeamARoster, "A");
  renderRoster(rosterB, matchTeamBRoster, "B");
}

function setupMatchSearch() {
  const setupSearch = (inputId, suggestionsId, teamLabel) => {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    if (!input || !suggestions) return;

    input.addEventListener("input", (e) => {
      const val = e.target.value.toLowerCase().trim();
      if (!val) {
        suggestions.classList.add("hidden");
        return;
      }

      const matches = currentPlayers
        .filter(p => p.name.toLowerCase().includes(val))
        .filter(p => !matchTeamARoster.some(r => r.name === p.name))
        .filter(p => !matchTeamBRoster.some(r => r.name === p.name))
        .slice(0, 5);

      if (matches.length === 0) {
        suggestions.classList.add("hidden");
        return;
      }

      suggestions.innerHTML = matches.map(p => `
        <div class="search-suggestion-item" data-name="${safeText(p.name)}">${safeText(p.name)}</div>
      `).join("");
      suggestions.classList.remove("hidden");

      suggestions.querySelectorAll(".search-suggestion-item").forEach(item => {
        item.addEventListener("click", () => {
          const playerName = item.dataset.name;
          const playerObj = { name: playerName, score: 0 };
          if (teamLabel === "A") matchTeamARoster.push(playerObj);
          else matchTeamBRoster.push(playerObj);
          
          input.value = "";
          suggestions.classList.add("hidden");
          renderMatchRosters();
        });
      });
    });

    // Close suggestions on blur
    input.addEventListener("blur", () => {
      setTimeout(() => suggestions.classList.add("hidden"), 200);
    });
  };

  setupSearch("matchTeamASearch", "matchTeamASuggestions", "A");
  setupSearch("matchTeamBSearch", "matchTeamBSuggestions", "B");
}

async function onSaveMatchClick() {
  const token = getStoredToken();
  if (!token) {
    setSyncStatus("Not signed in.", true);
    return;
  }

  const winner = document.querySelector('input[name="matchWinner"]:checked')?.value;
  const statusNode = document.getElementById("matchEntryStatus");

  if (matchTeamARoster.length < 10 || matchTeamBRoster.length < 10) {
    if (statusNode) statusNode.textContent = "Error: Each team needs at least 10 players.";
    return;
  }

  if (!winner) {
    if (statusNode) statusNode.textContent = "Error: Please select a winner (Team A or B).";
    return;
  }

  if (statusNode) statusNode.textContent = "Calculating ELO changes and saving...";

  try {
    const response = await requestJson(MATCH_CALCULATE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        teamA: matchTeamARoster,
        teamB: matchTeamBRoster,
        winner,
        usePerformanceScaling: true
      })
    });

    if (!response.ok) {
      throw new Error(response.data?.error || "Match calculation failed.");
    }

    if (statusNode) statusNode.textContent = "Match saved! ELO ratings updated.";
    
    // Clear rosters
    matchTeamARoster = [];
    matchTeamBRoster = [];
    document.querySelectorAll('input[name="matchWinner"]').forEach(r => r.checked = false);
    renderMatchRosters();

    // Reload all data to show updated ELOs
    await loadPanelData();
  } catch (error) {
    if (statusNode) statusNode.textContent = "Error: " + error.message;
  }
}

function setupMatchTypeTabs() {
  if (!matchTypeTabButtonNodes.length) {
    return;
  }

  matchTypeTabButtonNodes.forEach((buttonNode) => {
    buttonNode.addEventListener("click", () => {
      setActiveMatchTypeTab(buttonNode.dataset.adminMatchTypeTab || "finished");
    });
  });

  setActiveMatchTypeTab(activeMatchTypeTab);
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
if (postMatchButtonNode) {
  postMatchButtonNode.addEventListener("click", onPostMatchClick);
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
if (document.getElementById("adminSaveMatchBtn")) {
  document.getElementById("adminSaveMatchBtn").addEventListener("click", onSaveMatchClick);
}
if (document.getElementById("adminClearMatchBtn")) {
  document.getElementById("adminClearMatchBtn").addEventListener("click", () => {
    matchTeamARoster = [];
    matchTeamBRoster = [];
    renderMatchRosters();
    const status = document.getElementById("matchEntryStatus");
    if (status) status.textContent = "Match cleared.";
  });
}
setupMatchSearch();
renderMatchRosters();
if (refreshInsightsButtonNode) {
  refreshInsightsButtonNode.addEventListener("click", () => {
    refreshWebInsights({ probeEndpoints: true });
  });
}
if (exportInsightsButtonNode) {
  exportInsightsButtonNode.addEventListener("click", onExportInsightsClick);
}
if (addPlayerSendDmNode) {
  addPlayerSendDmNode.addEventListener("change", () => {
    setAddPlayerDmStatus(addPlayerSendDmNode.checked
      ? "DM on add is enabled."
      : "DM on add is disabled.");
  });
}

window.addEventListener("online", () => refreshWebInsights({ probeEndpoints: false }));
window.addEventListener("offline", () => refreshWebInsights({ probeEndpoints: false }));
window.addEventListener("resize", () => renderWebInsights());

initializeAddPlayerDmTemplate();
setAddPlayerDmStatus(addPlayerSendDmNode?.checked
  ? "DM on add is enabled."
  : "DM on add is disabled.");
renderWebInsights();
setupAdminTabs();
setupMatchTypeTabs();
warnDirectAdminAccess();

if (getStoredToken()) {
  loadPanelData();
} else {
  setPanelVisible(false);
}
