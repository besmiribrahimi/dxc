const statsClockNode = document.getElementById("statsClock");
const statsChampionNode = document.getElementById("statsChampion");
const statsAvgKdNode = document.getElementById("statsAvgKd");
const statsPlayerCountNode = document.getElementById("statsPlayerCount");
const statsFactionCountNode = document.getElementById("statsFactionCount");
const statsContestedNode = document.getElementById("statsContested");
const statsCountryRowsNode = document.getElementById("statsCountryRows");
const statsCountryCircleNode = document.getElementById("statsCountryCircle");
const statsCountryLegendNode = document.getElementById("statsCountryLegend");
const statsCountryCountNode = document.getElementById("statsCountryCount");
const statsFactionCircleNode = document.getElementById("statsFactionCircle");
const statsFactionLegendNode = document.getElementById("statsFactionLegend");
const statsFactionTotalNode = document.getElementById("statsFactionTotal");
const statsKdBandsNode = document.getElementById("statsKdBands");
const statsLevelBandsNode = document.getElementById("statsLevelBands");
const statsFactionShareNode = document.getElementById("statsFactionShare");

const LEADERBOARD_TOP_PLAYER = "20SovietSO21";
const LEADERBOARD_CONFIG_ENDPOINT = "/api/leaderboard-config";

let statsClockIntervalId = null;
let statsLoadPending = false;

function clampLevel(value) {
  const numeric = Number(value);
  return Math.max(1, Math.min(10, Number.isFinite(numeric) ? Math.round(numeric) : 1));
}

function clampKd(value) {
  const numeric = Number(value);
  return Math.max(0, Math.min(9.9, Number.isFinite(numeric) ? numeric : 1));
}

function getLeaderboardStats(playerName) {
  const normalized = String(playerName || "").toLowerCase();
  if (normalized === LEADERBOARD_TOP_PLAYER.toLowerCase()) {
    return { level: 10, kd: 4.0 };
  }
  const seed = [...String(playerName || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const level = clampLevel((seed % 10) + 1);
  const kd = Number((((seed % 25) + 14) / 10).toFixed(1));
  return { level, kd };
}

function normalizeConfigPlayers(config) {
  const raw = config?.players;
  if (!raw || typeof raw !== "object") return {};
  const output = {};
  Object.entries(raw).forEach(([nameKey, stats]) => {
    const key = String(nameKey || "").trim().toLowerCase();
    if (!key) return;
    output[key] = {
      level: clampLevel(stats?.level),
      kd: Number(clampKd(stats?.kd).toFixed(1))
    };
  });
  return output;
}

function normalizeConfigExtraPlayers(config) {
  const raw = config?.extraPlayers;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 120).map((entry) => {
    const item = entry && typeof entry === "object" ? entry : {};
    const name = String(item.name || item.playerName || "").trim();
    if (!name) return null;
    const key = name.toLowerCase();
    const resolvedUserId = Number(item.userId) || 1;
    const faction = typeof window.sanitizeFactionValue === "function" 
      ? window.sanitizeFactionValue(item.faction || "N/A") 
      : (String(item.faction || "N/A").trim().toUpperCase() || "N/A");

    return {
      name,
      faction,
      country: String(item.country || "N/A").trim() || "N/A",
      userId: resolvedUserId,
      level: 1,
      kd: 1
    };
  }).filter(Boolean);
}

async function fetchRemoteConfig() {
  try {
    const response = await fetch(LEADERBOARD_CONFIG_ENDPOINT, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.config || null;
  } catch { return null; }
}

function getPlayerImpact(level, kd, rankIndex) {
  return (level * 12) + (kd * 18) + Math.max(0, 14 - rankIndex);
}

function updateStatsClock() {
  if (!statsClockNode) return;
  statsClockNode.textContent = new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" });
}

function startStatsClock() {
  updateStatsClock();
  if (statsClockIntervalId) clearInterval(statsClockIntervalId);
  statsClockIntervalId = window.setInterval(updateStatsClock, 1000);
}

function renderCircleChart(container, legend, data, totalLabelNode) {
  if (!container || !legend) return;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (totalLabelNode) totalLabelNode.textContent = data.length || "--";
  
  const colors = ['#3b82f6', '#1e40af', '#60a5fa', '#1e3a8a', '#93c5fd', '#2563eb'];
  let currentDegree = 0;
  const gradients = data.slice(0, 6).map((d, i) => {
    const degree = (d.value / total) * 360;
    const color = colors[i % colors.length];
    const start = currentDegree;
    currentDegree += degree;
    return `${color} ${start}deg ${currentDegree}deg`;
  });
  
  if (gradients.length < data.length) {
    gradients.push(`rgba(255,255,255,0.05) ${currentDegree}deg 360deg`);
  }
  
  container.style.background = `conic-gradient(${gradients.join(', ')})`;
  
  legend.innerHTML = data.slice(0, 6).map((d, i) => `
    <div class="stats-legend-item">
      <div class="stats-legend-key">
        <div class="stats-legend-dot" style="background:${colors[i % colors.length]}"></div>
        <span>${d.label}</span>
      </div>
      <span class="stats-legend-val">${Math.round((d.value/total)*100)}%</span>
    </div>
  `).join("") + (data.length > 6 ? `<div class="stats-legend-item"><div class="stats-legend-key"><span>Other Operations</span></div><span>${Math.round((data.slice(6).reduce((s,x)=>s+x.value,0)/total)*100)}%</span></div>` : "");
}

function buildFactionStats(players) {
  const factions = new Map();
  players.forEach((player, rankIndex) => {
    const tokens = typeof window.splitFactionTokens === "function" 
      ? window.splitFactionTokens(player.faction).filter(t => t !== "N/A")
      : [player.faction];
    
    const uniqueTokens = [...new Set(tokens)];
    if (!uniqueTokens.length) return;

    const level = clampLevel(player.level);
    const kd = clampKd(player.kd);
    const impact = getPlayerImpact(level, kd, rankIndex);

    uniqueTokens.forEach((token) => {
      if (!factions.has(token)) {
        factions.set(token, {
          token, members: 0, score: 0, totalLevel: 0, totalKd: 0,
          topOperator: null, topImpact: -1
        });
      }
      const row = factions.get(token);
      row.members += 1;
      row.score += impact;
      row.totalLevel += level;
      row.totalKd += kd;
      if (impact > row.topImpact) {
        row.topImpact = impact;
        row.topOperator = { name: player.name, kd };
      }
    });
  });
  return [...factions.values()].sort((a, b) => b.score - a.score);
}

function renderGeneralMetrics(players, factions) {
  if (statsPlayerCountNode) statsPlayerCountNode.textContent = players.length;
  if (statsFactionCountNode) statsFactionCountNode.textContent = factions.length;
  const avgKd = players.length ? players.reduce((s, p) => s + clampKd(p.kd), 0) / players.length : 0;
  if (statsAvgKdNode) statsAvgKdNode.textContent = avgKd.toFixed(2);
  if (statsChampionNode) {
    statsChampionNode.textContent = factions.length ? `${factions[0].token} (${Math.round(factions[0].score)})` : "N/A";
  }
  if (statsContestedNode) {
    const gap = factions.length > 1 ? Math.round(factions[0].score - factions[1].score) : 0;
    statsContestedNode.textContent = `${gap} pts`;
  }
}







function renderGeoDistribution(players) {
  const map = new Map();
  players.forEach(p => {
    const c = p.country || "N/A";
    map.set(c, (map.get(c) || 0) + 1);
  });
  const sorted = [...map.entries()].sort((a,b) => b[1] - a[1]);
  
  // Table fallback
  if (statsCountryRowsNode) {
    const max = Math.max(1, ...sorted.map(s => s[1]));
    statsCountryRowsNode.innerHTML = sorted.slice(0, 8).map(([c, count]) => {
      const perc = (count / max) * 100;
      const flag = typeof window.countryToFlag === "function" ? window.countryToFlag(c) : "";
      return `
        <div class="stats-geo-row">
          <div class="stats-geo-label"><span>${flag} ${c}</span><span>${count}</span></div>
          <div class="stats-geo-bar-wrap"><div class="stats-geo-bar" style="width:${perc}%"></div></div>
        </div>
      `;
    }).join("");
  }

  // Circular chart
  if (statsCountryCircleNode) {
    const chartData = sorted.map(([label, value]) => ({ label, value }));
    renderCircleChart(statsCountryCircleNode, statsCountryLegendNode, chartData, statsCountryCountNode);
  }
}

function renderDistribution(players, factions) {
  // Simple distribution logic
  const kdBands = [{l:"0-1", v:0}, {l:"1-2", v:0}, {l:"2-3", v:0}, {l:"3+", v:0}];
  players.forEach(p => {
    if(p.kd < 1) kdBands[0].v++;
    else if(p.kd < 2) kdBands[1].v++;
    else if(p.kd < 3) kdBands[2].v++;
    else kdBands[3].v++;
  });
  const renderBar = (l, v, m) => `
    <div style="font-size:0.8rem; margin-bottom:0.5rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.2rem;"><span>${l}</span><span>${v}</span></div>
      <div style="height:4px; background:rgba(0,0,0,0.2);"><div style="height:100%; background:var(--stats-blue); width:${(v/m)*100}%"></div></div>
    </div>
  `;
  const mKd = Math.max(1, ...kdBands.map(b => b.v));
  if(statsKdBandsNode) statsKdBandsNode.innerHTML = kdBands.map(b => renderBar(b.l, b.v, mKd)).join("");
  
  const lvlBands = [{l:"1-3", v:0}, {l:"4-6", v:0}, {l:"7-8", v:0}, {l:"9-10", v:0}];
  players.forEach(p => {
    if(p.level <= 3) lvlBands[0].v++;
    else if(p.level <= 6) lvlBands[1].v++;
    else if(p.level <= 8) lvlBands[2].v++;
    else lvlBands[3].v++;
  });
  const mLvl = Math.max(1, ...lvlBands.map(b => b.v));
  if(statsLevelBandsNode) statsLevelBandsNode.innerHTML = lvlBands.map(b => renderBar(b.l, b.v, mLvl)).join("");

  const fShare = factions.map(f => ({label:f.token, value:f.members}));
  const mF = Math.max(1, ...fShare.map(s => s.value));
  if(statsFactionShareNode) statsFactionShareNode.innerHTML = fShare.slice(0, 6).map(s => renderBar(s.label, s.value, mF)).join("");

  // Circular Faction Influence Chart
  if (statsFactionCircleNode) {
    const influenceData = factions.map(f => ({ label: f.token, value: Math.round(f.score) }));
    renderCircleChart(statsFactionCircleNode, statsFactionLegendNode, influenceData, statsFactionTotalNode);
  }
}

async function gatherAndRender() {
  if (statsLoadPending) return;
  statsLoadPending = true;

  try {
    if (window.globalDataPromise) await window.globalDataPromise;
    const lines = typeof window.loadPlayerLines === "function" ? await window.loadPlayerLines() : [];
    const config = await fetchRemoteConfig();
    const syncedPlayers = normalizeConfigPlayers(config);
    
    const players = lines.map(line => {
      const p = typeof window.parsePlayerLine === "function" ? window.parsePlayerLine(line) : null;
      if (!p) return null;
      const stats = getLeaderboardStats(p.name);
      const override = syncedPlayers[p.name.toLowerCase()];
      p.level = override?.level ?? stats.level;
      p.kd = override?.kd ?? stats.kd;
      return p;
    }).filter(Boolean);

    normalizeConfigExtraPlayers(config).forEach(ep => {
      if (!players.find(p => p.name.toLowerCase() === ep.name.toLowerCase())) {
        players.push(ep);
      }
    });

    const factions = buildFactionStats(players);
    const avatarMap = typeof window.fetchAvatarUrls === "function" ? await window.fetchAvatarUrls(players) : new Map();

    renderGeneralMetrics(players, factions);
    renderGeoDistribution(players);
    renderDistribution(players, factions);


  } finally {
    statsLoadPending = false;
  }
}

function initStats() {
  if (!statsPlayerCountNode) return;
  startStatsClock();
  gatherAndRender();
}

initStats();
