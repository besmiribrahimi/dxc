const PLAYER_STORAGE_KEY = "tournament_players_v1";
const LOCKED_BRACKET_KEY = "tournament_locked_bracket_v1";
const LOCKED_BRACKET_BACKUP_KEY = "tournament_locked_bracket_backup_v1";
const MANUAL_GROUPS_FILE = "groups.txt";
const LEGACY_LOCKED_BRACKET_KEYS = [
  "tournament_locked_bracket_v0",
  "tournament_locked_bracket",
  "locked_bracket",
  "lockedBracket",
];

const syncPlayersButton = document.getElementById("sync-players");
const messageEl = document.getElementById("message");
const bracketsEl = document.getElementById("brackets");
const groupCountEl = document.getElementById("group-count");
const entrantCountEl = document.getElementById("entrant-count");
const lastUpdatedEl = document.getElementById("last-updated");

const LIVE_REFRESH_INTERVAL_MS = 45_000;
const GROUP_STAGE_SIZE = 8;

let players = [];
let lockedGroups = [];
let liveRefreshTimerId = 0;

const FACTION_TIER_CLASS_BY_CODE = {
  DK: "tier-elite",
  AH: "tier-elite",
  TTI2: "tier-elite",
  SWL: "tier-top-mid",
  IA: "tier-top-mid",
  "271ST": "tier-top-mid",
  CZSK: "tier-top-mid",
  TWA: "tier-mid",
  RRF: "tier-mid",
  INS: "tier-mid",
  "RKA 2": "tier-mid",
  URF: "tier-low-mid",
  TAE: "tier-low-mid",
  AEF: "tier-low-mid",
  NDV: "tier-low-mid",
  KOC: "tier-low-mid",
};

const FORCED_MATCH_WINNERS = [
  {
    contenders: ["stolemyxrp", "minostower"],
    winner: "minostower",
  },
  {
    contenders: ["fernichtung1", "*"],
    winner: "fernichtung1",
  },
  {
    contenders: ["hamit_gamer13000", "*"],
    winner: "hamit_gamer13000",
  },
  {
    contenders: ["nicolas82011xd", "*"],
    winner: "nicolas82011xd",
  },
  {
    contenders: ["ligth_hand", "*"],
    winner: "ligth_hand",
  },
  {
    contenders: ["ninbinsin", "*"],
    winner: "ninbinsin",
  },
  {
    contenders: ["ethan_onps5", "*"],
    winner: "ethan_onps5",
  },
  {
    contenders: ["mainpanda", "*"],
    winner: "mainpanda",
  },
  {
    contenders: ["rittwdvk", "*"],
    winner: "rittwdvk",
  },
  {
    contenders: ["imperatorvult", "yummybadgeshmm"],
    winner: "yummybadgeshmm",
  },
  {
    contenders: ["xxninjaxx9065", "*"],
    winner: "xxninjaxx9065",
  },
  {
    contenders: ["avgeggenjoyer", "jokerkingksh"],
    winner: "avgeggenjoyer",
  },
  {
    contenders: ["kerempro34512", "*"],
    winner: "kerempro34512",
  },
  {
    contenders: ["aipom", "*"],
    winner: "aipom",
  },
  {
    contenders: ["zlvhx_ia", "*"],
    winner: "zlvhx_ia",
  },
  {
    contenders: ["ramq124", "*"],
    winner: "ramq124",
  },
  {
    contenders: ["5gb6hn", "*"],
    winner: "5gb6hn",
  },
  {
    contenders: ["thatrandomperson142", "*"],
    winner: "thatrandomperson142",
  },
];

syncPlayersButton?.addEventListener("click", onSyncPlayers);

void initializeBracketPage();

async function initializeBracketPage() {
  players = loadPlayersFromStorage();
  startLiveRefresh();

  if (players.length === 0) {
    await syncPlayersFromTextFile({
      silentIfMissing: true,
      suppressSuccessMessage: true,
    });
  }

  const manualGroups = await loadManualLockedGroupsFromTextFile();
  if (manualGroups.length > 0) {
    lockedGroups = manualGroups;
    saveLockedGroups(lockedGroups);
    renderLockedBracket(lockedGroups, { isManual: true });
    showMessage("Locked bracket loaded from groups.txt. Manual groups stay unchanged.");
    return;
  }

  lockedGroups = loadLockedGroups();

  if (lockedGroups.length > 0) {
    renderLockedBracket(lockedGroups, { isManual: false });
    showMessage("Locked bracket loaded. It stays the same.");
    return;
  }

  if (players.length < 8) {
    renderEmptyBracketState();
    showMessage("Need at least 8 players to create the locked bracket.", true);
    return;
  }

  lockedGroups = createLockedGroups(players);
  saveLockedGroups(lockedGroups);
  renderLockedBracket(lockedGroups, { isManual: false });
  showMessage("No saved bracket was found, so a new locked bracket was created automatically.");
}

async function onSyncPlayers() {
  clearMessage();
  await syncPlayersFromTextFile({ silentIfMissing: false });

  const manualGroups = await loadManualLockedGroupsFromTextFile();
  if (manualGroups.length > 0) {
    lockedGroups = manualGroups;
    saveLockedGroups(lockedGroups);
    renderLockedBracket(lockedGroups, { isManual: true });
    showMessage("Players synced. groups.txt manual groups are locked and unchanged.");
    return;
  }

  if (lockedGroups.length > 0) {
    renderLockedBracket(lockedGroups, { isManual: false });
    showMessage("Players synced. Locked bracket kept unchanged.");
    return;
  }

  if (players.length < 8) {
    renderEmptyBracketState();
    showMessage("Need at least 8 players to create the locked bracket.", true);
    return;
  }

  lockedGroups = createLockedGroups(players);
  saveLockedGroups(lockedGroups);
  renderLockedBracket(lockedGroups, { isManual: false });
  showMessage("Locked bracket created. It will not change on refresh.");
}

function startLiveRefresh() {
  if (liveRefreshTimerId) {
    window.clearInterval(liveRefreshTimerId);
  }

  liveRefreshTimerId = window.setInterval(() => {
    void refreshLiveData();
  }, LIVE_REFRESH_INTERVAL_MS);
}

async function refreshLiveData() {
  const manualGroups = await loadManualLockedGroupsFromTextFile();
  if (manualGroups.length > 0) {
    if (!areGroupsEqual(lockedGroups, manualGroups)) {
      lockedGroups = manualGroups;
      saveLockedGroups(lockedGroups);
      renderLockedBracket(lockedGroups, { isManual: true });
      showMessage("Live update: groups.txt manual bracket applied.");
    }
    return;
  }

  await syncPlayersFromTextFile({
    silentIfMissing: true,
    suppressSuccessMessage: true,
  });

  if (lockedGroups.length > 0) {
    updateLastUpdatedTime();
  }
}

async function syncPlayersFromTextFile(options = {}) {
  const { silentIfMissing = false, suppressSuccessMessage = false } = options;

  try {
    const response = await fetch(`players.txt?t=${Date.now()}`);

    if (!response.ok) {
      throw new Error("Could not load players.txt");
    }

    const raw = await response.text();
    const result = importPlayersFromRaw(raw);

    players = result.players;
    window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(players));

    if (result.totalLines === 0) {
      if (!suppressSuccessMessage) {
        showMessage("No valid lines found in players.txt.", true);
      }
      return;
    }

    if (!suppressSuccessMessage) {
      showMessage(
        `Players synced: ${result.added} added, ${result.duplicates} duplicate(s), ${result.invalid} invalid line(s).`
      );
    }
  } catch {
    if (!silentIfMissing) {
      showMessage(
        "Could not load players.txt. Open app with a local server and confirm file exists.",
        true
      );
    }
  }
}

async function loadManualLockedGroupsFromTextFile() {
  try {
    const response = await fetch(`${MANUAL_GROUPS_FILE}?t=${Date.now()}`);

    if (!response.ok) {
      return [];
    }

    const raw = await response.text();
    return importGroupsFromRaw(raw);
  } catch {
    return [];
  }
}

function importGroupsFromRaw(raw) {
  const groupsByNumber = new Map();
  let currentGroupNumber = 0;

  const lines = String(raw).split(/\r?\n/);

  for (const originalLine of lines) {
    const line = normalizeText(originalLine);

    if (!line || line.startsWith("#")) {
      continue;
    }

    const groupHeader = line.match(/^group\s+(\d+)\b/i);
    if (groupHeader) {
      currentGroupNumber = Number(groupHeader[1]);

      if (!groupsByNumber.has(currentGroupNumber)) {
        groupsByNumber.set(currentGroupNumber, []);
      }

      continue;
    }

    if (currentGroupNumber <= 0) {
      continue;
    }

    const manualEntrant = parseManualGroupEntrantLine(line);
    if (!manualEntrant) {
      continue;
    }

    const group = groupsByNumber.get(currentGroupNumber);
    group.push({
      entrant: manualEntrant.entrant,
      seed: manualEntrant.seed,
      order: group.length,
    });
  }

  return [...groupsByNumber.entries()]
    .map(([, group]) =>
      group
        .sort((a, b) => {
          const seedA = Number.isFinite(a.seed) ? a.seed : Number.MAX_SAFE_INTEGER;
          const seedB = Number.isFinite(b.seed) ? b.seed : Number.MAX_SAFE_INTEGER;

          if (seedA !== seedB) {
            return seedA - seedB;
          }

          return a.order - b.order;
        })
        .map((item) => item.entrant)
    )
    .filter((group) => group.length > 0);
}

function parseManualGroupEntrantLine(line) {
  const normalizedLine = normalizeText(line);
  const seedMatch = normalizedLine.match(/^(\d+)\s*[.)]?\s*(.*)$/);
  const seed = seedMatch ? Number(seedMatch[1]) : NaN;
  const withoutSeedNumber = normalizeText(seedMatch ? seedMatch[2] : normalizedLine);

  if (!withoutSeedNumber) {
    return null;
  }

  const parsed = parsePlayerLine(withoutSeedNumber);
  if (!parsed) {
    return null;
  }

  const username = normalizeText(parsed.username);
  if (!username) {
    return null;
  }

  const rosterPlayer = players.find(
    (player) => player.username.toLowerCase() === username.toLowerCase()
  );

  if (rosterPlayer) {
    return {
      entrant: formatEntrant(rosterPlayer),
      seed,
    };
  }

  const faction = normalizeFaction(parsed.faction);
  const country = normalizeCountry(parsed.country);

  if (!faction || !country) {
    return {
      entrant: username,
      seed,
    };
  }

  return {
    entrant: formatEntrant({
      id: createId(),
      username,
      faction,
      country,
    }),
    seed,
  };
}

function importPlayersFromRaw(raw) {
  const lines = String(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const nextPlayers = [];
  let added = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const line of lines) {
    const parsed = parsePlayerLine(line);

    if (!parsed) {
      invalid += 1;
      continue;
    }

    const username = normalizeText(parsed.username);
    const faction = normalizeFaction(parsed.faction);
    const country = normalizeCountry(parsed.country);

    if (!username || !faction || !country) {
      invalid += 1;
      continue;
    }

    const duplicate = nextPlayers.some(
      (player) => player.username.toLowerCase() === username.toLowerCase()
    );

    if (duplicate) {
      duplicates += 1;
      continue;
    }

    nextPlayers.push({
      id: createId(),
      username,
      faction,
      country,
    });

    added += 1;
  }

  return {
    players: sortPlayers(nextPlayers),
    added,
    duplicates,
    invalid,
    totalLines: lines.length,
  };
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

function createLockedGroups(inputPlayers) {
  const randomized = shufflePlayers(inputPlayers);
  const groups = chunkIntoEight(randomized);

  return groups.map((group) => group.map((player) => formatEntrant(player)));
}

function renderLockedBracket(groups, options = {}) {
  const isManual = Boolean(options.isManual);

  bracketsEl.innerHTML = "";
  updateBracketMeta(groups);
  updateLastUpdatedTime();

  groups.forEach((group, groupIndex) => {
    const groupEntrants = normalizeGroupEntrants(group, GROUP_STAGE_SIZE);
    const rounds = buildRounds(groupEntrants, {
      preserveEntryOrder: true,
      skipForcedWinners: isManual,
    });
    const card = renderBracketCard(
      `Group ${groupIndex + 1} (${Math.min(group.length, GROUP_STAGE_SIZE)}/${GROUP_STAGE_SIZE})`,
      rounds,
      { cardIndex: groupIndex }
    );
    bracketsEl.appendChild(card);
  });

  if (groups.length > 1) {
    const championEntrants = groups.map((_, index) => `Winner Group ${index + 1}`);
    const championsRounds = buildRounds(championEntrants, {
      preserveEntryOrder: true,
      skipForcedWinners: isManual,
    });
    const championsCard = renderBracketCard("Champions Bracket", championsRounds, {
      cardIndex: groups.length,
    });
    bracketsEl.appendChild(championsCard);
  }
}

function renderBracketCard(title, rounds, options = {}) {
  const cardIndex = Number.isFinite(options.cardIndex) ? options.cardIndex : 0;
  const card = document.createElement("article");
  card.className = "group-card is-animated";
  card.style.setProperty("--card-delay", `${cardIndex * 80}ms`);

  card.innerHTML = `
    <h3 class="group-title">${escapeHtml(title)}</h3>
    <div class="bracket-grid">
      ${rounds
        .map(
          (round, roundIndex) => `
            <section class="round ${getRoundClassName(round.title)}" style="--round-index:${roundIndex};">
              <h4>${escapeHtml(round.title)}</h4>
              ${round.matches
                .map(
                  (match, index) => `
                    <div class="match" style="--match-index:${index};">
                      <span class="match-label">Match ${index + 1}</span>
                      ${renderEntrantMarkup(match.a)}
                      ${renderEntrantMarkup(match.b)}
                    </div>
                  `
                )
                .join("")}
            </section>
          `
        )
        .join("")}
    </div>
  `;

  return card;
}

function renderEntrantMarkup(label) {
  const normalized = normalizeText(label);

  if (!normalized) {
    return '<div class="player-line is-placeholder"><span class="entrant-name">TBD</span></div>';
  }

  const parsed = parseEntrantLabel(normalized);
  if (!parsed) {
    const placeholderClass = isPlaceholderEntrant(normalized) ? " is-placeholder" : "";
    return `<div class="player-line${placeholderClass}"><span class="entrant-name">${escapeHtml(
      normalized
    )}</span></div>`;
  }

  return `<div class="player-line"><span class="entrant-flag">${escapeHtml(
    parsed.flag
  )}</span><span class="entrant-name">${escapeHtml(parsed.username)}</span><span class="entrant-faction ${getFactionTierClass(
    parsed.faction
  )}">${escapeHtml(parsed.faction)}</span></div>`;
}

function parseEntrantLabel(label) {
  const match = label.match(/^(\S+)\s+(.*?)\s+\(([^)]+)\)$/);
  if (!match) {
    return null;
  }

  const flag = normalizeText(match[1]);
  const username = normalizeText(match[2]);
  const faction = normalizeFaction(match[3]);

  if (!flag || !username || !faction) {
    return null;
  }

  return {
    flag,
    username,
    faction,
  };
}

function getFactionTierClass(faction) {
  return FACTION_TIER_CLASS_BY_CODE[normalizeFaction(faction)] || "tier-neutral";
}

function isPlaceholderEntrant(label) {
  return /^(winner\s+round|winner\s+group|bye|tbd)/i.test(label);
}

function normalizeGroupEntrants(group, targetSize = GROUP_STAGE_SIZE) {
  const safeGroup = Array.isArray(group) ? group.map((item) => normalizeText(item)).filter(Boolean) : [];
  const trimmed = safeGroup.slice(0, targetSize);

  while (trimmed.length < targetSize) {
    trimmed.push("BYE");
  }

  return trimmed;
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

function buildRounds(entrants, options = {}) {
  const safeEntrants = [...entrants].filter(Boolean);
  const slots = nextPowerOfTwo(Math.max(2, safeEntrants.length));
  const preserveEntryOrder = Boolean(options.preserveEntryOrder);
  const skipForcedWinners = Boolean(options.skipForcedWinners);
  const seeded = preserveEntryOrder
    ? [...safeEntrants, ...new Array(Math.max(0, slots - safeEntrants.length)).fill("BYE")]
    : createSeedOrder(slots).map((seed) => safeEntrants[seed - 1] || "BYE");

  const rounds = [];
  let current = [];

  for (let i = 0; i < seeded.length; i += 2) {
    current.push({
      a: seeded[i],
      b: seeded[i + 1],
    });
  }

  let roundIndex = 1;
  while (current.length > 0) {
    rounds.push({
      title: getRoundTitle(current.length),
      matches: current,
    });

    if (current.length === 1) {
      break;
    }

    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const matchNumberA = i + 1;
      const matchNumberB = i + 2;
      next.push({
        a: `Winner Round ${roundIndex} Match ${matchNumberA}`,
        b: `Winner Round ${roundIndex} Match ${matchNumberB}`,
      });
    }

    current = next;
    roundIndex += 1;
  }

  const withByeAdvances = applyByeAutoAdvances(rounds);
  return skipForcedWinners ? withByeAdvances : applyForcedMatchWinners(withByeAdvances);
}

function applyByeAutoAdvances(rounds) {
  if (!Array.isArray(rounds) || rounds.length < 2) {
    return rounds;
  }

  for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex += 1) {
    const currentRound = rounds[roundIndex];

    currentRound.matches.forEach((match, matchIndex) => {
      const autoWinner = resolveAutoWinner(match.a, match.b);
      if (!autoWinner) {
        return;
      }

      const winnerToken = `Winner Round ${roundIndex + 1} Match ${matchIndex + 1}`;

      for (let nextRound = roundIndex + 1; nextRound < rounds.length; nextRound += 1) {
        rounds[nextRound].matches.forEach((nextMatch) => {
          if (nextMatch.a === winnerToken) {
            nextMatch.a = autoWinner;
          }

          if (nextMatch.b === winnerToken) {
            nextMatch.b = autoWinner;
          }
        });
      }
    });
  }

  return rounds;
}

function resolveAutoWinner(entrantA, entrantB) {
  const a = normalizeText(entrantA);
  const b = normalizeText(entrantB);

  if (a === "BYE" && b && b !== "BYE") {
    return entrantB;
  }

  if (b === "BYE" && a && a !== "BYE") {
    return entrantA;
  }

  return "";
}

function applyForcedMatchWinners(rounds) {
  if (!Array.isArray(rounds) || rounds.length < 2) {
    return rounds;
  }

  const firstRound = rounds[0];

  firstRound.matches.forEach((match, index) => {
    const forcedWinnerLabel = getForcedWinnerLabel(match.a, match.b);
    if (!forcedWinnerLabel) {
      return;
    }

    const winnerToken = `Winner Round 1 Match ${index + 1}`;

    for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
      rounds[roundIndex].matches.forEach((nextMatch) => {
        if (nextMatch.a === winnerToken) {
          nextMatch.a = forcedWinnerLabel;
        }

        if (nextMatch.b === winnerToken) {
          nextMatch.b = forcedWinnerLabel;
        }
      });
    }
  });

  return rounds;
}

function getForcedWinnerLabel(entrantA, entrantB) {
  const userA = extractEntrantUsername(entrantA).toLowerCase();
  const userB = extractEntrantUsername(entrantB).toLowerCase();

  for (const rule of FORCED_MATCH_WINNERS) {
    const contenders = Array.isArray(rule.contenders) ? rule.contenders : [];
    const contenderA = normalizeText(contenders[0] || "").toLowerCase();
    const contenderB = normalizeText(contenders[1] || "").toLowerCase();
    const winner = normalizeText(rule.winner).toLowerCase();

    if (!winner || !contenderA) {
      continue;
    }

    const hasWildcard = contenderA === "*" || contenderB === "*" || !contenderB;
    const isTargetMatch = hasWildcard
      ? [userA, userB].includes(contenderA === "*" ? contenderB : contenderA)
      : (userA === contenderA && userB === contenderB) ||
        (userA === contenderB && userB === contenderA);

    if (!isTargetMatch) {
      continue;
    }

    if (userA === winner) {
      return entrantA;
    }

    if (userB === winner) {
      return entrantB;
    }

    const winnerFromRoster = players.find(
      (player) => player.username.toLowerCase() === winner
    );

    return winnerFromRoster ? formatEntrant(winnerFromRoster) : rule.winner;
  }

  return "";
}

function extractEntrantUsername(entrant) {
  const normalized = normalizeText(entrant);
  const withFaction = normalized.match(/^(.*?)\s*\(([^)]+)\)$/);

  if (!withFaction) {
    return normalized;
  }

  let namePart = normalizeText(withFaction[1]);
  const firstToken = namePart.split(" ")[0] || "";

  if (firstToken && /^[^A-Za-z0-9_]+$/.test(firstToken)) {
    namePart = normalizeText(namePart.slice(firstToken.length));
  }

  return namePart;
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

function createSeedOrder(size) {
  if (size <= 2) {
    return [1, 2];
  }

  let order = [1, 2];
  while (order.length < size) {
    const mirror = order.length * 2 + 1;
    const next = [];

    order.forEach((seed) => {
      next.push(seed);
      next.push(mirror - seed);
    });

    order = next;
  }

  return order;
}

function nextPowerOfTwo(value) {
  let power = 1;

  while (power < value) {
    power *= 2;
  }

  return power;
}

function renderEmptyBracketState() {
  bracketsEl.innerHTML = '<p class="empty-state">No locked bracket available yet.</p>';
  updateBracketMeta([]);
  updateLastUpdatedTime();
}

function updateBracketMeta(groups) {
  if (!Array.isArray(groups)) {
    return;
  }

  if (groupCountEl) {
    groupCountEl.textContent = String(groups.length);
  }

  if (entrantCountEl) {
    const entrantCount = groups.reduce((sum, group) => sum + (Array.isArray(group) ? group.length : 0), 0);
    entrantCountEl.textContent = String(entrantCount);
  }
}

function updateLastUpdatedTime() {
  if (!lastUpdatedEl) {
    return;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
  });

  lastUpdatedEl.textContent = formatter.format(new Date());
}

function areGroupsEqual(groupA, groupB) {
  return JSON.stringify(groupA || []) === JSON.stringify(groupB || []);
}

function loadPlayersFromStorage() {
  try {
    const raw = window.localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortPlayers(
      parsed
        .filter((item) => item && item.username && item.faction && item.country)
        .map((item) => ({
          id: item.id || createId(),
          username: normalizeText(item.username),
          faction: normalizeFaction(item.faction),
          country: normalizeCountry(item.country),
        }))
    );
  } catch {
    return [];
  }
}

function loadLockedGroups() {
  try {
    const storageKeys = [
      LOCKED_BRACKET_KEY,
      LOCKED_BRACKET_BACKUP_KEY,
      ...LEGACY_LOCKED_BRACKET_KEYS,
    ];

    let sourceKey = "";
    let sourceGroups = [];

    for (const key of storageKeys) {
      const raw = window.localStorage.getItem(key);
      const parsedGroups = parseStoredLockedGroups(raw);

      if (!parsedGroups.length) {
        continue;
      }

      sourceKey = key;
      sourceGroups = parsedGroups;
      break;
    }

    if (!sourceGroups.length) {
      return [];
    }

    const groups = sourceGroups
      .map((group) => (Array.isArray(group) ? group.map((name) => normalizeText(name)).filter(Boolean) : []))
      .filter((group) => group.length > 0);

    const migrated = groups.map((group) => group.map((entry) => migrateLockedEntrantLabel(entry)));
    if (sourceKey !== LOCKED_BRACKET_KEY || JSON.stringify(groups) !== JSON.stringify(migrated)) {
      saveLockedGroups(migrated);
    }

    return migrated;
  } catch {
    return [];
  }
}

function parseStoredLockedGroups(raw) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && Array.isArray(parsed.groups)) {
      return parsed.groups;
    }

    if (parsed && Array.isArray(parsed.lockedGroups)) {
      return parsed.lockedGroups;
    }

    return [];
  } catch {
    return [];
  }
}

function migrateLockedEntrantLabel(entry) {
  const normalized = normalizeText(entry);
  const withoutFlag = normalized.replace(/^\S+\s+/, "");
  const userMatch = withoutFlag.match(/^(.*?)\s*\(([^)]+)\)$/);

  if (userMatch) {
    const username = normalizeText(userMatch[1]);
    const forcedReplacement = getLockedEntrantReplacement(username);

    if (forcedReplacement) {
      return formatEntrant(forcedReplacement);
    }

    const fromPlayer = players.find(
      (player) => player.username.toLowerCase() === username.toLowerCase()
    );

    if (fromPlayer) {
      return formatEntrant(fromPlayer);
    }
  }

  return normalized
    .replace(/\(TWL\)/gi, "(271ST)")
    .replace(/\(LAS\)/gi, "(INS)")
    .replace(/\(URF\s*\/\s*AH\)/gi, "(AH)");
}

function getLockedEntrantReplacement(username) {
  const key = normalizeText(username).toLowerCase();
  const replacements = {
    "zoki.1_61889": {
      username: "MainPanda",
      faction: "DK",
      country: "USA",
    },
    zoki1gugu: {
      username: "MainPanda",
      faction: "DK",
      country: "USA",
    },
    narunaru8641: {
      username: "quackenxnator",
      faction: "AH",
      country: "USA",
    },
    ebes_7368762218: {
      username: "quackenxnator",
      faction: "AH",
      country: "USA",
    },
    lettinggodsortemout: {
      username: "ImperatorVult",
      faction: "DK",
      country: "United Kingdom",
    },
  };

  return replacements[key] || null;
}

function saveLockedGroups(groups) {
  const payload = JSON.stringify({
    groups,
    createdAt: Date.now(),
  });

  window.localStorage.setItem(LOCKED_BRACKET_KEY, payload);
  window.localStorage.setItem(LOCKED_BRACKET_BACKUP_KEY, payload);
  window.localStorage.setItem(LEGACY_LOCKED_BRACKET_KEYS[1], JSON.stringify(groups));
}

function chunkIntoEight(data) {
  const groups = [];

  for (let i = 0; i < data.length; i += GROUP_STAGE_SIZE) {
    groups.push(data.slice(i, i + GROUP_STAGE_SIZE));
  }

  return groups;
}

function shufflePlayers(data) {
  const output = [...data];

  for (let i = output.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    const temp = output[i];
    output[i] = output[swapIndex];
    output[swapIndex] = temp;
  }

  return output;
}

function formatEntrant(player) {
  const flag = getCountryFlag(player.country);
  return `${flag} ${player.username} (${player.faction})`;
}

function getCountryFlag(countryName) {
  const countryCodeMap = {
    Afghanistan: "AF",
    Argentina: "AR",
    Australia: "AU",
    Brazil: "BR",
    Canada: "CA",
    China: "CN",
    Colombia: "CO",
    Czechia: "CZ",
    "Czech Republic": "CZ",
    Denmark: "DK",
    Ecuador: "EC",
    Germany: "DE",
    India: "IN",
    Italy: "IT",
    Kazakhstan: "KZ",
    Korea: "KR",
    Malaysia: "MY",
    Mexico: "MX",
    Morocco: "MA",
    Netherlands: "NL",
    Philippines: "PH",
    Poland: "PL",
    Romania: "RO",
    Russia: "RU",
    Serbia: "RS",
    Slovakia: "SK",
    Spain: "ES",
    Turkey: "TR",
    USA: "US",
    "United Kingdom": "GB",
    "United States": "US",
    Uzbekistan: "UZ",
    Vietnam: "VN",
  };

  const normalized = normalizeCountry(countryName);
  const code = countryCodeMap[normalized];
  if (!code) {
    return "🏳";
  }

  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

function sortPlayers(data) {
  return [...data].sort((a, b) => {
    const factionCompare = a.faction.localeCompare(b.faction, undefined, {
      sensitivity: "base",
    });

    if (factionCompare !== 0) {
      return factionCompare;
    }

    const countryCompare = a.country.localeCompare(b.country, undefined, {
      sensitivity: "base",
    });

    if (countryCompare !== 0) {
      return countryCompare;
    }

    return a.username.localeCompare(b.username, undefined, {
      sensitivity: "base",
    });
  });
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
  };

  return aliases[raw] || raw;
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
    "and us": "USA",
    "united stated": "United States",
    "united states": "United States",
    "united states of america": "United States",
    uk: "United Kingdom",
    england: "United Kingdom",
    britain: "United Kingdom",
    "great britain": "United Kingdom",
    "united kingdom": "United Kingdom",
    "sydney australia": "Australia",
    turkiye: "Turkey",
  };

  if (aliases[aliasKey]) {
    return aliases[aliasKey];
  }

  return toTitleCaseWords(raw);
}

function toTitleCaseWords(value) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle("err", Boolean(isError));
  messageEl.classList.toggle("ok", !isError);
}

function clearMessage() {
  messageEl.textContent = "";
  messageEl.classList.remove("err", "ok");
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
