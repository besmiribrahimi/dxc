const MATCHES_CONFIG_ENDPOINT = "/api/leaderboard-config";
const upcomingGridNode = document.getElementById("upcomingMatchesGrid");
const finishedGridNode = document.getElementById("finishedMatchesGrid");
const matchesStatusNode = document.getElementById("matchesStatus");

async function fetchMatchData() {
  try {
    const response = await fetch(MATCHES_CONFIG_ENDPOINT);
    if (!response.ok) {
      throw new Error("Failed to fetch match data");
    }
    const data = await response.json();
    return data.matches || [];
  } catch (err) {
    console.error("Match fetch error:", err);
    return [];
  }
}

function renderMatchCard(match) {
  const card = document.createElement("article");
  card.className = "match-card";
  
  const isUpcoming = match.type === "upcoming";
  const dateObj = new Date(match.date);
  const formattedDate = dateObj.toLocaleDateString(undefined, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  card.innerHTML = `
    <div class="match-card-header">
      <span class="match-badge ${isUpcoming ? 'badge-upcoming' : 'badge-finished'}">
        ${isUpcoming ? 'UPCOMING' : 'FINISHED'}
      </span>
      <span class="match-date">${formattedDate}</span>
    </div>
    <h3 class="match-title">${escapeHtml(match.title)}</h3>
    <div class="match-teams">
      <div class="match-team team-a">
        <span class="team-name">${escapeHtml(match.teamA)}</span>
        ${!isUpcoming ? `<span class="team-score">${match.scoreA}</span>` : ''}
      </div>
      <div class="match-vs">VS</div>
      <div class="match-team team-b">
        ${!isUpcoming ? `<span class="team-score">${match.scoreB}</span>` : ''}
        <span class="team-name">${escapeHtml(match.teamB)}</span>
      </div>
    </div>
    ${!isUpcoming ? `
      <div class="match-stats">
        <div class="match-stat">
          <label>Casualties</label>
          <span>${match.casualtiesA.toLocaleString()} vs ${match.casualtiesB.toLocaleString()}</span>
        </div>
      </div>
    ` : ''}
    ${match.mediaUrl ? `
      <div class="match-actions">
        <a href="${escapeHtml(match.mediaUrl)}" target="_blank" class="match-btn">View Footage</a>
      </div>
    ` : ''}
  `;

  return card;
}

async function initMatchHistory() {
  if (!upcomingGridNode || !finishedGridNode) return;

  const matches = await fetchMatchData();
  
  if (matchesStatusNode) {
    matchesStatusNode.style.display = "none";
  }

  const upcoming = matches.filter(m => m.type === "upcoming");
  const finished = matches.filter(m => m.type === "finished").sort((a,b) => new Date(b.date) - new Date(a.date));

  upcomingGridNode.innerHTML = "";
  finishedGridNode.innerHTML = "";

  if (upcoming.length === 0) {
    upcomingGridNode.innerHTML = '<p class="empty-msg">No upcoming matches scheduled.</p>';
  } else {
    upcoming.forEach(m => upcomingGridNode.appendChild(renderMatchCard(m)));
  }

  if (finished.length === 0) {
    finishedGridNode.innerHTML = '<p class="empty-msg">No historical matches found.</p>';
  } else {
    finished.forEach(m => finishedGridNode.appendChild(renderMatchCard(m)));
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", initMatchHistory);
