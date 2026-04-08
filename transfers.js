const transferGridNode = document.getElementById("transferGrid");
const transferTickerTrackNode = document.getElementById("transferTickerTrack");
const transferMetricTotalNode = document.getElementById("transferMetricTotal");
const transferMetricOfficialNode = document.getElementById("transferMetricOfficial");
const transferMetricUpdatedNode = document.getElementById("transferMetricUpdated");

const TRANSFER_CONFIG_ENDPOINT = "/api/leaderboard-config";

function localEscape(value) {
  if (typeof escapeHtml === "function") {
    return escapeHtml(value);
  }

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function normalizeTransferFaction(faction) {
  if (typeof sanitizeFactionValue === "function") {
    return sanitizeFactionValue(faction);
  }

  const value = String(faction || "").trim().toUpperCase();
  if (!value) {
    return "N/A";
  }

  return value;
}

function normalizeTransfers(rawTransfers) {
  if (!Array.isArray(rawTransfers)) {
    return [];
  }

  return rawTransfers
    .map((entry, index) => {
      const item = entry && typeof entry === "object" ? entry : {};
      const playerName = String(item.playerName || "").trim();
      const fromFaction = normalizeTransferFaction(item.fromFaction || "N/A");
      const toFaction = normalizeTransferFaction(item.toFaction || "N/A");

      if (!playerName || fromFaction === "N/A" || toFaction === "N/A") {
        return null;
      }

      return {
        id: String(item.id || `transfer-${index}`).trim(),
        playerName,
        fromFaction,
        toFaction,
        fee: String(item.fee || "Undisclosed").trim() || "Undisclosed",
        transferDate: normalizeTransferDate(item.transferDate),
        status: normalizeTransferStatus(item.status),
        note: String(item.note || "").trim()
      };
    })
    .filter(Boolean);
}

function formatTransferDate(dateValue) {
  if (!dateValue) {
    return "Date TBA";
  }

  const parsed = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "Date TBA";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatSyncDate(dateValue) {
  if (!dateValue) {
    return "Never";
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleString();
}

function buildStatusLabel(status) {
  const safe = normalizeTransferStatus(status);
  return safe.charAt(0).toUpperCase() + safe.slice(1);
}

function buildFactionMarkup(faction) {
  if (typeof buildFactionChipHtml === "function") {
    return buildFactionChipHtml(faction, {
      chipClass: "transfer-faction-chip",
      maxItems: 1,
      includeGroupWrapper: true,
      groupClass: "transfer-faction-wrap"
    });
  }

  return `<span class="transfer-faction-chip">${localEscape(faction)}</span>`;
}

function buildEmptyTransferCard() {
  return `
    <article class="transfer-card transfer-card-empty">
      <h3>Transfer Desk Quiet</h3>
      <p>No transfer entries yet. Use Admin Transfer Center to add deals.</p>
    </article>
  `;
}

function getAvatarForPlayer(player, avatarMap) {
  if (!player) {
    return getFallbackAvatarUrl("Unknown");
  }

  return (
    avatarMap.get(Number(player.userId))
    || getStaticAvatarUrl(player.userId)
    || getFallbackAvatarUrl(player.name)
  );
}

function renderTicker(transfers) {
  if (!transferTickerTrackNode) {
    return;
  }

  if (!transfers.length) {
    transferTickerTrackNode.textContent = "Waiting for transfer updates...";
    return;
  }

  const tickerText = transfers
    .slice(0, 18)
    .map((item) => `${item.playerName}: ${item.fromFaction} -> ${item.toFaction} (${buildStatusLabel(item.status)})`)
    .join("  •  ");

  transferTickerTrackNode.innerHTML = `
    <span>${localEscape(tickerText)}</span>
    <span>${localEscape(tickerText)}</span>
  `;
}

function renderMetrics(transfers, updatedAt) {
  if (transferMetricTotalNode) {
    transferMetricTotalNode.textContent = String(transfers.length);
  }

  if (transferMetricOfficialNode) {
    transferMetricOfficialNode.textContent = String(transfers.filter((item) => item.status === "official").length);
  }

  if (transferMetricUpdatedNode) {
    transferMetricUpdatedNode.textContent = formatSyncDate(updatedAt);
  }
}

function renderTransferCards(transfers, rosterMap, avatarMap) {
  if (!transferGridNode) {
    return;
  }

  if (!transfers.length) {
    transferGridNode.innerHTML = buildEmptyTransferCard();
    return;
  }

  transferGridNode.innerHTML = transfers
    .map((item, index) => {
      const rosterPlayer = rosterMap.get(item.playerName.toLowerCase()) || null;
      const avatarUrl = getAvatarForPlayer(rosterPlayer, avatarMap);
      const country = rosterPlayer?.country || "N/A";
      const note = item.note || "No additional note.";
      const statusLabel = buildStatusLabel(item.status);
      const fromFactionMarkup = buildFactionMarkup(item.fromFaction);
      const toFactionMarkup = buildFactionMarkup(item.toFaction);

      return `
        <article class="transfer-card status-${item.status}" style="--transfer-delay:${index * 80}ms">
          <div class="transfer-card-head">
            <span class="transfer-status-pill">${localEscape(statusLabel)}</span>
            <span class="transfer-date">${localEscape(formatTransferDate(item.transferDate))}</span>
          </div>

          <div class="transfer-player-row">
            <img class="transfer-avatar" src="${localEscape(avatarUrl)}" alt="${localEscape(item.playerName)} avatar" loading="lazy" referrerpolicy="no-referrer">
            <div>
              <h3>${localEscape(item.playerName)}</h3>
              <p>${localEscape(countryToFlag(country))} ${localEscape(country)}</p>
            </div>
          </div>

          <div class="transfer-lane">
            <div class="transfer-faction-block transfer-faction-block-from">
              <span>From</span>
              ${fromFactionMarkup}
            </div>
            <span class="transfer-arrow" aria-hidden="true">-></span>
            <div class="transfer-faction-block transfer-faction-block-to">
              <span>To</span>
              ${toFactionMarkup}
            </div>
          </div>

          <div class="transfer-direction-strip" aria-hidden="true">
            <span class="transfer-direction transfer-direction-out">-> OUT</span>
            <span class="transfer-direction transfer-direction-in">-> IN</span>
          </div>

          <div class="transfer-meta-row">
            <strong>Fee:</strong>
            <span>${localEscape(item.fee)}</span>
          </div>

          <p class="transfer-note">${localEscape(note)}</p>
        </article>
      `;
    })
    .join("");
}

async function fetchTransferConfig() {
  try {
    const response = await fetch(TRANSFER_CONFIG_ENDPOINT, { cache: "no-store" });
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

async function initTransfersPage() {
  if (!transferGridNode) {
    return;
  }

  const [lines, config] = await Promise.all([
    loadPlayerLines(),
    fetchTransferConfig()
  ]);

  const roster = lines
    .map(parsePlayerLine)
    .filter(Boolean);

  const rosterMap = new Map(roster.map((player) => [player.name.toLowerCase(), player]));
  const transfers = normalizeTransfers(config?.transfers)
    .sort((a, b) => {
      const aDate = a.transferDate ? Date.parse(`${a.transferDate}T12:00:00Z`) : 0;
      const bDate = b.transferDate ? Date.parse(`${b.transferDate}T12:00:00Z`) : 0;
      return bDate - aDate;
    });

  const avatarUsers = transfers
    .map((item) => rosterMap.get(item.playerName.toLowerCase()))
    .filter(Boolean);

  const avatarMap = await fetchAvatarUrls(avatarUsers);

  renderTicker(transfers);
  renderMetrics(transfers, config?.updatedAt || "");
  renderTransferCards(transfers, rosterMap, avatarMap);
}

initTransfersPage();
