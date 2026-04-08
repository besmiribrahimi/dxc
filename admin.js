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
const reloadButtonNode = document.getElementById("adminReloadBtn");
const saveButtonNode = document.getElementById("adminSaveBtn");
const logoutButtonNode = document.getElementById("adminLogoutBtn");
const notifyIdsNode = document.getElementById("adminNotifyIds");
const notifyMessageNode = document.getElementById("adminNotifyMessage");
const sendNotifyButtonNode = document.getElementById("adminSendNotifyBtn");
const botOpsStatusNode = document.getElementById("adminBotOpsStatus");

let currentConfig = {
  version: 1,
  updatedAt: null,
  players: {},
  order: [],
  botSettings: {
    notificationUserIds: []
  }
};
let currentPlayers = [];
let draggingPlayerKey = "";
let draggingInitialized = false;

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

  return result.data?.config || { version: 1, updatedAt: null, players: {} };
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

function buildFactionMarkup(player) {
  if (typeof buildFactionChipHtml === "function") {
    return buildFactionChipHtml(player.faction, {
      chipClass: "admin-faction-chip",
      maxItems: 3,
      includeGroupWrapper: true,
      groupClass: "admin-faction-group"
    });
  }

  return `<span class="admin-faction-chip">${safeText(player.faction)}</span>`;
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
      <span class="admin-faction-cell">${buildFactionMarkup(player)}</span>
      <span class="admin-country">${safeText(country)}</span>
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

function mergePlayersWithConfig(players, config) {
  const merged = players.map((player, sourceIndex) => {
      const key = player.name.toLowerCase();
      const override = config?.players?.[key] || {};
      const defaults = getDefaultStats(player.name);

      return {
        ...player,
        sourceIndex,
        key,
        level: clampLevel(override.level ?? defaults.level),
        kd: clampKd(override.kd ?? defaults.kd)
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

    const levelNode = row.querySelector(".admin-level-select");
    const kdNode = row.querySelector(".admin-kd-input");

    const level = clampLevel(levelNode ? levelNode.value : 1);
    const kd = clampKd(kdNode ? kdNode.value : 1.0);

    result[key] = { level, kd };
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

    const parsedPlayers = lines
      .map(parsePlayerLine)
      .filter(Boolean);

    currentConfig = config;
    currentPlayers = mergePlayersWithConfig(parsedPlayers, config);
    renderRows(currentPlayers);
    renderBotSettings(config);

    const hasManualOrder = Array.isArray(config?.order) && config.order.length > 0;
    const modeText = hasManualOrder
      ? "Mode: custom admin order"
      : "Mode: leaderboard rank (Level only, K/D ignored)";

    setSyncStatus(`Loaded ${currentPlayers.length} Players. ${modeText}. Drag with the :: handle to reorder. Last global sync: ${formatSyncTime(config.updatedAt)}.`);
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
    const saveResult = await saveAdminConfig(token, { players, order });
    const saved = saveResult.config;
    currentConfig = saved;
    currentPlayers = mergePlayersWithConfig(currentPlayers, saved);
    renderRows(currentPlayers);

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
      setBotOpsStatus(`${result.data?.error || "Failed to dispatch bot notification."}${details}`, true);
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

loginFormNode.addEventListener("submit", onLoginSubmit);
reloadButtonNode.addEventListener("click", loadPanelData);
saveButtonNode.addEventListener("click", onSaveClick);
logoutButtonNode.addEventListener("click", onLogoutClick);
if (sendNotifyButtonNode) {
  sendNotifyButtonNode.addEventListener("click", onSendNotifyClick);
}

if (getStoredToken()) {
  loadPanelData();
} else {
  setPanelVisible(false);
}
