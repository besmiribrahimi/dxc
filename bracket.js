const GROUP_COUNT = 9;
const GROUP_SIZE = 8;
const QUALIFIERS_PER_GROUP = 2;
const GROUP_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
const LIVE_REFRESH_INTERVAL_MS = 45_000;
const POINTS_PER_WIN = 3;

const dom = {
  groupsGrid: document.getElementById("groups-grid"),
  knockoutBracket: document.getElementById("knockout-bracket"),
  message: document.getElementById("message"),
  groupCount: document.getElementById("group-count"),
  entrantCount: document.getElementById("entrant-count"),
  qualifierCount: document.getElementById("qualifier-count"),
  lastUpdated: document.getElementById("last-updated"),
  playerSearch: document.getElementById("player-search"),
  groupFilter: document.getElementById("group-filter"),
  adminToggle: document.getElementById("admin-toggle"),
  globalSync: document.getElementById("global-sync"),
  soundToggle: document.getElementById("sound-toggle"),
  particles: document.getElementById("bracket-particles"),
  playerPopup: document.getElementById("player-popup"),
  playerPopupClose: document.getElementById("player-popup-close"),
  popupName: document.getElementById("player-popup-name"),
  popupFaction: document.getElementById("player-popup-faction"),
  popupCountry: document.getElementById("player-popup-country"),
  popupGroup: document.getElementById("player-popup-group"),
  popupPoints: document.getElementById("player-popup-points"),
  popupWins: document.getElementById("player-popup-wins"),
  popupLosses: document.getElementById("player-popup-losses"),
};

const state = {
  groups: [],
  source: "",
  loading: true,
  adminMode: false,
  soundEnabled: true,
  searchTerm: "",
  groupFilter: "all",
  collapsedGroups: new Set(),
  expandedMatches: new Set(),
  groupResults: new Map(),
  knockoutResults: new Map(),
  scoreMemory: new Map(),
  winnerMemory: new Map(),
  playerIndex: new Map(),
  lastUpdatedAt: 0,
};

bindUiEvents();
initializeParticles();
renderLoadingSkeletons();
void initializeTournament();

async function initializeTournament() {
  await loadTournamentSource({ silent: false });
  renderTournament();

  window.setInterval(() => {
    void refreshTournamentData();
  }, LIVE_REFRESH_INTERVAL_MS);
}

async function refreshTournamentData() {
  const beforeSignature = getGroupsSignature(state.groups);
  await loadTournamentSource({ silent: true });
  const afterSignature = getGroupsSignature(state.groups);

  if (beforeSignature !== afterSignature) {
    state.groupResults.clear();
    state.knockoutResults.clear();
    showMessage("Live update received. Groups were refreshed from source.");
  }

  renderTournament();
}

function bindUiEvents() {
  dom.playerSearch?.addEventListener("input", (event) => {
    const target = event.target;
    state.searchTerm = normalizeText(target.value).toLowerCase();
    renderTournament();
  });

  dom.groupFilter?.addEventListener("change", (event) => {
    const target = event.target;
    state.groupFilter = String(target.value || "all");
    renderTournament();
  });

  dom.adminToggle?.addEventListener("click", () => {
    state.adminMode = !state.adminMode;
    dom.adminToggle.setAttribute("aria-pressed", String(state.adminMode));
    dom.adminToggle.textContent = state.adminMode ? "Admin Mode: On" : "Admin Mode: Off";
    showMessage(state.adminMode ? "Admin mode enabled." : "Admin mode disabled.");
    renderTournament();
  });

  dom.soundToggle?.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    dom.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    dom.soundToggle.textContent = state.soundEnabled ? "Sound: On" : "Sound: Off";
  });

  dom.globalSync?.addEventListener("click", () => {
    void syncGlobalOrder();
  });

  dom.groupsGrid?.addEventListener("click", handleBracketAction);
  dom.knockoutBracket?.addEventListener("click", handleBracketAction);

  dom.playerPopupClose?.addEventListener("click", closePlayerPopup);
  dom.playerPopup?.addEventListener("click", (event) => {
    if (event.target === dom.playerPopup) {
      closePlayerPopup();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePlayerPopup();
    }
  });
}

function initializeParticles() {
  if (!dom.particles) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    return;
  }

  const count = 18;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i += 1) {
    const particle = document.createElement("span");
    particle.className = "bracket-particle";
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${Math.random() * -12}s`;
    particle.style.animationDuration = `${10 + Math.random() * 12}s`;
    particle.style.opacity = `${0.08 + Math.random() * 0.2}`;
    fragment.appendChild(particle);
  }

  dom.particles.appendChild(fragment);
}

function handleBracketAction(event) {
  const target = event.target instanceof HTMLElement ? event.target.closest("[data-action]") : null;
  if (!target) {
    return;
  }

  const action = target.dataset.action || "";

  if (action === "toggle-group") {
    const groupId = String(target.dataset.group || "").toUpperCase();
    if (!groupId) {
      return;
    }

    if (state.collapsedGroups.has(groupId)) {
      state.collapsedGroups.delete(groupId);
    } else {
      state.collapsedGroups.add(groupId);
    }

    renderTournament();
    return;
  }

  if (action === "toggle-match") {
    const matchId = String(target.dataset.match || "");
    if (!matchId) {
      return;
    }

    if (state.expandedMatches.has(matchId)) {
      state.expandedMatches.delete(matchId);
    } else {
      state.expandedMatches.add(matchId);
    }

    renderTournament();
    return;
  }

  if (action === "player-popup") {
    const key = String(target.dataset.player || "").toLowerCase();
    openPlayerPopup(key);
    return;
  }

  if (action === "move-seed") {
    if (!state.adminMode) {
      showMessage("Enable admin mode to reorder players.", true);
      return;
    }

    const groupId = String(target.dataset.group || "").toUpperCase();
    const index = Number.parseInt(String(target.dataset.index || "-1"), 10);
    const direction = String(target.dataset.direction || "");

    moveGroupSeed(groupId, index, direction === "up" ? -1 : 1);
    return;
  }

  if (!["set-winner", "save-score", "clear-result"].includes(action)) {
    return;
  }

  if (!state.adminMode) {
    showMessage("Enable admin mode to edit match results.", true);
    return;
  }

  const scope = target.dataset.scope === "knockout" ? "knockout" : "group";
  const matchId = String(target.dataset.match || "");
  if (!matchId) {
    return;
  }

  const resultMap = scope === "knockout" ? state.knockoutResults : state.groupResults;

  if (action === "set-winner") {
    const side = target.dataset.side === "b" ? "b" : "a";
    const existing = resultMap.get(matchId) || { scoreA: 0, scoreB: 0, winnerSide: "" };
    const next = {
      scoreA: normalizeScoreValue(existing.scoreA),
      scoreB: normalizeScoreValue(existing.scoreB),
      winnerSide: side,
    };

    if (side === "a" && next.scoreA <= next.scoreB) {
      next.scoreA = next.scoreB + 1;
    }

    if (side === "b" && next.scoreB <= next.scoreA) {
      next.scoreB = next.scoreA + 1;
    }

    resultMap.set(matchId, next);
    renderTournament();
    return;
  }

  if (action === "save-score") {
    const controls = target.closest(".admin-match-controls");
    if (!controls) {
      return;
    }

    const scoreAInput = controls.querySelector('[data-role="score-a"]');
    const scoreBInput = controls.querySelector('[data-role="score-b"]');

    const scoreA = normalizeScoreValue(scoreAInput ? scoreAInput.value : 0);
    const scoreB = normalizeScoreValue(scoreBInput ? scoreBInput.value : 0);

    let winnerSide = "";
    if (scoreA > scoreB) {
      winnerSide = "a";
    } else if (scoreB > scoreA) {
      winnerSide = "b";
    }

    resultMap.set(matchId, {
      scoreA,
      scoreB,
      winnerSide,
    });

    renderTournament();
    return;
  }

  if (action === "clear-result") {
    resultMap.delete(matchId);
    renderTournament();
  }
}

function moveGroupSeed(groupId, fromIndex, delta) {
  const groupIndex = GROUP_LABELS.indexOf(groupId);
  if (groupIndex < 0) {
    return;
  }

  const group = state.groups[groupIndex];
  if (!group || !Array.isArray(group.entrants)) {
    return;
  }

  const toIndex = fromIndex + delta;
  if (
    !Number.isInteger(fromIndex)
    || !Number.isInteger(toIndex)
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= group.entrants.length
    || toIndex >= group.entrants.length
  ) {
    return;
  }

  const reordered = [...group.entrants];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);

  reordered.forEach((entrant, index) => {
    entrant.seed = index + 1;
  });

  state.groups[groupIndex] = {
    ...group,
    entrants: reordered,
  };

  renderTournament();
}

async function syncGlobalOrder() {
  const usernames = state.groups.flatMap((group) =>
    group.entrants.filter((entrant) => isRealEntrant(entrant)).map((entrant) => entrant.username)
  );

  if (!usernames.length) {
    showMessage("No players available to sync.", true);
    return;
  }

  showMessage("Syncing current tournament order globally...");

  try {
    const response = await fetch("/api/admin/ranking-order", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order: usernames }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      showMessage(payload.error || "Global sync failed. Login may be required.", true);
      return;
    }

    showMessage("Global sync completed.");
  } catch {
    showMessage("Global sync failed due to network issue.", true);
  }
}

async function loadTournamentSource(options = {}) {
  const { silent = false } = options;

  const groupsFromFile = await loadManualGroupsFromFile();
  if (groupsFromFile.length > 0) {
    state.groups = normalizeGroupSet(groupsFromFile);
    state.source = "groups.txt";
    state.loading = false;
    state.lastUpdatedAt = Date.now();

    if (!silent) {
      showMessage("Loaded tournament from groups.txt.");
    }

    return;
  }

  const players = await loadPlayersFromFile();
  state.groups = normalizeGroupSet(buildGroupsFromPlayers(players));
  state.source = "players.txt";
  state.loading = false;
  state.lastUpdatedAt = Date.now();

  if (!silent) {
    if (players.length < GROUP_COUNT * GROUP_SIZE) {
      showMessage(
        `Loaded ${players.length} players from players.txt. Missing slots were filled with BYE entries.`,
        true
      );
    } else {
      showMessage("Loaded tournament from players.txt.");
    }
  }
}

async function loadManualGroupsFromFile() {
  try {
    const response = await fetch(`groups.txt?t=${Date.now()}`);
    if (!response.ok) {
      return [];
    }

    const raw = await response.text();
    return parseGroupsRaw(raw);
  } catch {
    return [];
  }
}

async function loadPlayersFromFile() {
  try {
    const response = await fetch(`players.txt?t=${Date.now()}`);
    if (!response.ok) {
      return [];
    }

    const raw = await response.text();
    const lines = String(raw)
      .split(/\r?\n/)
      .map((line) => normalizeText(line))
      .filter((line) => line && !line.startsWith("#"));

    const players = [];
    const seen = new Set();

    for (const line of lines) {
      const parsed = parsePlayerLine(line);
      if (!parsed) {
        continue;
      }

      const username = normalizeText(parsed.username);
      const key = username.toLowerCase();
      if (!username || seen.has(key)) {
        continue;
      }

      seen.add(key);
      players.push({
        id: `p-${players.length + 1}-${slugify(username)}`,
        username,
        faction: normalizeFaction(parsed.faction),
        country: normalizeCountry(parsed.country),
        seed: 0,
        isBye: false,
        isPending: false,
      });
    }

    return players;
  } catch {
    return [];
  }
}

function parseGroupsRaw(raw) {
  const groups = [];
  let currentGroup = null;

  const lines = String(raw).split(/\r?\n/);

  for (const originalLine of lines) {
    const line = normalizeText(originalLine);
    if (!line || line.startsWith("#")) {
      continue;
    }

    const header = line.match(/^group\s+(\d+)(?:\s*\(([^)]+)\))?/i);
    if (header) {
      if (currentGroup) {
        groups.push(currentGroup);
      }

      currentGroup = {
        sourceIndex: Number(header[1]),
        sourceLabel: normalizeText(header[2] || ""),
        entrants: [],
      };
      continue;
    }

    if (!currentGroup) {
      continue;
    }

    const seedLine = line.match(/^(\d+)\s*[.)]?\s*(.*)$/);
    const seed = seedLine ? Number(seedLine[1]) : currentGroup.entrants.length + 1;
    const payload = normalizeText(seedLine ? seedLine[2] : line);
    const parsed = parsePlayerLine(payload);

    if (!parsed) {
      continue;
    }

    const username = normalizeText(parsed.username);
    if (!username) {
      continue;
    }

    currentGroup.entrants.push({
      id: `g${groups.length + 1}-s${seed}-${slugify(username)}`,
      username,
      faction: normalizeFaction(parsed.faction),
      country: normalizeCountry(parsed.country),
      seed,
      isBye: false,
      isPending: false,
    });
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups.map((group) => ({
    entrants: [...group.entrants].sort((a, b) => a.seed - b.seed),
  }));
}

function parsePlayerLine(line) {
  const value = normalizeText(line);
  if (!value) {
    return null;
  }

  if (value.includes(",")) {
    const parts = value.split(",").map((item) => normalizeText(item));
    if (parts.length >= 3) {
      return {
        username: parts[0],
        faction: parts[1],
        country: parts.slice(2).join(", "),
      };
    }
  }

  if (value.includes("/")) {
    const parts = value.split("/").map((item) => normalizeText(item));
    if (parts.length >= 3) {
      return {
        username: parts[0],
        faction: parts[1],
        country: parts.slice(2).join(" "),
      };
    }
  }

  const tokens = value.split(/\s+/);
  if (tokens.length >= 3) {
    return {
      username: tokens[0],
      faction: tokens[1],
      country: tokens.slice(2).join(" "),
    };
  }

  return null;
}

function buildGroupsFromPlayers(players) {
  const limited = Array.isArray(players) ? players.slice(0, GROUP_COUNT * GROUP_SIZE) : [];
  const groups = [];

  for (let groupIndex = 0; groupIndex < GROUP_COUNT; groupIndex += 1) {
    const start = groupIndex * GROUP_SIZE;
    const chunk = limited.slice(start, start + GROUP_SIZE);

    groups.push({
      entrants: chunk.map((entry, index) => ({
        ...entry,
        seed: index + 1,
      })),
    });
  }

  return groups;
}

function normalizeGroupSet(groups) {
  const normalized = [];

  for (let index = 0; index < GROUP_COUNT; index += 1) {
    const source = Array.isArray(groups) ? groups[index] : null;
    const sourceEntrants = source && Array.isArray(source.entrants) ? source.entrants : [];
    const entrants = sourceEntrants
      .slice(0, GROUP_SIZE)
      .map((entry, entrantIndex) => normalizeEntrant(entry, index, entrantIndex));

    while (entrants.length < GROUP_SIZE) {
      entrants.push(createByeEntrant(`g${index + 1}-fill-${entrants.length + 1}`));
    }

    normalized.push({
      id: GROUP_LABELS[index],
      label: `Group ${GROUP_LABELS[index]}`,
      entrants,
    });
  }

  return normalized;
}

function normalizeEntrant(entry, groupIndex, entrantIndex) {
  const username = normalizeText(entry && entry.username ? entry.username : "BYE");
  const isBye = username.toUpperCase() === "BYE";

  if (isBye) {
    return createByeEntrant(`g${groupIndex + 1}-s${entrantIndex + 1}`);
  }

  return {
    id:
      normalizeText(entry && entry.id)
        ? normalizeText(entry.id)
        : `g${groupIndex + 1}-s${entrantIndex + 1}-${slugify(username)}`,
    username,
    faction: normalizeFaction(entry && entry.faction),
    country: normalizeCountry(entry && entry.country),
    seed: Number.isFinite(Number(entry && entry.seed)) ? Number(entry.seed) : entrantIndex + 1,
    isBye: false,
    isPending: false,
  };
}

function createByeEntrant(key) {
  return {
    id: `bye-${key}`,
    username: "BYE",
    faction: "-",
    country: "-",
    seed: 0,
    isBye: true,
    isPending: false,
  };
}

function createPendingEntrant(label, key) {
  return {
    id: `pending-${key}`,
    username: label,
    faction: "-",
    country: "-",
    seed: 0,
    isBye: false,
    isPending: true,
  };
}

function isRealEntrant(entrant) {
  return Boolean(entrant && !entrant.isBye && !entrant.isPending);
}

function renderTournament() {
  if (state.loading) {
    renderLoadingSkeletons();
    return;
  }

  const evaluatedGroups = state.groups.map((group) => evaluateGroup(group));
  const qualifiers = evaluatedGroups.flatMap((entry) => entry.qualifiers);
  const knockoutRounds = buildKnockoutRounds(qualifiers);

  const scoreMemoryBuffer = new Map();
  const winnerMemoryBuffer = new Map();
  const winnerTracker = { changes: 0 };
  const playerIndex = buildPlayerIndex(evaluatedGroups);

  renderGroups(evaluatedGroups, scoreMemoryBuffer, winnerMemoryBuffer, winnerTracker);
  renderKnockout(
    knockoutRounds,
    scoreMemoryBuffer,
    winnerMemoryBuffer,
    winnerTracker
  );

  updateHeaderMeta(evaluatedGroups, qualifiers);
  updateLastUpdatedTime();

  state.scoreMemory = scoreMemoryBuffer;
  state.winnerMemory = winnerMemoryBuffer;
  state.playerIndex = playerIndex;

  animateScoreCounters();

  if (winnerTracker.changes > 0) {
    playMatchUpdateSound();
  }
}

function evaluateGroup(group) {
  const rounds = buildGroupRounds(group);
  const standings = buildGroupStandings(group, rounds);
  const qualifiers = standings
    .slice(0, QUALIFIERS_PER_GROUP)
    .map((row) => row.player)
    .filter((entrant) => isRealEntrant(entrant));

  return {
    group,
    rounds,
    standings,
    qualifiers,
  };
}

function buildGroupRounds(group) {
  const entrants = group.entrants;
  const quarterPairs = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
  ];

  const quarterfinals = quarterPairs.map(([aIndex, bIndex], index) =>
    resolveMatch(
      `g${group.id}-r1-m${index + 1}`,
      entrants[aIndex],
      entrants[bIndex],
      state.groupResults
    )
  );

  const semifinalA = quarterfinals[0].winner || createPendingEntrant("Winner QF1", `g${group.id}-sf1-a`);
  const semifinalB = quarterfinals[1].winner || createPendingEntrant("Winner QF2", `g${group.id}-sf1-b`);
  const semifinalC = quarterfinals[2].winner || createPendingEntrant("Winner QF3", `g${group.id}-sf2-a`);
  const semifinalD = quarterfinals[3].winner || createPendingEntrant("Winner QF4", `g${group.id}-sf2-b`);

  const semifinals = [
    resolveMatch(`g${group.id}-r2-m1`, semifinalA, semifinalB, state.groupResults),
    resolveMatch(`g${group.id}-r2-m2`, semifinalC, semifinalD, state.groupResults),
  ];

  const finalA = semifinals[0].winner || createPendingEntrant("Winner SF1", `g${group.id}-f-a`);
  const finalB = semifinals[1].winner || createPendingEntrant("Winner SF2", `g${group.id}-f-b`);
  const final = [resolveMatch(`g${group.id}-r3-m1`, finalA, finalB, state.groupResults)];

  return [
    { id: `${group.id}-r1`, title: "Quarterfinals", matches: quarterfinals },
    { id: `${group.id}-r2`, title: "Semifinals", matches: semifinals },
    { id: `${group.id}-r3`, title: "Final", matches: final },
  ];
}

function buildGroupStandings(group, rounds) {
  const rows = new Map();

  group.entrants.forEach((entrant, index) => {
    if (!isRealEntrant(entrant)) {
      return;
    }

    rows.set(entrant.id, {
      player: entrant,
      points: 0,
      wins: 0,
      losses: 0,
      played: 0,
      seed: Number.isFinite(entrant.seed) ? entrant.seed : index + 1,
    });
  });

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (!match.winner || !isRealEntrant(match.winner)) {
        return;
      }

      if (!isRealEntrant(match.a) || !isRealEntrant(match.b)) {
        return;
      }

      const loser = match.winnerSide === "a" ? match.b : match.a;
      const winnerRow = rows.get(match.winner.id);
      const loserRow = rows.get(loser.id);

      if (winnerRow) {
        winnerRow.wins += 1;
        winnerRow.points += POINTS_PER_WIN;
        winnerRow.played += 1;
      }

      if (loserRow) {
        loserRow.losses += 1;
        loserRow.played += 1;
      }
    });
  });

  return [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }

    if (a.losses !== b.losses) {
      return a.losses - b.losses;
    }

    return a.seed - b.seed;
  });
}

function buildKnockoutRounds(qualifiers) {
  if (!qualifiers.length) {
    return [];
  }

  const slots = nextPowerOfTwo(Math.max(2, qualifiers.length));
  const seeded = qualifiers.map((entrant, index) => ({
    ...entrant,
    seed: index + 1,
  }));

  while (seeded.length < slots) {
    seeded.push(createByeEntrant(`ko-fill-${seeded.length + 1}`));
  }

  const rounds = [];
  let roundEntrants = seeded;
  let roundIndex = 1;

  while (roundEntrants.length >= 2) {
    const matchCount = roundEntrants.length / 2;
    const matches = [];
    const winners = [];

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const a = roundEntrants[matchIndex * 2];
      const b = roundEntrants[matchIndex * 2 + 1];
      const id = `ko-r${roundIndex}-m${matchIndex + 1}`;
      const match = resolveMatch(id, a, b, state.knockoutResults);

      matches.push(match);
      winners.push(
        match.winner || createPendingEntrant(`Winner R${roundIndex}M${matchIndex + 1}`, `${id}-next`)
      );
    }

    rounds.push({
      id: `ko-r${roundIndex}`,
      title: getRoundTitle(matchCount),
      matches,
    });

    roundEntrants = winners;
    roundIndex += 1;
  }

  return rounds;
}

function resolveMatch(matchId, a, b, resultMap) {
  const stored = resultMap.get(matchId) || null;
  const scoreA = normalizeScoreValue(stored && stored.scoreA);
  const scoreB = normalizeScoreValue(stored && stored.scoreB);

  let winnerSide = stored && (stored.winnerSide === "a" || stored.winnerSide === "b") ? stored.winnerSide : "";
  const autoWinnerSide = getAutoWinnerSide(a, b);

  if (autoWinnerSide) {
    winnerSide = autoWinnerSide;
  } else if (!winnerSide && scoreA !== scoreB) {
    winnerSide = scoreA > scoreB ? "a" : "b";
  }

  let winner = null;
  if (winnerSide === "a" && a && !a.isBye) {
    winner = a;
  } else if (winnerSide === "b" && b && !b.isBye) {
    winner = b;
  }

  return {
    id: matchId,
    a,
    b,
    scoreA,
    scoreB,
    winnerSide,
    winner,
  };
}

function getAutoWinnerSide(a, b) {
  if (a && a.isBye && b && !b.isBye) {
    return "b";
  }

  if (b && b.isBye && a && !a.isBye) {
    return "a";
  }

  return "";
}

function renderGroups(evaluatedGroups, scoreMemoryBuffer, winnerMemoryBuffer, winnerTracker) {
  if (!dom.groupsGrid) {
    return;
  }

  const visibleGroups = evaluatedGroups.filter((entry) => isGroupVisible(entry));

  if (!visibleGroups.length) {
    dom.groupsGrid.innerHTML = '<p class="empty-state">No groups match the current filters.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  visibleGroups.forEach((entry, cardIndex) => {
    const card = document.createElement("article");
    const collapsed = state.collapsedGroups.has(entry.group.id);

    card.className = "group-stage-card is-animated";
    card.style.setProperty("--card-delay", `${cardIndex * 70}ms`);

    card.innerHTML = `
      <header class="group-stage-head">
        <button type="button" class="group-toggle" data-action="toggle-group" data-group="${escapeHtml(
          entry.group.id
        )}" aria-expanded="${String(!collapsed)}">
          <strong>${escapeHtml(entry.group.label)}</strong>
          <span>${entry.group.entrants.filter((entrant) => isRealEntrant(entrant)).length} players</span>
        </button>
      </header>
      <div class="group-stage-body ${collapsed ? "is-collapsed" : ""}">
        ${renderGroupRoster(entry.group)}
        <div class="group-stage-rounds">
          ${entry.rounds
            .map((round) =>
              renderRoundMarkup(
                round,
                "group",
                entry.group.id,
                scoreMemoryBuffer,
                winnerMemoryBuffer,
                winnerTracker
              )
            )
            .join("")}
        </div>
        ${renderStandingsMarkup(entry.standings, entry.qualifiers)}
      </div>
    `;

    fragment.appendChild(card);
  });

  dom.groupsGrid.innerHTML = "";
  dom.groupsGrid.appendChild(fragment);
}

function renderGroupRoster(group) {
  const rows = group.entrants
    .map((entrant, index) => {
      const canMoveUp = state.adminMode && index > 0;
      const canMoveDown = state.adminMode && index < group.entrants.length - 1;

      return `
        <div class="group-roster-row ${entrant.isBye ? "is-bye" : ""}">
          <span class="group-seed">S${index + 1}</span>
          <div class="group-roster-player">${renderEntrantMarkup(entrant, state.searchTerm)}</div>
          ${
            state.adminMode
              ? `
                <div class="group-roster-actions">
                  <button type="button" class="quick-chip mini" data-action="move-seed" data-group="${escapeHtml(
                    group.id
                  )}" data-index="${index}" data-direction="up" ${canMoveUp ? "" : "disabled"}>Up</button>
                  <button type="button" class="quick-chip mini" data-action="move-seed" data-group="${escapeHtml(
                    group.id
                  )}" data-index="${index}" data-direction="down" ${canMoveDown ? "" : "disabled"}>Down</button>
                </div>
              `
              : ""
          }
        </div>
      `;
    })
    .join("");

  return `
    <div class="group-roster">
      <h4>Player Seeds</h4>
      <div class="group-roster-list">${rows}</div>
    </div>
  `;
}

function renderRoundMarkup(
  round,
  scope,
  groupId,
  scoreMemoryBuffer,
  winnerMemoryBuffer,
  winnerTracker
) {
  const roundClass = `round ${getRoundClassName(round.title)}`;
  const matchHtml = round.matches
    .map((match, matchIndex) =>
      renderMatchMarkup(match, {
        scope,
        groupId,
        roundTitle: round.title,
        matchIndex,
        scoreMemoryBuffer,
        winnerMemoryBuffer,
        winnerTracker,
      })
    )
    .join("");

  return `
    <section class="${roundClass}">
      <h4>${escapeHtml(round.title)}</h4>
      ${matchHtml}
    </section>
  `;
}

function renderMatchMarkup(match, options) {
  const {
    scope,
    groupId,
    roundTitle,
    matchIndex,
    scoreMemoryBuffer,
    winnerMemoryBuffer,
    winnerTracker,
  } = options;

  const previousScore = state.scoreMemory.get(match.id) || { a: 0, b: 0 };
  scoreMemoryBuffer.set(match.id, { a: match.scoreA, b: match.scoreB });

  const previousWinner = state.winnerMemory.get(match.id) || "";
  winnerMemoryBuffer.set(match.id, match.winnerSide || "");

  const winnerChanged =
    Boolean(previousWinner)
    && Boolean(match.winnerSide)
    && previousWinner !== match.winnerSide;

  if (winnerChanged) {
    winnerTracker.changes += 1;
  }

  const winnerA = match.winnerSide === "a";
  const winnerB = match.winnerSide === "b";
  const open = state.expandedMatches.has(match.id);

  const statusClass = match.winnerSide ? "is-finished" : "is-live";
  const statusText = match.winnerSide ? "DONE" : "LIVE";

  return `
    <article class="stage-match" style="--match-index:${matchIndex};" data-match-id="${escapeHtml(match.id)}">
      <div class="match-label-row">
        <button type="button" class="match-label-toggle" data-action="toggle-match" data-match="${escapeHtml(
          match.id
        )}">
          <span class="match-label">${escapeHtml(roundTitle)} Match ${matchIndex + 1}</span>
          <span class="live-indicator ${statusClass}"><i></i>${statusText}</span>
        </button>
      </div>
      <div class="stage-player-line ${winnerA ? "is-winner" : ""} ${
    winnerA && winnerChanged ? "is-advanced" : ""
  }">
        ${renderEntrantMarkup(match.a, state.searchTerm)}
      </div>
      <div class="stage-player-line ${winnerB ? "is-winner" : ""} ${
    winnerB && winnerChanged ? "is-advanced" : ""
  }">
        ${renderEntrantMarkup(match.b, state.searchTerm)}
      </div>
      <div class="stage-score" aria-label="Current score">
        <span class="score-number" data-animate-score="${match.scoreA}" data-prev-score="${previousScore.a}">${
    previousScore.a
  }</span>
        <span class="score-separator">:</span>
        <span class="score-number" data-animate-score="${match.scoreB}" data-prev-score="${previousScore.b}">${
    previousScore.b
  }</span>
      </div>
      <div class="match-details ${open ? "is-open" : ""}">
        <p class="match-details-text">${
          match.winner
            ? `${escapeHtml(match.winner.username)} is currently advancing.`
            : "No winner selected yet."
        }</p>
        ${state.adminMode ? renderAdminMatchControls(scope, groupId, match) : ""}
      </div>
    </article>
  `;
}

function renderEntrantMarkup(entrant, searchTerm) {
  if (!entrant) {
    return '<span class="entrant-name">TBD</span>';
  }

  if (entrant.isPending) {
    return `<span class="entrant-name is-pending">${escapeHtml(entrant.username)}</span>`;
  }

  if (entrant.isBye) {
    return '<span class="entrant-name is-bye">BYE</span>';
  }

  const key = slugify(entrant.username).toLowerCase();
  const displayName = highlightMatch(entrant.username, searchTerm);
  const faction = escapeHtml(entrant.faction || "N/A");
  const country = escapeHtml(entrant.country || "Unknown");

  return `
    <button type="button" class="entrant-button" data-action="player-popup" data-player="${escapeHtml(key)}">
      <span class="entrant-name">${displayName}</span>
      <span class="entrant-meta">${faction} | ${country}</span>
    </button>
  `;
}

function renderAdminMatchControls(scope, groupId, match) {
  const hasPlayableA = isRealEntrant(match.a);
  const hasPlayableB = isRealEntrant(match.b);

  return `
    <div class="admin-match-controls" data-scope="${escapeHtml(scope)}" data-group="${escapeHtml(
    groupId || ""
  )}" data-match="${escapeHtml(match.id)}">
      <button type="button" class="quick-chip mini" data-action="set-winner" data-scope="${escapeHtml(
        scope
      )}" data-match="${escapeHtml(match.id)}" data-side="a" ${
    hasPlayableA ? "" : "disabled"
  }>A Win</button>
      <button type="button" class="quick-chip mini" data-action="set-winner" data-scope="${escapeHtml(
        scope
      )}" data-match="${escapeHtml(match.id)}" data-side="b" ${
    hasPlayableB ? "" : "disabled"
  }>B Win</button>
      <input data-role="score-a" class="admin-score-input" type="number" min="0" max="99" value="${
    match.scoreA
  }">
      <input data-role="score-b" class="admin-score-input" type="number" min="0" max="99" value="${
    match.scoreB
  }">
      <button type="button" class="quick-chip mini" data-action="save-score" data-scope="${escapeHtml(
        scope
      )}" data-match="${escapeHtml(match.id)}">Set</button>
      <button type="button" class="quick-chip mini" data-action="clear-result" data-scope="${escapeHtml(
        scope
      )}" data-match="${escapeHtml(match.id)}">Reset</button>
    </div>
  `;
}

function renderStandingsMarkup(standings, qualifiers) {
  if (!standings.length) {
    return '<div class="group-standings"><p class="empty-state">No standings available.</p></div>';
  }

  const qualifierIds = new Set((qualifiers || []).map((player) => player.id));

  const rows = standings
    .map((row, index) => {
      const isQualifier = qualifierIds.has(row.player.id);

      return `
        <div class="standing-row ${isQualifier ? "is-qualifier" : ""}">
          <span class="standing-rank">${index + 1}</span>
          <span class="standing-name">${escapeHtml(row.player.username)}</span>
          <span class="standing-stat">${row.points} pts</span>
          <span class="standing-stat">${row.wins}W</span>
          <span class="standing-stat">${row.losses}L</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="group-standings">
      <h4>Group Progress</h4>
      <div class="standing-stack">${rows}</div>
    </div>
  `;
}

function renderKnockout(
  rounds,
  scoreMemoryBuffer,
  winnerMemoryBuffer,
  winnerTracker
) {
  if (!dom.knockoutBracket) {
    return;
  }

  if (!rounds.length) {
    dom.knockoutBracket.innerHTML = '<p class="empty-state">No qualifiers yet. Finish group matches to generate knockout stage.</p>';
    return;
  }

  dom.knockoutBracket.innerHTML = `
    <div class="ko-stage-grid">
      ${rounds
        .map(
          (round, roundIndex) => `
            <section class="ko-round ${getRoundClassName(round.title)}" style="--round-index:${roundIndex};">
              <h4>${escapeHtml(round.title)}</h4>
              ${round.matches
                .map((match, matchIndex) =>
                  renderMatchMarkup(match, {
                    scope: "knockout",
                    groupId: "",
                    roundTitle: round.title,
                    matchIndex,
                    scoreMemoryBuffer,
                    winnerMemoryBuffer,
                    winnerTracker,
                  })
                )
                .join("")}
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function buildPlayerIndex(evaluatedGroups) {
  const index = new Map();

  evaluatedGroups.forEach((entry) => {
    entry.standings.forEach((row) => {
      const key = slugify(row.player.username).toLowerCase();
      index.set(key, {
        username: row.player.username,
        faction: row.player.faction,
        country: row.player.country,
        group: entry.group.label,
        points: row.points,
        wins: row.wins,
        losses: row.losses,
      });
    });
  });

  return index;
}

function openPlayerPopup(playerKey) {
  const stats = state.playerIndex.get(playerKey);
  if (!stats || !dom.playerPopup) {
    return;
  }

  if (dom.popupName) dom.popupName.textContent = stats.username;
  if (dom.popupFaction) dom.popupFaction.textContent = stats.faction;
  if (dom.popupCountry) dom.popupCountry.textContent = stats.country;
  if (dom.popupGroup) dom.popupGroup.textContent = stats.group;
  if (dom.popupPoints) dom.popupPoints.textContent = String(stats.points);
  if (dom.popupWins) dom.popupWins.textContent = String(stats.wins);
  if (dom.popupLosses) dom.popupLosses.textContent = String(stats.losses);

  dom.playerPopup.classList.add("active");
  dom.playerPopup.setAttribute("aria-hidden", "false");
}

function closePlayerPopup() {
  if (!dom.playerPopup) {
    return;
  }

  dom.playerPopup.classList.remove("active");
  dom.playerPopup.setAttribute("aria-hidden", "true");
}

function isGroupVisible(entry) {
  if (state.groupFilter !== "all" && entry.group.id !== state.groupFilter) {
    return false;
  }

  if (!state.searchTerm) {
    return true;
  }

  return entry.group.entrants.some((entrant) => {
    if (!entrant || entrant.isBye || entrant.isPending) {
      return false;
    }

    const haystack = `${entrant.username} ${entrant.faction} ${entrant.country}`.toLowerCase();
    return haystack.includes(state.searchTerm);
  });
}

function renderLoadingSkeletons() {
  if (dom.groupsGrid) {
    dom.groupsGrid.innerHTML = `
      <div class="bracket-skeleton-grid">
        ${new Array(6)
          .fill("")
          .map(
            () => `
              <article class="skeleton-card">
                <div class="skeleton-line short"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  if (dom.knockoutBracket) {
    dom.knockoutBracket.innerHTML = `
      <div class="bracket-skeleton-grid">
        ${new Array(3)
          .fill("")
          .map(
            () => `
              <article class="skeleton-card">
                <div class="skeleton-line short"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }
}

function animateScoreCounters() {
  document.querySelectorAll(".score-number[data-animate-score]").forEach((node) => {
    const from = normalizeScoreValue(node.dataset.prevScore);
    const to = normalizeScoreValue(node.dataset.animateScore);

    if (from === to) {
      node.textContent = String(to);
      return;
    }

    const start = performance.now();
    const duration = 360;

    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      node.textContent = String(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  });
}

function playMatchUpdateSound() {
  if (!state.soundEnabled) {
    return;
  }

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = 560;
    gain.gain.value = 0.0001;

    oscillator.connect(gain);
    gain.connect(context.destination);

    const now = context.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    oscillator.start(now);
    oscillator.stop(now + 0.13);
  } catch {
    // Audio can fail if browser blocks autoplay.
  }
}

function updateHeaderMeta(evaluatedGroups, qualifiers) {
  if (dom.groupCount) {
    dom.groupCount.textContent = String(evaluatedGroups.length);
  }

  if (dom.entrantCount) {
    const entrantCount = evaluatedGroups.reduce(
      (sum, entry) => sum + entry.group.entrants.filter((entrant) => isRealEntrant(entrant)).length,
      0
    );
    dom.entrantCount.textContent = String(entrantCount);
  }

  if (dom.qualifierCount) {
    dom.qualifierCount.textContent = String(qualifiers.length);
  }
}

function updateLastUpdatedTime() {
  if (!dom.lastUpdated) {
    return;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
  });

  dom.lastUpdated.textContent = formatter.format(new Date(state.lastUpdatedAt || Date.now()));
}

function showMessage(text, isError = false) {
  if (!dom.message) {
    return;
  }

  dom.message.textContent = text;
  dom.message.classList.toggle("err", Boolean(isError));
  dom.message.classList.toggle("ok", !isError);
}

function getGroupsSignature(groups) {
  return JSON.stringify(
    (Array.isArray(groups) ? groups : []).map((group) => ({
      id: group.id,
      entrants: (Array.isArray(group.entrants) ? group.entrants : []).map((entrant) => entrant.username),
    }))
  );
}

function getRoundClassName(roundTitle) {
  const normalized = normalizeText(roundTitle).toLowerCase();

  if (normalized === "round of 16") {
    return "round-round16";
  }

  if (normalized === "quarterfinals") {
    return "round-quarterfinals";
  }

  if (normalized === "semifinals") {
    return "round-semifinals";
  }

  if (normalized === "final") {
    return "round-final";
  }

  return "";
}

function getRoundTitle(matchCount) {
  if (matchCount === 1) {
    return "Final";
  }

  if (matchCount === 2) {
    return "Semifinals";
  }

  if (matchCount === 4) {
    return "Quarterfinals";
  }

  if (matchCount === 8) {
    return "Round of 16";
  }

  if (matchCount === 16) {
    return "Round of 32";
  }

  return `Round (${matchCount * 2} players)`;
}

function nextPowerOfTwo(value) {
  let power = 1;
  while (power < value) {
    power *= 2;
  }
  return power;
}

function normalizeScoreValue(value) {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(99, parsed);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeFaction(value) {
  const raw = normalizeText(value).toUpperCase();
  const aliases = {
    CSK: "CZSK",
    CZK: "CZSK",
    TWL: "271ST",
    LAS: "INS",
    "URF/AH": "AH",
    "URF / AH": "AH",
    "DEATH KORPS": "DK",
    DEATHKORPS: "DK",
    "NO FACTION": "N/A",
    FACTIONLESS: "N/A",
    NONE: "N/A",
    NA: "N/A",
    TA: "TAE",
    PERU: "N/A",
  };

  return aliases[raw] || raw || "N/A";
}

function normalizeCountry(value) {
  const raw = normalizeText(value);
  const aliasKey = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

  const aliases = {
    usa: "United States",
    us: "United States",
    america: "United States",
    uk: "United Kingdom",
    england: "United Kingdom",
    britain: "United Kingdom",
    "great britain": "United Kingdom",
    turkiye: "Turkey",
    cananda: "Canada",
  };

  return aliases[aliasKey] || toTitleCaseWords(raw || "Unknown");
}

function toTitleCaseWords(value) {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text, term) {
  const source = String(text || "");
  const normalizedTerm = normalizeText(term || "");

  if (!normalizedTerm) {
    return escapeHtml(source);
  }

  const regex = new RegExp(`(${escapeRegExp(normalizedTerm)})`, "ig");
  return escapeHtml(source).replace(regex, "<mark>$1</mark>");
}
