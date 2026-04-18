/* ═══════════════════════════════════════════════════════════════
   match-history.js — Premium Match History with Hero Spotlight
   ═══════════════════════════════════════════════════════════════ */

const MATCHES_CONFIG_ENDPOINT = "/api/leaderboard-config";
const upcomingGridNode = document.getElementById("upcomingMatchesGrid");
const finishedGridNode = document.getElementById("finishedMatchesGrid");
const matchesStatusNode = document.getElementById("matchesStatus");
const heroSpotlightNode = document.getElementById("matchHeroSpotlight");
const statsSummaryNode = document.getElementById("matchStatsSummary");
const upcomingSectionNode = document.getElementById("matchesUpcomingSection");
const finishedSectionNode = document.getElementById("matchesFinishedSection");
const countUpcomingNode = document.getElementById("matchCountUpcoming");
const countFinishedNode = document.getElementById("matchCountFinished");

let countdownIntervalId = null;

/* ── Faction Flag Lookup ── */
const localFactionFlagMap = {
  "72ND": "faction_flags/72ND.png",
  "AEF": "faction_flags/AEF.png",
  "AH": "faction_flags/AH.png",
  "ASHEN GUARD": "faction_flags/ASHEN GUARD.png",
  "BS": "faction_flags/BS.png",
  "CZSK": "faction_flags/CZSK.png",
  "CSZK": "faction_flags/CZSK.png",
  "DK": "faction_flags/DK.png",
  "DSA": "faction_flags/DSA.png",
  "IA": "faction_flags/IA.png",
  "INS": "faction_flags/INS.png",
  "KOC": "faction_flags/KOC.png",
  "NDV": "faction_flags/NDV.png",
  "NYS": "faction_flags/NYS.png",
  "RRF": "faction_flags/RRF.png",
  "SR": "faction_flags/SR.png",
  "SEM": "faction_flags/SEM.png",
  "TAE": "faction_flags/TAE.png",
  "TCL": "faction_flags/TCL.png",
  "TIO": "faction_flags/TIO.png",
  "TTI": "faction_flags/tti.png",
  "TWA": "faction_flags/TWA.png",
  "URF": "faction_flags/URF.png",
  "TSC": "faction_flags/TSC.png",
  "HKB": "faction_flags/DK.png",
  "SCYTHIA": "faction_flags/SR.png",
  "SERMETYA": "faction_flags/SR.png",
  "LGR": "faction_flags/NDV.png",
  "CG": "faction_flags/DK.png"
};

function getFlagPath(faction) {
  if (typeof window.getFactionFlagPath === "function") {
    const result = window.getFactionFlagPath(faction);
    if (result) return result;
  }
  const key = String(faction || "").trim().toUpperCase();
  return localFactionFlagMap[key] || "";
}

function safeHtml(text) {
  if (typeof window.escapeHtml === "function") return window.escapeHtml(text);
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

/* ── Data Fetching ── */
async function fetchMatchData() {
  try {
    if (window.globalDataPromise) await window.globalDataPromise;

    const response = await fetch(MATCHES_CONFIG_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch");
    const data = await response.json();
    const remoteMatches = data?.config?.matches || data?.matches || [];

    const localUpcoming = [
      {
        id: "match-ndv-aef-2026",
        type: "upcoming",
        title: "NDV vs AEF",
        teamA: "NDV",
        teamB: "AEF",
        date: "2026-04-25T19:00:00Z",
        map: "Champagne",
        rally: "12v12 ext. 15v15",
        region: "EU (London)",
        details: "Host: NDV | Standard rules"
      },
      {
        id: "match-ah-dk-2026",
        type: "upcoming",
        title: "AH Jagdkommando vs DK",
        teamA: "AH",
        teamB: "DK",
        date: "2026-05-10T19:00:00Z",
        map: "Dobro Pole",
        rally: "20v20",
        region: "Virginia",
        details: "Host: DK"
      },
      {
        id: "match-ndv-lgr-2026",
        type: "upcoming",
        title: "NDV vs LGR",
        teamA: "NDV",
        teamB: "LGR",
        date: "2026-04-19T19:00:00Z",
        map: "Champagne",
        rally: "12v12 ext. 15v15",
        region: "EU (London)",
        details: "Host: NDV"
      }
    ];

    const allMatches = [...remoteMatches];
    localUpcoming.forEach(m => {
      if (!allMatches.some(am => am.id === m.id)) {
        allMatches.push(m);
      }
    });

    return allMatches;
  } catch (err) {
    console.error("Match fetch error:", err);
    return [
      {
        id: "match-ndv-aef-2026",
        type: "upcoming",
        title: "NDV vs AEF",
        teamA: "NDV",
        teamB: "AEF",
        date: "2026-04-25T19:00:00Z",
        map: "Champagne",
        rally: "12v12 ext. 15v15",
        region: "EU (London)"
      }
    ];
  }
}

/* ── Build Faction Flag HTML ── */
function buildFlagImg(faction, size = 44) {
  const path = getFlagPath(faction);
  if (path) {
    return `<img src="${path}" alt="${safeHtml(faction)} flag" width="${size}" height="${size}" loading="lazy" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;">`;
  }
  return `<span class="team-flag-placeholder">⚔️</span>`;
}

/* ══════════════════════════════════════════
   HERO SPOTLIGHT — Next Upcoming Match
   ══════════════════════════════════════════ */
function renderHeroSpotlight(match) {
  if (!heroSpotlightNode || !match) {
    if (heroSpotlightNode) heroSpotlightNode.innerHTML = "";
    return;
  }

  const dateObj = new Date(match.date);
  const dateStr = dateObj.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const timeStr = dateObj.toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", timeZoneName: "short"
  });

  heroSpotlightNode.innerHTML = `
    <div class="match-hero-spotlight">
      <div class="match-hero-badge">
        <span class="hero-pulse-dot"></span>
        NEXT BATTLE
      </div>

      <div class="match-hero-scoreboard">
        <div class="match-hero-team team-left">
          <div class="hero-team-flag">${buildFlagImg(match.teamA, 72)}</div>
          <span class="hero-team-name">${safeHtml(match.teamA)}</span>
          <span class="hero-team-sub">❤️ Team A</span>
        </div>

        <div class="match-hero-center">
          <span class="hero-vs-text">VS</span>
        </div>

        <div class="match-hero-team team-right">
          <div class="hero-team-flag">${buildFlagImg(match.teamB, 72)}</div>
          <span class="hero-team-name">${safeHtml(match.teamB)}</span>
          <span class="hero-team-sub">💙 Team B</span>
        </div>
      </div>

      <div class="match-countdown" id="heroCountdown">
        <div class="countdown-unit">
          <span class="countdown-value" id="cdDays">--</span>
          <span class="countdown-label">Days</span>
        </div>
        <span class="countdown-sep">:</span>
        <div class="countdown-unit">
          <span class="countdown-value" id="cdHours">--</span>
          <span class="countdown-label">Hours</span>
        </div>
        <span class="countdown-sep">:</span>
        <div class="countdown-unit">
          <span class="countdown-value" id="cdMinutes">--</span>
          <span class="countdown-label">Min</span>
        </div>
        <span class="countdown-sep">:</span>
        <div class="countdown-unit">
          <span class="countdown-value" id="cdSeconds">--</span>
          <span class="countdown-label">Sec</span>
        </div>
      </div>

      <div class="match-hero-meta">
        <span class="hero-meta-chip"><span class="chip-icon">📅</span> ${dateStr}</span>
        <span class="hero-meta-chip"><span class="chip-icon">🕐</span> ${timeStr}</span>
        ${match.map ? `<span class="hero-meta-chip"><span class="chip-icon">🗺️</span> ${safeHtml(match.map)}</span>` : ""}
        ${match.rally ? `<span class="hero-meta-chip"><span class="chip-icon">👥</span> ${safeHtml(match.rally)}</span>` : ""}
        ${match.region ? `<span class="hero-meta-chip"><span class="chip-icon">📌</span> ${safeHtml(match.region)}</span>` : ""}
      </div>
    </div>
  `;

  startCountdown(dateObj);
}

/* ── Countdown Timer ── */
function startCountdown(targetDate) {
  if (countdownIntervalId) clearInterval(countdownIntervalId);

  function tick() {
    const now = Date.now();
    const diff = targetDate.getTime() - now;

    const dNode = document.getElementById("cdDays");
    const hNode = document.getElementById("cdHours");
    const mNode = document.getElementById("cdMinutes");
    const sNode = document.getElementById("cdSeconds");

    if (!dNode) return;

    if (diff <= 0) {
      dNode.textContent = "00";
      hNode.textContent = "00";
      mNode.textContent = "00";
      sNode.textContent = "00";
      clearInterval(countdownIntervalId);
      return;
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    dNode.textContent = String(days).padStart(2, "0");
    hNode.textContent = String(hours).padStart(2, "0");
    mNode.textContent = String(minutes).padStart(2, "0");
    sNode.textContent = String(seconds).padStart(2, "0");
  }

  tick();
  countdownIntervalId = setInterval(tick, 1000);
}

/* ══════════════════════════════════════════
   MATCH STATS SUMMARY
   ══════════════════════════════════════════ */
function renderMatchStats(matches) {
  if (!statsSummaryNode) return;

  const finished = matches.filter(m => m.type === "finished");
  const upcoming = matches.filter(m => m.type === "upcoming");
  const totalCasualties = finished.reduce((sum, m) =>
    sum + (Number(m.casualtiesA) || 0) + (Number(m.casualtiesB) || 0), 0
  );

  const factionSet = new Set();
  matches.forEach(m => {
    if (m.teamA) factionSet.add(m.teamA.toUpperCase());
    if (m.teamB) factionSet.add(m.teamB.toUpperCase());
  });

  statsSummaryNode.innerHTML = `
    <div class="match-stat-card">
      <span class="stat-value">${finished.length}</span>
      <span class="stat-label">Battles Fought</span>
    </div>
    <div class="match-stat-card">
      <span class="stat-value">${upcoming.length}</span>
      <span class="stat-label">Upcoming Battles</span>
    </div>
    <div class="match-stat-card">
      <span class="stat-value">${totalCasualties.toLocaleString()}</span>
      <span class="stat-label">Total Casualties</span>
    </div>
    <div class="match-stat-card">
      <span class="stat-value">${factionSet.size}</span>
      <span class="stat-label">Factions Engaged</span>
    </div>
  `;
}

/* ══════════════════════════════════════════
   MATCH CARD — Scoreboard Style
   ══════════════════════════════════════════ */
function renderMatchCard(match, index) {
  const card = document.createElement("article");
  card.className = "match-card";
  card.style.setProperty("--card-delay", `${index * 80}ms`);

  const isUpcoming = match.type === "upcoming";
  const dateObj = new Date(match.date);
  const formattedDate = dateObj.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  const scoreA = Number(match.scoreA) || 0;
  const scoreB = Number(match.scoreB) || 0;
  const casA = Number(match.casualtiesA) || 0;
  const casB = Number(match.casualtiesB) || 0;
  const totalCas = casA + casB;
  const casAPerc = totalCas > 0 ? (casA / totalCas) * 100 : 50;
  const casBPerc = totalCas > 0 ? (casB / totalCas) * 100 : 50;

  let scoreAClass = "";
  let scoreBClass = "";
  if (!isUpcoming) {
    if (scoreA > scoreB) { scoreAClass = "score-win"; scoreBClass = "score-loss"; }
    else if (scoreB > scoreA) { scoreAClass = "score-loss"; scoreBClass = "score-win"; }
    else { scoreAClass = "score-draw"; scoreBClass = "score-draw"; }
  }

  // Build detail chips
  const chips = [];
  if (match.map) chips.push(`<span class="match-detail-chip"><span class="chip-icon">🗺️</span> ${safeHtml(match.map)}</span>`);
  if (match.rally) chips.push(`<span class="match-detail-chip"><span class="chip-icon">👥</span> ${safeHtml(match.rally)}</span>`);
  if (match.region) chips.push(`<span class="match-detail-chip"><span class="chip-icon">📌</span> ${safeHtml(match.region)}</span>`);
  if (!isUpcoming && totalCas > 0) {
    chips.push(`<span class="match-detail-chip chip-casualties"><span class="chip-icon">💀</span> ${casA.toLocaleString()} vs ${casB.toLocaleString()}</span>`);
  }

  card.innerHTML = `
    <div class="match-card-header">
      <span class="match-badge ${isUpcoming ? 'badge-upcoming' : 'badge-finished'}">
        ${isUpcoming ? '⚔️ UPCOMING' : '🏁 FINISHED'}
      </span>
      <span class="match-date">${formattedDate}</span>
    </div>

    ${match.title ? `<h3 class="match-title">${safeHtml(match.title)}</h3>` : ""}

    <div class="match-scoreboard">
      <div class="match-team team-a">
        <div class="team-flag-wrap">${buildFlagImg(match.teamA, 44)}</div>
        <span class="team-name">${safeHtml(match.teamA)}</span>
      </div>

      <div class="match-score-center">
        ${!isUpcoming
          ? `<span class="team-score ${scoreAClass}">${scoreA}</span>
             <span class="score-divider">—</span>
             <span class="team-score ${scoreBClass}">${scoreB}</span>`
          : `<span class="match-vs-badge">VS</span>`
        }
      </div>

      <div class="match-team team-b">
        <div class="team-flag-wrap">${buildFlagImg(match.teamB, 44)}</div>
        <span class="team-name">${safeHtml(match.teamB)}</span>
      </div>
    </div>

    ${!isUpcoming && totalCas > 0 ? `
      <div class="casualties-bar-wrap">
        <div class="casualties-bar">
          <div class="cas-a" style="width:${casAPerc}%"></div>
          <div class="cas-b" style="width:${casBPerc}%"></div>
        </div>
      </div>
    ` : ""}

    ${chips.length ? `<div class="match-details">${chips.join("")}</div>` : ""}

    ${match.mediaUrl ? `
      <div class="match-actions">
        <a href="${safeHtml(match.mediaUrl)}" target="_blank" rel="noopener" class="match-btn">📹 View Footage</a>
      </div>
    ` : ""}
  `;

  return card;
}

/* ── Empty State ── */
function renderEmpty(message, sub) {
  const el = document.createElement("div");
  el.className = "empty-msg";
  el.innerHTML = `
    <span class="empty-icon">⚔️</span>
    <div class="empty-text">${safeHtml(message)}</div>
    <div class="empty-sub">${safeHtml(sub || "")}</div>
  `;
  return el;
}

/* ══════════════════════════════════════════
   TAB FILTERING
   ══════════════════════════════════════════ */
function setupFilterTabs() {
  const tabs = document.querySelectorAll(".matches-filter-tab[data-filter]");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const filter = tab.dataset.filter;

      tabs.forEach(t => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });

      if (upcomingSectionNode) upcomingSectionNode.style.display = filter === "upcoming" ? "" : "none";
      if (finishedSectionNode) finishedSectionNode.style.display = filter === "finished" ? "" : "none";
    });
  });
}

/* ══════════════════════════════════════════
   INIT — Main Entry Point
   ══════════════════════════════════════════ */
async function initMatchHistory() {
  if (!upcomingGridNode || !finishedGridNode) return;

  setupFilterTabs();

  const matches = await fetchMatchData();

  if (matchesStatusNode) matchesStatusNode.style.display = "none";

  const upcoming = matches
    .filter(m => m.type === "upcoming")
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const finished = matches
    .filter(m => m.type === "finished")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Update tab counts
  if (countUpcomingNode) countUpcomingNode.textContent = upcoming.length;
  if (countFinishedNode) countFinishedNode.textContent = finished.length;

  // Render stats summary
  renderMatchStats(matches);

  // Render hero spotlight (next upcoming match)
  if (upcoming.length > 0) {
    renderHeroSpotlight(upcoming[0]);
  }

  // Render upcoming grid
  upcomingGridNode.innerHTML = "";
  if (upcoming.length === 0) {
    upcomingGridNode.appendChild(renderEmpty("No upcoming matches scheduled", "Check back soon for new battle announcements"));
  } else {
    upcoming.forEach((m, i) => upcomingGridNode.appendChild(renderMatchCard(m, i)));
  }

  // Render finished grid
  finishedGridNode.innerHTML = "";
  if (finished.length === 0) {
    finishedGridNode.appendChild(renderEmpty("No historical matches recorded", "Battle results will appear here after matches conclude"));
  } else {
    finished.forEach((m, i) => finishedGridNode.appendChild(renderMatchCard(m, i)));
  }

  // Default to upcoming tab if there are upcoming matches, otherwise finished
  if (upcoming.length === 0 && finished.length > 0) {
    const finishedTab = document.querySelector('.matches-filter-tab[data-filter="finished"]');
    if (finishedTab) finishedTab.click();
  }
}

document.addEventListener("DOMContentLoaded", initMatchHistory);
