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
const syncedPlayerRowsNode = document.getElementById("adminSyncedPlayerRows");
const notifyIdsNode = document.getElementById("adminNotifyIds");
const notifyMessageNode = document.getElementById("adminNotifyMessage");
const sendNotifyButtonNode = document.getElementById("adminSendNotifyBtn");
const botOpsStatusNode = document.getElementById("adminBotOpsStatus");

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
      <span>${safeText(entry.country)}</span>
      <span>${safeText(entry.discordId || "-")}</span>
      <span>${safeText(entry.userId || "Auto")}</span>
      <span>${safeText(entry.device)}</span>
      <span>Admin Sync</span>
      <span><button type="button" class="admin-button danger admin-synced-player-delete">Remove</button></span>
    `;

    const removeNode = row.querySelector(".admin-synced-player-delete");
    removeNode?.addEventListener("click", () => {
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

      currentExtraPlayers = currentExtraPlayers.filter((item) => item.id !== row.dataset.syncedPlayerId);
      const mergedRosterPlayers = buildMergedRosterPlayers(currentRosterLines, currentExtraPlayers);
      currentPlayers = mergePlayersWithConfig(mergedRosterPlayers, currentConfig, currentExtraPlayers);
      renderRows(currentPlayers);
      renderSyncedPlayerRows(currentExtraPlayers);
      renderTransferRows(currentTransfers);
      renderAdminNewsFeed(currentPlayers);
      setSyncStatus("Synced player removed locally. Click Save Global Sync to publish.");
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

    const avatarUrl = getStaticAvatarUrl(player.userId) || getFallbackAvatarUrl(player.name);
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
    `;

    const avatarNode = row.querySelector(".admin-avatar");
    const dragHandleNode = row.querySelector(".admin-drag-handle");
    avatarNode.addEventListener("error", () => {
      avatarNode.src = fallback;
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
      setSyncStatus("Order updated locally. Click Save Global Sync to publish.");
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

function onAddSyncedPlayerClick() {
  const nextEntry = normalizeExtraPlayerEntry({
    id: `extra-player-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: newPlayerNameNode?.value,
    faction: newPlayerFactionNode?.value,
    country: newPlayerCountryNode?.value,
    discordId: newPlayerDiscordIdNode?.value,
    userId: newPlayerUserIdNode?.value,
    device: newPlayerDeviceNode?.value
  });

  if (!nextEntry.name) {
    setSyncStatus("Enter a player username before adding.", true);
    return;
  }

  if (nextEntry.country === "N/A") {
    setSyncStatus("Enter a country for the synced player.", true);
    return;
  }

  const key = nextEntry.name.toLowerCase();
  if (currentPlayers.some((player) => String(player?.name || "").trim().toLowerCase() === key)) {
    setSyncStatus("That player already exists in the roster sync list.", true);
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
  resetSyncedPlayerInputs();
  setSyncStatus("Synced player added locally. Click Save Global Sync to publish.");
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

if (getStoredToken()) {
  loadPanelData();
} else {
  setPanelVisible(false);
}
