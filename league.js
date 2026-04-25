/* league.js — Dynamic EPL League System */

const LEAGUE_CONFIG_ENDPOINT = "/api/league-config";

const FACTION_FULL_NAMES = {
  "DK": "83rd Death Korps",
  "IA": "Imperio Alemán",
  "TSC": "The Sovereign Calamity",
  "AH": "Austria-Hungary",
  "CZSK": "Czechoslovakia",
  "TWA": "The White Army",
  "NDV": "Nordoslav",
  "AEF": "American Expeditionary Force",
  "AOT": "Attack on Titan",
  "RKA": "RKA",
  "TAE": "The Ascend Empire",
  "SL": "Soviet Legion",
  "SEMETYAN": "United Sermetyan Federation",
  "RRF": "Robloxian Royal Force",
  "URF": "United Robloxian Federation",
  "DSA": "DSA",
  "INS": "Insurgency",
  "CIA": "CIA"
};

const FACTION_FLAG_MAP = {
  "DK": "faction_flags/DK.png",
  "IA": "faction_flags/IA.png",
  "TSC": "faction_flags/TSC.png",
  "AH": "faction_flags/AH.png",
  "CZSK": "faction_flags/CZSK.png",
  "TWA": "faction_flags/TWA.png",
  "NDV": "faction_flags/NDV.png",
  "AEF": "faction_flags/AEF.png",
  "TAE": "faction_flags/TAE.png",
  "SEMETYAN": "faction_flags/SR.png",
  "RRF": "faction_flags/RRF.png",
  "URF": "faction_flags/URF.png",
  "DSA": "faction_flags/DSA.png",
  "INS": "faction_flags/INS.png"
};

function escapeHtmlLeague(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getFactionFlag(code) {
  return FACTION_FLAG_MAP[code.toUpperCase()] || "";
}

function getFactionName(code) {
  return FACTION_FULL_NAMES[code.toUpperCase()] || code;
}

function buildFactionFlagImg(code) {
  const src = getFactionFlag(code);
  if (src) {
    return `<img class="lt-faction-flag" src="${src}" alt="${escapeHtmlLeague(code)}" loading="lazy">`;
  }
  return `<span class="lt-faction-placeholder">${escapeHtmlLeague(code)}</span>`;
}

// ── Standings Calculation ──

function calculateStandings(structure, standings) {
  const results = {};

  Object.entries(structure).forEach(([divKey, divData]) => {
    results[divKey] = { label: divData.label, badge: divData.badge, groups: {} };

    Object.entries(divData.groups || {}).forEach(([groupKey, groupData]) => {
      const standingsKey = `${divKey}-${groupKey}`;
      const standingsGroup = standings[standingsKey]?.factions || {};

      const factionRows = (groupData.factions || []).map(factionCode => {
        const stats = standingsGroup[factionCode] || { w: 0, d: 0, l: 0, sf: 0, sa: 0, form: [] };
        const played = stats.w + stats.d + stats.l;
        const pts = (stats.w * 3) + (stats.d * 1);
        const gd = stats.sf - stats.sa;

        return {
          code: factionCode,
          name: getFactionName(factionCode),
          played,
          w: stats.w,
          d: stats.d,
          l: stats.l,
          sf: stats.sf,
          sa: stats.sa,
          gd,
          pts,
          form: (stats.form || []).slice(-5)
        };
      });

      // Sort: Points DESC → GD DESC → SF DESC → Name ASC
      factionRows.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.sf !== a.sf) return b.sf - a.sf;
        return a.name.localeCompare(b.name);
      });

      results[divKey].groups[groupKey] = {
        label: groupData.label,
        factions: factionRows
      };
    });
  });

  return results;
}

// ── Form Dots ──

function buildFormDots(form) {
  if (!form || !form.length) {
    return '<span class="lt-form-empty">—</span>';
  }
  return form.map(result => {
    const cls = result === "W" ? "form-w" : result === "D" ? "form-d" : "form-l";
    const label = result === "W" ? "Win" : result === "D" ? "Draw" : "Loss";
    return `<span class="lt-form-dot ${cls}" title="${label}"></span>`;
  }).join("");
}

// ── League Table Rendering ──

function buildLeagueTable(groupData, groupKey, divKey) {
  const totalFactions = groupData.factions.length;
  
  let rows = groupData.factions.map((f, index) => {
    const pos = index + 1;
    let zoneClass = "";
    if (pos === 1) zoneClass = "lt-zone-promo";
    else if (pos === totalFactions) zoneClass = "lt-zone-releg";

    const gdDisplay = f.gd > 0 ? `+${f.gd}` : String(f.gd);
    const gdClass = f.gd > 0 ? "lt-gd-pos" : f.gd < 0 ? "lt-gd-neg" : "";

    return `
      <tr class="lt-row ${zoneClass}" data-faction="${escapeHtmlLeague(f.code)}">
        <td class="lt-pos">
          <span class="lt-pos-num">${pos}</span>
        </td>
        <td class="lt-faction">
          ${buildFactionFlagImg(f.code)}
          <div class="lt-faction-info">
            <strong>${escapeHtmlLeague(f.code)}</strong>
            <small>${escapeHtmlLeague(f.name)}</small>
          </div>
        </td>
        <td class="lt-stat">${f.played}</td>
        <td class="lt-stat lt-w">${f.w}</td>
        <td class="lt-stat lt-d">${f.d}</td>
        <td class="lt-stat lt-l">${f.l}</td>
        <td class="lt-stat">${f.sf}</td>
        <td class="lt-stat">${f.sa}</td>
        <td class="lt-stat lt-gd ${gdClass}">${gdDisplay}</td>
        <td class="lt-pts">${f.pts}</td>
        <td class="lt-form">${buildFormDots(f.form)}</td>
      </tr>
    `;
  }).join("");

  return `
    <article class="league-group-table" data-group="${divKey}-${groupKey}">
      <div class="lt-group-header">
        <h3>${escapeHtmlLeague(groupData.label)}</h3>
      </div>
      <div class="lt-table-wrap">
        <table class="lt-table">
          <thead>
            <tr>
              <th class="lt-th-pos">#</th>
              <th class="lt-th-faction">Faction</th>
              <th class="lt-th-stat" title="Played">P</th>
              <th class="lt-th-stat" title="Wins">W</th>
              <th class="lt-th-stat" title="Draws">D</th>
              <th class="lt-th-stat" title="Losses">L</th>
              <th class="lt-th-stat" title="Score For">SF</th>
              <th class="lt-th-stat" title="Score Against">SA</th>
              <th class="lt-th-stat" title="Score Difference">SD</th>
              <th class="lt-th-pts" title="Points">Pts</th>
              <th class="lt-th-form" title="Form (Last 5)">Form</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderDivisions(calculatedData) {
  const container = document.getElementById("leagueDivisionsContainer");
  if (!container) return;

  let html = "";

  const divOrder = ["div1", "div2", "div3"];

  divOrder.forEach((divKey, divIndex) => {
    const div = calculatedData[divKey];
    if (!div) return;

    const badgeClass = div.badge === "secondary" ? "secondary" : div.badge === "muted" ? "muted" : "";

    let groupsHtml = "";
    Object.entries(div.groups).sort(([a], [b]) => a.localeCompare(b)).forEach(([groupKey, groupData]) => {
      groupsHtml += buildLeagueTable(groupData, groupKey, divKey);
    });

    html += `
      <section class="league-division" id="${divKey}" style="--div-index: ${divIndex}">
        <div class="division-header">
          <div class="div-badge ${badgeClass}">Division ${divKey.replace("div", "")}</div>
          <h2>${escapeHtmlLeague(div.label)}</h2>
        </div>
        <div class="league-tables-grid">
          ${groupsHtml}
        </div>
      </section>
    `;
  });

  container.innerHTML = html;

  // Entrance animations
  container.querySelectorAll(".league-group-table").forEach((table, i) => {
    table.style.opacity = "0";
    table.style.transform = "translateY(24px)";
    setTimeout(() => {
      table.style.transition = "all 0.7s cubic-bezier(0.2, 1, 0.3, 1)";
      table.style.opacity = "1";
      table.style.transform = "translateY(0)";
    }, 120 * i);
  });
}

// ── Schedule Rendering ──

function renderSchedule(schedule) {
  const grid = document.getElementById("leagueScheduleGrid");
  if (!grid) return;

  if (!schedule || !schedule.length) {
    grid.innerHTML = '<p class="league-schedule-empty">No scheduled matches available yet.</p>';
    return;
  }

  // Group by date
  const grouped = {};
  schedule.forEach(match => {
    const dateKey = match.date || "TBD";
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(match);
  });

  // Sort dates
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    if (a === "TBD") return 1;
    if (b === "TBD") return -1;
    return new Date(a) - new Date(b);
  });

  let html = "";

  sortedDates.forEach(dateKey => {
    const matches = grouped[dateKey];
    const dateLabel = dateKey === "TBD" ? "Date To Be Determined" : formatDateLabel(dateKey);

    let matchupsHtml = matches.map(match => {
      const statusClass = match.status === "confirmed" ? "live" 
        : match.status === "finished" ? "finished"
        : match.status === "cancelled" ? "cancelled"
        : "tbc";

      const statusText = match.status === "confirmed" ? "Confirmed Engagement"
        : match.status === "finished" ? `Finished: ${match.scoreA} - ${match.scoreB}`
        : match.status === "cancelled" ? "Cancelled"
        : "Status: To Be Confirmed";

      return `
        <div class="battle-matchup ${match.status === 'finished' ? 'is-finished' : ''}">
          <div class="matchup-inner">
            <div class="side home">
              <div class="side-glow"></div>
              ${getFactionFlag(match.teamA)
                ? `<img src="${getFactionFlag(match.teamA)}" alt="${escapeHtmlLeague(match.teamA)}">`
                : `<span class="side-placeholder">${escapeHtmlLeague(match.teamA)}</span>`
              }
              <strong>${escapeHtmlLeague(match.teamAName || getFactionName(match.teamA))}</strong>
            </div>
            <div class="vs-zone">
              <div class="vs-aura"></div>
              ${match.status === 'finished'
                ? `<div class="vs-score">${match.scoreA} - ${match.scoreB}</div>`
                : `<div class="vs-badge">VS</div>`
              }
            </div>
            <div class="side away">
              <div class="side-glow"></div>
              ${getFactionFlag(match.teamB)
                ? `<img src="${getFactionFlag(match.teamB)}" alt="${escapeHtmlLeague(match.teamB)}">`
                : `<span class="side-placeholder">${escapeHtmlLeague(match.teamB)}</span>`
              }
              <strong>${escapeHtmlLeague(match.teamBName || getFactionName(match.teamB))}</strong>
            </div>
          </div>
          <div class="match-footer">
            <span class="status-tag ${statusClass}">${statusText}</span>
            <span class="match-type">EPL Official Engagement</span>
          </div>
        </div>
      `;
    }).join("");

    html += `
      <article class="schedule-day">
        <div class="day-info">
          <h3 class="day-title">${escapeHtmlLeague(dateLabel)}</h3>
          <span class="match-count">${matches.length} Battle${matches.length !== 1 ? 's' : ''} Scheduled</span>
        </div>
        <div class="matchup-list">
          ${matchupsHtml}
        </div>
      </article>
    `;
  });

  grid.innerHTML = html;
}

function formatDateLabel(dateStr) {
  try {
    const date = new Date(dateStr + "T12:00:00");
    if (isNaN(date.getTime())) return dateStr;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];
    const day = date.getDate();
    const suffix = getSuffix(day);
    return `${days[date.getDay()]} ${day}${suffix} ${months[date.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

function getSuffix(day) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

// ── Main Initialization ──

async function fetchLeagueConfig() {
  try {
    const response = await fetch(LEAGUE_CONFIG_ENDPOINT, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.ok) return null;
    return data;
  } catch {
    return null;
  }
}

async function initLeague() {
  const statusNode = document.getElementById("leagueStatusText");
  if (statusNode) {
    statusNode.textContent = "Season One: Operations Active";
  }

  const data = await fetchLeagueConfig();

  if (data) {
    const structure = data.leagueStructure || {};
    const standings = data.leagueStandings || {};
    const schedule = data.leagueSchedule || [];

    const calculated = calculateStandings(structure, standings);
    renderDivisions(calculated);
    renderSchedule(schedule);
  } else {
    // Fallback: render default structure with empty stats
    const defaultStructure = getDefaultStructure();
    const calculated = calculateStandings(defaultStructure, {});
    renderDivisions(calculated);

    const scheduleGrid = document.getElementById("leagueScheduleGrid");
    if (scheduleGrid) {
      scheduleGrid.innerHTML = '<p class="league-schedule-empty">Schedule data unavailable. Check back soon.</p>';
    }
  }
}

function getDefaultStructure() {
  return {
    "div1": {
      label: "Division 1",
      badge: "primary",
      groups: {
        "a": { label: "Group A", factions: ["DK", "IA", "TSC"] },
        "b": { label: "Group B", factions: ["AH", "CZSK", "TWA"] }
      }
    },
    "div2": {
      label: "Division 2",
      badge: "secondary",
      groups: {
        "a": { label: "Group A", factions: ["NDV", "AEF", "AOT"] },
        "b": { label: "Group B", factions: ["RKA", "TAE", "SL"] }
      }
    },
    "div3": {
      label: "Division 3",
      badge: "muted",
      groups: {
        "a": { label: "Group A", factions: ["SEMETYAN", "RRF", "URF"] },
        "b": { label: "Group B", factions: ["DSA", "INS", "CIA"] }
      }
    }
  };
}

initLeague();
