const ADMIN_TOKEN_KEY = "draxar-admin-token-v1";
const LOGIN_ENDPOINT = "/api/admin/login";
const ADMIN_CONFIG_ENDPOINT = "/api/admin/config";

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

let currentConfig = { version: 1, updatedAt: null, players: {} };
let currentPlayers = [];

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

  return result.data?.config || config;
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

function renderRows(players) {
  rowsNode.innerHTML = "";

  players.forEach((player) => {
    const row = document.createElement("article");
    row.className = "admin-row";
    row.dataset.playerKey = player.key;

    const avatarUrl = getStaticAvatarUrl(player.userId) || getFallbackAvatarUrl(player.name);
    const fallback = getFallbackAvatarUrl(player.name);
    const country = `${countryToFlag(player.country)} ${player.country}`;

    row.innerHTML = `
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
    avatarNode.addEventListener("error", () => {
      avatarNode.src = fallback;
    });

    rowsNode.append(row);
  });
}

function mergePlayersWithConfig(players, config) {
  return players
    .map((player) => {
      const key = player.name.toLowerCase();
      const override = config?.players?.[key] || {};
      const defaults = getDefaultStats(player.name);

      return {
        ...player,
        key,
        level: clampLevel(override.level ?? defaults.level),
        kd: clampKd(override.kd ?? defaults.kd)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
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

    setSyncStatus(`Loaded ${currentPlayers.length} Players. Last global sync: ${formatSyncTime(config.updatedAt)}.`);
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
    const players = collectRowValues();
    const saved = await saveAdminConfig(token, { players });
    currentConfig = saved;
    setSyncStatus(`Global sync saved. Updated: ${formatSyncTime(saved.updatedAt)}.`);
  } catch (error) {
    setSyncStatus(error instanceof Error ? error.message : "Save failed", true);
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

if (getStoredToken()) {
  loadPanelData();
} else {
  setPanelVisible(false);
}
