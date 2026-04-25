(function () {
  "use strict";

  // ── Maintenance Mode Injection (DISABLED) ──
  // To re-enable, uncomment the block below.
  /*
  (function injectMaintenance() {
    const overlay = document.createElement("div");
    overlay.className = "maintenance-overlay";
    overlay.innerHTML = `
      <div class="maintenance-content">
        <div class="maintenance-banner">
          <h1>TEMPORARY OUT OF WORK</h1>
        </div>
        <p class="maintenance-message">
          The Ascend Entrenched platform is currently undergoing essential maintenance. 
          Operations are temporarily suspended to ensure system stability.
        </p>
        <p class="maintenance-sub">System Status: Maintenance Mode Active</p>
      </div>
    `;
    
    // Block interactions
    overlay.addEventListener("click", (e) => e.stopPropagation());
    overlay.addEventListener("keydown", (e) => e.stopPropagation());

    document.documentElement.appendChild(overlay);
    document.body.style.overflow = "hidden";
    document.body.style.pointerEvents = "none";
  })();
  */

  let fallbackPlayerLines = [];
  let avatarIdMap = new Map();
  let staticAvatarUrlMap = new Map();
  let globalDataPromise = null;

  async function loadGlobalData() {
    try {
      const [playerRes, mappingRes] = await Promise.all([
        fetch("data/fallback_players.json", { cache: "no-store" }),
        fetch("data/mappings.json", { cache: "no-store" })
      ]);

      if (playerRes.ok) {
        fallbackPlayerLines = await playerRes.json();
      }

      if (mappingRes.ok) {
        const mappings = await mappingRes.json();

        if (mappings.avatarIdMap) {
          avatarIdMap = new Map(Object.entries(mappings.avatarIdMap));
          window.avatarIdMap = avatarIdMap;
        }

        if (mappings.staticAvatarUrlMap) {
          staticAvatarUrlMap = new Map(Object.entries(mappings.staticAvatarUrlMap));
          window.staticAvatarUrlMap = staticAvatarUrlMap;
        }
      }
    } catch (err) {
      console.error("Critical: Failed to load global fallback data.", err);
    }
  }

  // Expose core constants to window immediately with defaults
  window.avatarIdMap = avatarIdMap;
  window.staticAvatarUrlMap = staticAvatarUrlMap;
  window.fallbackAvatarId = 1;

  // Expose core headshot functions and utilities to window
  window.loadGlobalData = loadGlobalData;
  window.getStaticAvatarUrl = getStaticAvatarUrl;
  window.getRobloxHeadshotUrl = getRobloxHeadshotUrl;
  window.getFallbackAvatarUrl = getFallbackAvatarUrl;
  window.escapeHtml = escapeHtml;
  window.normalizeText = normalizeText;
  window.sanitizeFactionValue = sanitizeFactionValue;
  window.normalizePlayerClassValue = normalizePlayerClassValue;
  window.normalizePlayerClassList = normalizePlayerClassList;
  window.splitFactionTokens = splitFactionTokens;

  // Data Loading & Processing (Used by Leaderboard/War Room)
  window.loadPlayerLines = loadPlayerLines;
  window.parsePlayerLine = parsePlayerLine;
  window.fetchAvatarUrls = fetchAvatarUrls;
  window.fetchTopBodyAvatar = fetchTopBodyAvatar;
  window.resolveRobloxUserIdsByUsernames = resolveRobloxUserIdsByUsernames;

  // Visual & Formatting Utilities
  window.buildFactionChipHtml = buildFactionChipHtml;
  window.countryToFlag = countryToFlag;
  window.getPrimaryFactionBackgroundImage = getPrimaryFactionBackgroundImage;
  window.getClassIconPath = getClassIconPath;
  window.getFactionFlagPath = getFactionFlagPath;

  const playersGrid = document.getElementById("playersGrid");
  const modal = document.getElementById("playerModal");
  const modalPanelNode = modal?.querySelector(".modal-panel") || null;
  const closeModalButton = document.getElementById("closeModal");
  const modalAvatar = document.getElementById("modalAvatar");
  const modalName = document.getElementById("modalName");
  const modalFaction = document.getElementById("modalFaction");
  const modalCountry = document.getElementById("modalCountry");
  const modalElo = document.getElementById("modalElo");
  const modalWL = document.getElementById("modalWL");
  const modalChange = document.getElementById("modalChange");
  const modalDiscord = document.getElementById("modalDiscord");
  const topPlayerCard = document.getElementById("topPlayerCard");
  const topPlayerNameNode = document.getElementById("topPlayerName");
  const topPlayerSubtitleNode = document.getElementById("topPlayerSubtitle");
  const topPlayerEloNode = document.getElementById("topPlayerEloValue");
  const topPlayerWlNode = document.getElementById("topPlayerWlValue");
  const topCountryBadgeNode = document.getElementById("topCountryBadge");
  const topPlayerAvatarNode = document.getElementById("topPlayerAvatar");
  const topFactionBadgeNode = document.getElementById("topFactionBadge");

  const GROUP_SIZE = 6;
  const GROUP_DELAY_MS = 130;
  const WAVE_DELAY_MS = 34;
  const AVATAR_SIZE = "720x720";
  const AVATAR_FORMAT = "Png";
  const TOP_PLAYER_NAME = "20SovietSO21";
  const TOP_PLAYER_OVERRIDES = {
    elo: 3200,
    wins: 150,
    losses: 42,
    subtitle: "Dominating recent matches with top performance."
  };
  const KAWAII_PLAYERS = new Set([
    "tamika2006s",
    "sonyah13",
    "nessa2008s",
    "maryanette_nsp"
  ]);
  function isKawaiiPlayer(name) {
    return KAWAII_PLAYERS.has(String(name || "").trim().toLowerCase());
  }
  function buildKawaiiDecorHtml() {
    // HTML entities for maximum cross-browser compatibility
    return `<div class="kawaii-decor">
      <span class="kawaii-particle kawaii-heart kp-1">&#128156;</span>
      <span class="kawaii-particle kawaii-sparkle kp-2">&#10024;</span>
      <span class="kawaii-particle kawaii-heart kp-3">&#128150;</span>
      <span class="kawaii-particle kawaii-star kp-4">&#11088;</span>
      <span class="kawaii-particle kawaii-sparkle kp-5">&#10024;</span>
      <span class="kawaii-particle kawaii-heart kp-6">&#128156;</span>
      <span class="kawaii-particle kawaii-star kp-7">&#127800;</span>
      <span class="kawaii-particle kawaii-sparkle kp-8">&#128171;</span>
    </div>`;
  }
  const FULL_BODY_SIZE = "720x720";
  const DISBANDED_FACTIONS = new Set(["TWL"]);
  const WEB_SYNC_ENDPOINT = "/api/leaderboard-config";
  const LFG_FEED_ENDPOINT = "/api/lfg-queue.js";
  const OPS_SYNC_INTERVAL_MS = 90000;
  const LFG_SYNC_INTERVAL_MS = 15000;
  const OPS_MOTD_INTERVAL_MS = 8000;
  const FACTION_NEWS_ROTATE_MS = 7000;
  const NEWS_FEED_FILES = ["new.txt", "news.txt"];
  const OPS_MOTD_MESSAGES = [
    "Ascend Entrenched live grid online.",
    "Leaderboard intelligence stream active.",
    "Global Statistics uplink stable. Maintain pressure.",
    "Faction movement updated from latest roster.",
    "Operator performance feed synchronized."
  ];
  const factionFlagMap = new Map([
    ["72ND", "faction_flags/72ND.png"],
    ["AEF", "faction_flags/AEF.png"],
    ["AH", "faction_flags/AH.png"],
    ["ASHEN GUARD", "faction_flags/ASHEN GUARD.png"],
    ["BS", "faction_flags/BS.png"],
    ["CSZK", "faction_flags/CZSK.png"],
    ["CZSK", "faction_flags/CZSK.png"],
    ["DK", "faction_flags/DK.png"],
    ["DSA", "faction_flags/DSA.png"],
    ["IA", "faction_flags/IA.png"],
    ["INS", "faction_flags/INS.png"],
    ["KOC", "faction_flags/KOC.png"],
    ["NDV", "faction_flags/NDV.png"],
    ["NYS", "faction_flags/NYS.png"],
    ["RRF", "faction_flags/RRF.png"],
    ["SR", "faction_flags/SR.png"],
    ["SEM", "faction_flags/SEM.png"],
    ["TAE", "faction_flags/TAE.png"],
    ["TCL", "faction_flags/TCL.png"],
    ["TIO", "faction_flags/TIO.png"],
    ["TTI", "faction_flags/tti.png"],
    ["TWA", "faction_flags/TWA.png"],
    ["URF", "faction_flags/URF.png"]
  ]);
  const factionTokenAliasMap = new Map([
    ["CSZK", "CZSK"],
    ["SERMETYA", "SR"]
  ]);
  const classIconMap = new Map([
    ["ENGINEER", "classes icons/Engineer_Icon.webp"],
    ["OFFICER", "classes icons/Officer-icon.webp"],
    ["RECON", "classes icons/Recon_Icon.webp"],
    ["RIFLEMAN", "classes icons/Rifleman-icon.webp"],
    ["SKIRMISHER", "classes icons/Skirmisher-icon.webp"]
  ]);

  let opsHudNodes = null;
  let opsHudClockIntervalId = null;
  let opsHudSyncIntervalId = null;
  let lfgSyncIntervalId = null;

  function isAdminPanelPage() {
    const pathname = String(window.location.pathname || "").toLowerCase();
    return pathname.endsWith("/entrenched-sysadmin-ops-portal.html")
      || pathname.endsWith("entrenched-sysadmin-ops-portal.html")
      || pathname.endsWith("/admin")
      || Boolean(document.querySelector(".admin-content"));
  }
  let opsHudMotdIntervalId = null;
  let opsHudMotdIndex = 0;
  let factionNewsRotateIntervalId = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return escapeHtml(String(value || "").replace(/\s+/g, " ").trim());
  }

  function splitFactionTokens(faction) {
    const normalized = normalizeText(faction).toUpperCase();
    if (!normalized || normalized.toUpperCase() === "N/A") {
      return ["N/A"];
    }

    const filteredTokens = normalized
      .split(/[\/,&|]+/)
      .map((part) => normalizeText(part).toUpperCase())
      .map((token) => factionTokenAliasMap.get(token) || token)
      .filter((token) => Boolean(token) && !DISBANDED_FACTIONS.has(token));

    if (!filteredTokens.length) {
      return ["N/A"];
    }

    return [...new Set(filteredTokens)];
  }

  function sanitizeFactionValue(faction) {
    const tokens = splitFactionTokens(faction);
    if (!tokens.length || (tokens.length === 1 && tokens[0] === "N/A")) {
      return "N/A";
    }

    return tokens.join("/");
  }

  function normalizePlayerClassValue(value) {
    const normalized = normalizeText(value).toLowerCase();
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

  function getClassIconPath(playerClass) {
    const key = String(normalizePlayerClassValue(playerClass) || "Unknown").toUpperCase();
    const iconPath = classIconMap.get(key) || "";
    return iconPath ? encodeURI(iconPath) : "";
  }

  function getFactionFlagPath(token) {
    return factionFlagMap.get(String(token || "").toUpperCase()) || "";
  }

  function getPrimaryFactionBackgroundImage(faction) {
    const token = splitFactionTokens(faction).find((entry) => entry !== "N/A") || "";
    const flagPath = getFactionFlagPath(token);
    if (!flagPath) {
      return "none";
    }

    return `url("${encodeURI(flagPath)}")`;
  }

  function buildFactionChipHtml(faction, options = {}) {
    const {
      chipClass = "player-faction-chip",
      maxItems = 1,
      includeGroupWrapper = false,
      groupClass = ""
    } = options;

    const tokens = splitFactionTokens(faction).slice(0, Math.max(1, maxItems));
    const chips = tokens.map((token) => {
      const safeToken = escapeHtml(token);
      const flagPath = getFactionFlagPath(token);
      const flagMarkup = flagPath
        ? `<img class="faction-flag-icon" src="${flagPath}" alt="${safeToken} flag" loading="lazy">`
        : "";

      return `<span class="${chipClass}">${flagMarkup}${safeToken}</span>`;
    }).join("");

    if (!includeGroupWrapper) {
      return chips;
    }

    return `<span class="${groupClass}">${chips}</span>`;
  }

  function parsePlayerLine(rawLine) {
    const line = normalizeText(rawLine);
    if (!line) {
      return null;
    }

    // Accept synced core format: Name | UserId | ProfileLink | DiscordId | Faction | Country
    const pipeParts = line.split("|").map((part) => normalizeText(part));
    if (pipeParts.length >= 5) {
      const rawName = pipeParts[0] || "";
      const rawUserId = pipeParts[1] || "";
      const rawProfileLink = pipeParts[2] || "";
      const rawDiscordId = pipeParts[3] || "";
      const rawFaction = pipeParts[4] || "N/A";
      const rawCountry = pipeParts[5] || "N/A";

      const name = normalizeText(rawName.replace(/^\d+\s*\.?\s*/, ""));
      if (name) {
        const lowerName = name.toLowerCase();
        const directUserId = normalizeSyncedUserId(rawUserId);
        const profileUserId = normalizeSyncedUserId(rawProfileLink);
        const mappedUserId = Number(avatarIdMap.get(lowerName) || fallbackAvatarId);
        const resolvedUserId = Number(directUserId || profileUserId || mappedUserId || fallbackAvatarId);

        if (Number.isFinite(resolvedUserId) && resolvedUserId > 0) {
          avatarIdMap.set(lowerName, resolvedUserId);
        }

        return {
          name,
          faction: sanitizeFactionValue(rawFaction || "N/A"),
          country: normalizeText(rawCountry) || "N/A",
          discordId: normalizeSyncedDiscordId(rawDiscordId),
          userId: Number.isFinite(resolvedUserId) && resolvedUserId > 0 ? resolvedUserId : fallbackAvatarId,
          avatarUrl: "",
          bodyAvatarUrl: "",
          elo: Number(p.elo ?? 1000),
          wins: Number(p.wins || 0),
          losses: Number(p.losses || 0),
          playerClasses: [],
          playerClass: "Unknown",
          device: "Unknown"
        };
      }
    }

    const withoutIndex = line.replace(/^\d+\s*\.?\s*/, "");
    const discordMatch = withoutIndex.match(/-\s*(\d{8,})\s*$/);
    const discordId = discordMatch ? discordMatch[1] : "";
    const withoutDiscord = discordMatch
      ? withoutIndex.slice(0, discordMatch.index).trim()
      : withoutIndex;
    const dataMatch = withoutDiscord.match(/^(.*?)\s*-\s*Faction:\s*(.*?)\s*\|\s*Country:\s*(.*?)\s*$/i);
    if (!dataMatch) {
      return null;
    }

    const name = normalizeText(dataMatch[1]);
    const faction = sanitizeFactionValue(dataMatch[2]);
    const country = normalizeText(dataMatch[3]) || "N/A";

    if (!name) {
      return null;
    }

    return {
      name,
      faction,
      country,
      discordId,
      userId: avatarIdMap.get(name.toLowerCase()) ?? fallbackAvatarId,
      avatarUrl: "",
      bodyAvatarUrl: "",
      elo: 1000,
      wins: 0,
      losses: 0,
      playerClasses: [],
      playerClass: "Unknown",
      device: "Unknown"
    };
  }

  function getStaticAvatarUrl(userId) {
    return staticAvatarUrlMap.get(String(userId || fallbackAvatarId)) || "";
  }

  function getRobloxHeadshotUrl(userId, size = 420) {
    const normalized = String(userId || "").trim();
    if (!/^\d{3,14}$/.test(normalized) || normalized === String(fallbackAvatarId)) {
      return "";
    }

    const safeSize = Number.isFinite(Number(size)) ? Math.max(48, Math.min(720, Number(size))) : 420;
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(normalized)}&width=${safeSize}&height=${safeSize}&format=png`;
  }

  function getThumbnailApiUrl(userIds) {
    const params = new URLSearchParams({
      userIds: userIds.join(","),
      size: AVATAR_SIZE,
      format: AVATAR_FORMAT,
      isCircular: "false"
    });

    return `https://thumbnails.roblox.com/v1/users/avatar-headshot?${params.toString()}`;
  }

  function getFallbackAvatarUrl(name) {
    const safeName = normalizeText(name) || "Player";
    const initials = safeName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("") || "P";

    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='720' height='720' viewBox='0 0 720 720'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#0f1f39'/>
        <stop offset='70%' stop-color='#0a1328'/>
        <stop offset='100%' stop-color='#07101f'/>
      </linearGradient>
    </defs>
    <rect width='720' height='720' fill='url(#bg)'/>
    <circle cx='560' cy='160' r='220' fill='rgba(59,130,246,0.28)'/>
    <text x='50%' y='53%' dominant-baseline='middle' text-anchor='middle' fill='#93C5FD' font-family='Arial, sans-serif' font-size='220' font-weight='700'>${initials}</text>
  </svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function applyImageFallbackChain(node, candidates) {
    if (!node) {
      return;
    }

    const queue = [];
    (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
      const value = String(candidate || "").trim();
      if (!value || queue.includes(value)) {
        return;
      }

      queue.push(value);
    });

    if (!queue.length) {
      return;
    }

    let pointer = 0;
    node.onerror = () => {
      pointer += 1;
      if (pointer >= queue.length) {
        node.onerror = null;
        return;
      }

      node.src = queue[pointer];
    };

    node.src = queue[0];
  }

  function countryToFlag(country) {
    const normalized = normalizeText(country).toLowerCase();
    const map = {
      turkey: "TR",
      albania: "AL",
      spain: "ES",
      slovakia: "SK",
      vietnam: "VN",
      england: "GB",
      sweden: "SE",
      denmark: "DK",
      germany: "DE",
      czechia: "CZ",
      "czech republic": "CZ",
      india: "IN",
      america: "US",
      usa: "US",
      us: "US",
      poland: "PL",
      morocco: "MA",
      scotland: "GB",
      pakistan: "PK",
      uk: "GB",
      "united kingdom": "GB",
      uzbekistan: "UZ",
      netherlands: "NL",
      korea: "KR",
      kazakhstan: "KZ",
      italy: "IT",
      australia: "AU",
      russia: "RU",
      malaysia: "MY",
      romania: "RO",
      philippines: "PH"
    };

    const code = map[normalized];
    if (!code) {
      return "🌍";
    }

    return String.fromCodePoint(
      ...code
        .toUpperCase()
        .split("")
        .map((char) => 127397 + char.charCodeAt(0))
    );
  }

  function formatRelativeSyncTime(updatedAt) {
    const value = String(updatedAt || "").trim();
    if (!value) {
      return "No sync timestamp";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "Invalid sync timestamp";
    }

    const deltaMs = Date.now() - parsed.getTime();
    if (deltaMs < 0) {
      return "Synced just now";
    }

    const minutes = Math.floor(deltaMs / 60000);
    if (minutes < 1) {
      return "Synced moments ago";
    }

    if (minutes < 60) {
      return `Synced ${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `Synced ${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    return `Synced ${days}d ago`;
  }

  function computeFactionPulse(players) {
    const list = Array.isArray(players) ? players : [];
    const map = new Map();

    list.forEach((player) => {
      const tokens = splitFactionTokens(player.faction).filter((token) => token !== "N/A");
      const uniqueTokens = [...new Set(tokens)];
      if (!uniqueTokens.length) {
        return;
      }

      uniqueTokens.forEach((token) => {
        const current = map.get(token) || {
          token,
          members: 0,
          eloTotal: 0
        };

        current.members += 1;
        current.eloTotal += Number(player.elo || 1000);
        map.set(token, current);
      });
    });

    return [...map.values()]
      .sort((a, b) => {
        if (b.members !== a.members) {
          return b.members - a.members;
        }

        return b.eloTotal - a.eloTotal;
      })
      .map((item) => ({
        ...item,
        avgElo: item.members ? (item.eloTotal / item.members) : 1000
      }));
  }

  function summarizeArticleText(text, maxLength = 220) {
    const clean = normalizeText(text);
    if (!clean) {
      return "No summary available.";
    }

    if (clean.length <= maxLength) {
      return clean;
    }

    return `${clean.slice(0, maxLength).trim()}...`;
  }

  function detectArticleTag(text) {
    const target = String(text || "").toUpperCase();
    const knownTokens = [
      "AH", "URF", "DK", "CZSK", "NDV", "RKA", "TWA", "TCL", "TAE", "AEF", "IA", "DSA", "TSC"
    ];

    const found = knownTokens.filter((token) => {
      const pattern = new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`, "i");
      return pattern.test(target);
    });

    if (!found.length) {
      return "Community";
    }

    return found.slice(0, 2).join("/");
  }

  function parseEntrenchedTimesArticles(rawText) {
    const text = String(rawText || "").replace(/\r/g, "");
    const lines = text.split("\n");
    const articles = [];
    let current = null;

    lines.forEach((rawLine) => {
      const line = String(rawLine || "");
      const headingMatch = line.match(/^\s*#\s+(.+)$/);
      if (headingMatch) {
        if (current && current.title) {
          articles.push(current);
        }

        current = {
          title: normalizeText(headingMatch[1]),
          lines: []
        };
        return;
      }

      if (!current) {
        return;
      }

      current.lines.push(line);
    });

    if (current && current.title) {
      articles.push(current);
    }

    const normalized = articles
      .map((entry) => {
        const paragraphs = entry.lines
          .map((line) => normalizeText(line))
          .filter(Boolean);
        const body = paragraphs.join(" ");
        const urlMatch = body.match(/https?:\/\/\S+/i);
        const link = urlMatch ? urlMatch[0] : "";
        const cleanBody = link ? body.replace(link, "").trim() : body;

        return {
          title: entry.title,
          tag: detectArticleTag(`${entry.title} ${cleanBody}`),
          body: cleanBody,
          summary: summarizeArticleText(cleanBody),
          link
        };
      })
      .filter((entry) => Boolean(entry.title));

    if (normalized.length) {
      return normalized;
    }

    const blocks = text
      .split(/\n\s*\n+/)
      .map((chunk) => normalizeText(chunk))
      .filter(Boolean);

    return blocks.slice(0, 8).map((chunk, index) => {
      const [firstSentence, ...rest] = chunk.split(".");
      const title = firstSentence ? `${firstSentence.trim()}.` : `Community Update ${index + 1}`;
      const body = rest.join(".").trim() || chunk;

      return {
        title,
        tag: detectArticleTag(chunk),
        body,
        summary: summarizeArticleText(body),
        link: ""
      };
    });
  }

  async function fetchEntrenchedTimesNews() {
    for (const fileName of NEWS_FEED_FILES) {
      try {
        const response = await fetch(fileName, { cache: "no-store" });
        if (!response.ok) {
          continue;
        }

        const raw = await response.text();
        const articles = parseEntrenchedTimesArticles(raw);
        if (articles.length) {
          return {
            source: fileName,
            articles
          };
        }
      } catch {
        // Try next candidate file.
      }
    }

    return {
      source: "",
      articles: []
    };
  }

  function ensureOpsHud() {
    // Command Grid is disabled by request; keep HUD logic inert.
    return null;

    if (!isAdminPanelPage()) {
      return null;
    }

    if (opsHudNodes) {
      return opsHudNodes;
    }

    const heroNode = document.querySelector(".hero");
    if (!heroNode) {
      return null;
    }

    const section = document.createElement("section");
    section.className = "ops-hud";
    section.setAttribute("aria-label", "Ascend Entrenched operations hub");
    section.innerHTML = `
    <div class="ops-hud-head">
      <h2>Ascend Entrenched Command Grid</h2>
      <div class="ops-hud-right">
        <div class="ops-hud-actions">
          <a class="ops-hud-link" href="leaderboard.html">Leaderboard</a>
          <a class="ops-hud-link" href="statistics.html">Statistics</a>
          <button type="button" id="opsHudRefresh" class="ops-hud-link">Refresh Sync</button>
        </div>
      </div>
    </div>
    <div class="ops-hud-grid">
      <article class="ops-hud-chip">
        <span>Website API</span>
        <strong id="opsHudApiState">Checking...</strong>
      </article>
      <article class="ops-hud-chip">
        <span>Global Sync</span>
        <strong id="opsHudSyncState">Awaiting data...</strong>
      </article>
      <article class="ops-hud-chip">
        <span>Data Source</span>
        <strong id="opsHudDataSource">Unknown</strong>
      </article>
      <article class="ops-hud-chip">
        <span>UTC Clock</span>
        <strong id="opsHudClock">--:--:--</strong>
      </article>
    </div>
    <p id="opsHudMotd" class="ops-hud-motd">${OPS_MOTD_MESSAGES[0]}</p>
  `;

    heroNode.insertAdjacentElement("afterend", section);

    const dock = ensureLfgDock();

    opsHudNodes = {
      root: section,
      apiState: section.querySelector("#opsHudApiState"),
      syncState: section.querySelector("#opsHudSyncState"),
      dataSource: section.querySelector("#opsHudDataSource"),
      clock: section.querySelector("#opsHudClock"),
      motd: section.querySelector("#opsHudMotd"),
      refreshButton: section.querySelector("#opsHudRefresh"),
      lfgCount: dock?.lfgCount || null,
      lfgList: dock?.lfgList || null
    };

    if (opsHudNodes.refreshButton) {
      opsHudNodes.refreshButton.addEventListener("click", () => {
        runOpsSyncCheck(true);
      });
    }

    return opsHudNodes;
  }

  function startOpsHud() {
    const nodes = ensureOpsHud();
    if (!nodes) {
      return;
    }

    updateOpsHudClock();
    runOpsSyncCheck();
    runLfgQueueSync();
    startOpsHudMotdRotation();
    startLfgQueueSystem();
  }

  function startLiveGameIntel() {
    const heroNode = document.querySelector(".hero");
    if (!heroNode) return;

    let intelNode = document.getElementById("gameLiveIntel");
    if (!intelNode) {
      intelNode = document.createElement("div");
      intelNode.id = "gameLiveIntel";
      intelNode.className = "game-intel-pulse";
      const statusBanner = heroNode.querySelector(".live-pulse");
      if (statusBanner) {
        statusBanner.insertAdjacentElement("afterend", intelNode);
      } else {
        heroNode.appendChild(intelNode);
      }
    }

    async function refreshIntel() {
      try {
        const res = await fetch("/api/game-info", { cache: "no-store" });
        const data = await res.json();
        if (data.ok && data.stats) {
          const { playing, visits } = data.stats;
          const formattedVisits = Number(visits).toLocaleString();
          intelNode.innerHTML = `
            <div class="intel-item">
              <span class="intel-label">Active Players</span>
              <strong class="intel-value">${playing}</strong>
            </div>
            <div class="intel-sep"></div>
            <div class="intel-item">
              <span class="intel-label">Total Visits</span>
              <strong class="intel-value">${formattedVisits}</strong>
            </div>
          `;
          intelNode.classList.add("is-visible");
        }
      } catch (err) {
        console.warn("Failed to fetch game intel:", err);
      }
    }

    refreshIntel();
    window.setInterval(refreshIntel, 60000);
  }

  function ensureLfgDock() {
    if (isAdminPanelPage()) {
      return null;
    }

    const existing = document.getElementById("opsLfgDock");
    if (existing) {
      const isHidden = localStorage.getItem("opsLfgDockHidden") === "true";
      existing.classList.toggle("hidden", isHidden);
      return {
        root: existing,
        lfgCount: existing.querySelector("#opsLfgCount"),
        lfgList: existing.querySelector("#opsLfgList"),
        lfgMeta: existing.querySelector("#opsLfgMeta")
      };
    }

    const dock = document.createElement("aside");
    dock.id = "opsLfgDock";
    dock.className = "ops-lfg-dock";
    const isHidden = localStorage.getItem("opsLfgDockHidden") === "true";
    if (isHidden) dock.classList.add("hidden");

    dock.setAttribute("aria-label", "Live 1v1 queue");
    dock.innerHTML = `
    <div class="ops-lfg-head">
      <div class="ops-lfg-title-wrap">
        <span>Live 1v1 Queue</span>
        <small id="opsLfgMeta">Syncing...</small>
      </div>
      <div class="ops-lfg-controls">
        <strong id="opsLfgCount">0 online</strong>
        <button id="hideLfgBtn" class="ops-lfg-hide-btn" title="Hide Queue">×</button>
      </div>
    </div>
    <div id="opsLfgList" class="ops-lfg-list">No one is looking for 1v1 right now.</div>
    <button id="showLfgBtn" class="ops-lfg-restore-btn">Show 1v1 Queue</button>
  `;

    document.body.appendChild(dock);

    const hideBtn = dock.querySelector("#hideLfgBtn");
    const showBtn = dock.querySelector("#showLfgBtn");

    hideBtn.onclick = () => {
      dock.classList.add("hidden");
      localStorage.setItem("opsLfgDockHidden", "true");
    };

    showBtn.onclick = () => {
      dock.classList.remove("hidden");
      localStorage.setItem("opsLfgDockHidden", "false");
    };

    return {
      root: dock,
      lfgCount: dock.querySelector("#opsLfgCount"),
      lfgList: dock.querySelector("#opsLfgList"),
      lfgMeta: dock.querySelector("#opsLfgMeta")
    };
  }

  function setOpsHudDataSource(sourceLabel) {
    const nodes = ensureOpsHud();
    if (!nodes?.dataSource) {
      return;
    }

    const label = String(sourceLabel || "").trim() || "Unknown";
    nodes.dataSource.textContent = label;
  }

  function updateOpsHudClock() {
    const nodes = ensureOpsHud();
    if (!nodes?.clock) {
      return;
    }

    nodes.clock.textContent = new Date().toLocaleTimeString("en-GB", {
      hour12: false,
      timeZone: "UTC"
    });
  }

  function startOpsHudMotdRotation() {
    const nodes = ensureOpsHud();
    if (!nodes?.motd) {
      return;
    }

    if (opsHudMotdIntervalId) {
      clearInterval(opsHudMotdIntervalId);
    }

    opsHudMotdIntervalId = window.setInterval(() => {
      opsHudMotdIndex = (opsHudMotdIndex + 1) % OPS_MOTD_MESSAGES.length;
      nodes.motd.textContent = OPS_MOTD_MESSAGES[opsHudMotdIndex];
    }, OPS_MOTD_INTERVAL_MS);
  }

  async function runOpsSyncCheck(force = false) {
    const nodes = ensureOpsHud();
    if (!nodes?.apiState || !nodes.syncState) {
      return;
    }

    if (force) {
      nodes.apiState.textContent = "Checking...";
      nodes.syncState.textContent = "Refreshing sync...";
    }

    try {
      const startedAt = Date.now();
      const response = await fetch(WEB_SYNC_ENDPOINT, { cache: "no-store" });
      const latency = Date.now() - startedAt;

      if (!response.ok) {
        nodes.apiState.textContent = `Offline (HTTP ${response.status})`;
        nodes.apiState.classList.remove("is-online");
        nodes.apiState.classList.add("is-offline");
        nodes.syncState.textContent = "Sync unavailable";
        return;
      }

      const payload = await response.json();
      const updatedAt = payload?.config?.updatedAt || "";
      nodes.apiState.textContent = `Online (${latency}ms)`;
      nodes.apiState.classList.add("is-online");
      nodes.apiState.classList.remove("is-offline");
      nodes.syncState.textContent = formatRelativeSyncTime(updatedAt);
    } catch {
      nodes.apiState.textContent = "Offline (Network)";
      nodes.apiState.classList.remove("is-online");
      nodes.apiState.classList.add("is-offline");
      nodes.syncState.textContent = "Sync unavailable";
    }
  }

  function formatLfgTimeRemaining(expiresAt) {
    const remainingMs = Math.max(0, Number(expiresAt || 0) - Date.now());
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) {
      return `${seconds}s`;
    }

    return `${minutes}m ${seconds}s`;
  }

  function formatLfgUpdatedAt() {
    return `Updated ${new Date().toLocaleTimeString("en-GB", {
      hour12: false,
      timeZone: "UTC"
    })} UTC`;
  }

  function renderLfgQueue(entries) {
    const nodes = ensureLfgDock();
    if (!nodes?.lfgCount || !nodes?.lfgList) {
      return;
    }

    nodes.root?.classList.remove("is-offline");
    nodes.root?.classList.add("is-live");
    if (nodes.lfgMeta) {
      nodes.lfgMeta.textContent = formatLfgUpdatedAt();
    }

    const active = Array.isArray(entries)
      ? entries.filter((entry) => Number(entry?.expiresAt || 0) > Date.now())
      : [];

    active.sort((a, b) => Number(b?.expiresAt || 0) - Number(a?.expiresAt || 0));

    nodes.lfgCount.textContent = `${active.length} online`;

    if (!active.length) {
      nodes.lfgList.innerHTML = "<p class=\"ops-lfg-empty\">No one is looking for 1v1 right now.</p>";
      return;
    }

    nodes.lfgList.innerHTML = active.slice(0, 7).map((entry) => {
      const username = escapeHtml(entry?.username || "Unknown");
      const timeLeft = formatLfgTimeRemaining(entry?.expiresAt);
      return `
      <div class="ops-lfg-row">
        <div class="ops-lfg-user">
          <strong>${username}</strong>
          <small>Ready now</small>
        </div>
        <span class="ops-lfg-status">looking for 1v1</span>
        <small class="ops-lfg-timer">${timeLeft} left</small>
      </div>
    `;
    }).join("");
  }

  async function runLfgQueueSync() {
    const nodes = ensureLfgDock();
    if (!nodes?.lfgList) {
      return;
    }

    try {
      const response = await fetch(LFG_FEED_ENDPOINT, { cache: "no-store" });
      if (!response.ok) {
        if (nodes.lfgMeta) {
          nodes.lfgMeta.textContent = `Offline (HTTP ${response.status})`;
        }
        nodes.root?.classList.add("is-offline");
        nodes.root?.classList.remove("is-live");
        nodes.lfgList.innerHTML = `<p class=\"ops-lfg-empty\">Queue offline (HTTP ${response.status}).</p>`;
        if (nodes.lfgCount) {
          nodes.lfgCount.textContent = "offline";
        }
        return;
      }

      const payload = await response.json().catch(() => ({}));
      renderLfgQueue(Array.isArray(payload?.entries) ? payload.entries : []);
    } catch {
      if (nodes.lfgMeta) {
        nodes.lfgMeta.textContent = "Offline (network)";
      }
      nodes.root?.classList.add("is-offline");
      nodes.root?.classList.remove("is-live");
      nodes.lfgList.innerHTML = "<p class=\"ops-lfg-empty\">Queue offline (network).</p>";
      if (nodes.lfgCount) {
        nodes.lfgCount.textContent = "offline";
      }
    }
  }

  function startLfgQueueSystem() {
    const nodes = ensureLfgDock();
    if (!nodes) {
      return;
    }

    runLfgQueueSync();

    if (lfgSyncIntervalId) {
      clearInterval(lfgSyncIntervalId);
    }

    lfgSyncIntervalId = window.setInterval(() => runLfgQueueSync(), LFG_SYNC_INTERVAL_MS);
  }

  function startOpsHud() {
    const nodes = ensureOpsHud();
    if (!nodes) {
      return;
    }

    updateOpsHudClock();
    runOpsSyncCheck();
    runLfgQueueSync();
    startOpsHudMotdRotation();

    if (opsHudClockIntervalId) {
      clearInterval(opsHudClockIntervalId);
    }

    opsHudClockIntervalId = window.setInterval(updateOpsHudClock, 1000);

    if (opsHudSyncIntervalId) {
      clearInterval(opsHudSyncIntervalId);
    }

    opsHudSyncIntervalId = window.setInterval(() => runOpsSyncCheck(), OPS_SYNC_INTERVAL_MS);

    if (lfgSyncIntervalId) {
      clearInterval(lfgSyncIntervalId);
    }

    lfgSyncIntervalId = window.setInterval(() => runLfgQueueSync(), LFG_SYNC_INTERVAL_MS);
  }

  function ensureFactionPulseMount() {
    // Faction Pulse Radar is disabled by request.
    return null;

    if (!isAdminPanelPage()) {
      return null;
    }

    const existing = document.getElementById("factionPulse");
    if (existing) {
      return existing;
    }

    const host = document.querySelector(".admin-content");
    if (!host) {
      return null;
    }

    const section = document.createElement("section");
    section.id = "factionPulse";
    section.className = "faction-pulse";
    section.setAttribute("aria-label", "Faction pulse radar");
    section.innerHTML = `
    <div class="faction-pulse-head">
      <h3>Faction Pulse Radar</h3>
      <p>Live composition based on current roster.</p>
    </div>
    <div id="factionPulseGrid" class="faction-pulse-grid"></div>
  `;

    const targetAnchor = host.querySelector("#adminPanel, #adminAuthCard");
    if (targetAnchor) {
      targetAnchor.insertAdjacentElement("afterend", section);
    } else {
      host.insertAdjacentElement("afterbegin", section);
    }

    return section;
  }

  function renderFactionPulse(players) {
    const mount = ensureFactionPulseMount();
    if (!mount) {
      return;
    }

    const grid = mount.querySelector("#factionPulseGrid");
    if (!grid) {
      return;
    }

    const pulse = computeFactionPulse(players).slice(0, 6);
    if (!pulse.length) {
      grid.innerHTML = "<p class=\"faction-pulse-empty\">No active faction pulse data.</p>";
      return;
    }

    const maxMembers = Math.max(1, ...pulse.map((item) => item.members));

    grid.innerHTML = pulse.map((entry) => {
      const intensity = Math.round((entry.members / maxMembers) * 100);
      const flagPath = getFactionFlagPath(entry.token);
      const safeToken = escapeHtml(entry.token);
      const flagMarkup = flagPath
        ? `<img class=\"faction-flag-icon\" src=\"${flagPath}\" alt=\"${safeToken} flag\" loading=\"lazy\">`
        : "";

      return `
      <article class="faction-pulse-card" style="--intensity:${intensity}%">
        <strong>${flagMarkup}${safeToken}</strong>
        <span>${entry.members} operators</span>
        <p>Avg ELO ${entry.avgElo.toFixed(0)}</p>
      </article>
    `;
    }).join("");
  }

  function ensureFactionNewsMount() {
    const existing = document.getElementById("factionNewsFeed");
    if (existing) {
      return existing;
    }

    const adminMain = document.querySelector(".admin-content");
    const showcaseMain = document.querySelector(".content");
    const leaderboardMain = document.querySelector(".leaderboard-content");
    const host = adminMain || showcaseMain || leaderboardMain;
    if (!host) {
      return null;
    }

    const section = document.createElement("section");
    section.id = "factionNewsFeed";
    section.className = "faction-news";
    section.setAttribute("aria-label", "Faction news feed");
    section.innerHTML = `
    <div class="faction-news-head">
      <h3>Faction News Feed</h3>
      <p id="factionNewsUpdated">Live updates</p>
    </div>
    <article class="faction-news-highlight">
      <strong id="factionNewsHeadline">Gathering latest faction briefings...</strong>
    </article>
    <div id="factionNewsList" class="faction-news-list"></div>
  `;

    const targetAnchor = host.querySelector("#adminPanel, #adminAuthCard, #factionPulse, .leaderboard-highlight, .leaderboard-warroom-link, .players-section, .leaderboard-top-three");
    if (targetAnchor) {
      if (targetAnchor.id === "adminPanel" || targetAnchor.id === "adminAuthCard") {
        targetAnchor.insertAdjacentElement("afterend", section);
      } else {
        targetAnchor.insertAdjacentElement("beforebegin", section);
      }
    } else {
      host.insertAdjacentElement("afterbegin", section);
    }

    return section;
  }

  async function renderFactionNewsFeed(players) {
    const mount = ensureFactionNewsMount();
    if (!mount) {
      return;
    }

    const headlineNode = mount.querySelector("#factionNewsHeadline");
    const listNode = mount.querySelector("#factionNewsList");
    const updatedNode = mount.querySelector("#factionNewsUpdated");
    if (!headlineNode || !listNode || !updatedNode) {
      return;
    }

    const remoteNews = await fetchEntrenchedTimesNews();
    const remoteArticles = Array.isArray(remoteNews.articles) ? remoteNews.articles : [];

    if (remoteArticles.length) {
      const headlineItems = remoteArticles.map((article) => article.title).filter(Boolean);
      const topBriefings = remoteArticles.slice(0, 6);

      headlineNode.textContent = headlineItems[0] || "Entrenched Times feed active.";
      listNode.innerHTML = topBriefings.map((item) => {
        const linkMarkup = item.link
          ? `<a class="faction-news-link" href="${item.link}" target="_blank" rel="noreferrer noopener">Open source</a>`
          : "";

        return `
        <article class="faction-news-item">
          <span>${escapeHtml(item.tag || "Community")}</span>
          <h4>${escapeHtml(item.title || "Untitled Update")}</h4>
          <p>${escapeHtml(item.summary || "No summary available.")}</p>
          ${linkMarkup}
        </article>
      `;
      }).join("");

      updatedNode.textContent = `Entrenched Times • ${remoteNews.source} • ${new Date().toLocaleTimeString("en-GB", { hour12: false })} UTC`;

      if (factionNewsRotateIntervalId) {
        clearInterval(factionNewsRotateIntervalId);
      }

      let index = 0;
      factionNewsRotateIntervalId = window.setInterval(() => {
        index = (index + 1) % headlineItems.length;
        headlineNode.textContent = headlineItems[index];
      }, FACTION_NEWS_ROTATE_MS);

      return;
    }

    const list = Array.isArray(players) ? players.slice() : [];
    if (!list.length) {
      headlineNode.textContent = "No faction news available right now.";
      listNode.innerHTML = "<p class=\"faction-news-empty\">No operators found in current data feed.</p>";
      updatedNode.textContent = "Waiting for data";
      return;
    }

    const pulse = computeFactionPulse(list);
    const topFaction = pulse[0] || null;
    const secondFaction = pulse[1] || null;
    const sortedByElo = list
      .slice()
      .sort((a, b) => {
        if (Number(b.elo) !== Number(a.elo)) {
          return Number(b.elo) - Number(a.elo);
        }

        return (Number(b.wins) - Number(b.losses)) - (Number(a.wins) - Number(a.losses));
      });

    const topOperator = sortedByElo[0] || null;
    const secondOperator = sortedByElo[1] || null;
    const headlineItems = [
      topFaction ? `${topFaction.token} controls the pressure line with ${topFaction.members} active operators.` : "Faction pressure line is contested.",
      secondFaction ? `${secondFaction.token} is reinforcing sectors with Avg ELO ${secondFaction.avgElo.toFixed(0)}.` : "Secondary faction reinforcements are being reorganized.",
      topOperator ? `${topOperator.name} is the current standout at ELO ${Number(topOperator.elo).toFixed(0)}.` : "Operator performance data is updating.",
      secondOperator ? `${secondOperator.name} supports the frontline with ${Number(secondOperator.wins || 0)} wins.` : "Support operators are rotating through active fronts.",
      `Roster intelligence currently tracks ${list.length} operators across active factions.`
    ];

    const briefings = [
      {
        tag: "Frontline",
        text: topFaction
          ? `${topFaction.token} has ${topFaction.members} operators active with Avg ELO ${topFaction.avgElo.toFixed(0)}.`
          : "No dominant faction detected in current cycle."
      },
      {
        tag: "Intel",
        text: topOperator
          ? `${topOperator.name} leads with ELO ${Number(topOperator.elo).toFixed(0)} and Rank Plus status.`
          : "Top-operator snapshot is unavailable."
      },
      {
        tag: "Logistics",
        text: secondFaction
          ? `${secondFaction.token} staging momentum with ${secondFaction.members} members in rotation.`
          : "Logistics update: reserve factions not fully mapped."
      },
      {
        tag: "Broadcast",
        text: `Ascend Entrenched feed synchronized at ${new Date().toLocaleTimeString("en-GB", { hour12: false })} UTC.`
      }
    ];

    headlineNode.textContent = headlineItems[0];
    listNode.innerHTML = briefings.map((item) => `
    <article class="faction-news-item">
      <span>${escapeHtml(item.tag)}</span>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `).join("");

    updatedNode.textContent = `Updated ${new Date().toLocaleTimeString("en-GB", { hour12: false })} UTC`;

    if (factionNewsRotateIntervalId) {
      clearInterval(factionNewsRotateIntervalId);
    }

    let index = 0;
    factionNewsRotateIntervalId = window.setInterval(() => {
      index = (index + 1) % headlineItems.length;
      headlineNode.textContent = headlineItems[index];
    }, FACTION_NEWS_ROTATE_MS);
  }

  function ensureShowcaseControls(players, avatarMap) {
    if (!playersGrid || !Array.isArray(players) || !players.length) {
      return;
    }

    const section = playersGrid.closest(".players-section");
    if (!section) {
      return;
    }

    let controls = document.getElementById("showcaseControls");
    if (!controls) {
      controls = document.createElement("div");
      controls.id = "showcaseControls";
      controls.className = "showcase-controls";
      controls.innerHTML = `
      <label class="showcase-control search">
        <span>Search Players</span>
        <input id="showcaseSearch" type="search" placeholder="Name, faction, country" autocomplete="off">
      </label>
      <label class="showcase-control sort">
        <span>Sort</span>
        <select id="showcaseSort">
          <option value="rank">Leaderboard Rank</option>
          <option value="elo">Highest ELO</option>
          <option value="wins">Most Wins</option>
          <option value="name">Name A-Z</option>
        </select>
      </label>
    `;
      section.insertAdjacentElement("afterbegin", controls);
    }

    const searchNode = controls.querySelector("#showcaseSearch");
    const sortNode = controls.querySelector("#showcaseSort");
    if (!searchNode || !sortNode) {
      return;
    }

    if (!controls.__showcaseState) {
      controls.__showcaseState = {
        players: [],
        avatarMap: new Map(),
        applyView: null
      };

      const applyView = () => {
        const currentPlayers = Array.isArray(controls.__showcaseState.players)
        try {
          const currentPlayers = Array.isArray(controls.__showcaseState.players)
            ? controls.__showcaseState.players
            : [];
          const currentAvatarMap = controls.__showcaseState.avatarMap instanceof Map
            ? controls.__showcaseState.avatarMap
            : new Map();
          const withIndex = currentPlayers.map((player, index) => ({ ...player, baseRank: index + 1 }));
          const term = normalizeText(searchNode.value).toLowerCase();
          const sortMode = String(sortNode.value || "rank");

          const filtered = withIndex.filter((p) => {
            if (!term) return true;
            return `${p.name} ${p.faction} ${p.country}`.toLowerCase().includes(term);
          });

          filtered.sort((a, b) => {
            if (sortMode === "elo") {
              return Number(b.elo) - Number(a.elo);
            }
            if (sortMode === "wins") {
              return Number(b.wins) - Number(a.wins);
            }
            if (sortMode === "name") {
              return String(a.name).localeCompare(String(b.name));
            }
            return Number(a.baseRank) - Number(b.baseRank);
          });

          renderPlayers(filtered, currentAvatarMap);
        } catch (e) {
          console.error("Showcase view update failed:", e);
        }
      };

      controls.__showcaseState.applyView = applyView;
      searchNode.addEventListener("input", applyView);
      sortNode.addEventListener("change", applyView);
    }

    controls.__showcaseState.players = Array.isArray(players) ? players : [];
    controls.__showcaseState.avatarMap = avatarMap instanceof Map ? avatarMap : new Map();
    controls.__showcaseState.applyView();
  }

  function getPlayerStats(name, isTopPlayer) {
    if (isTopPlayer) {
      return {
        elo: TOP_PLAYER_OVERRIDES.elo,
        wins: TOP_PLAYER_OVERRIDES.wins,
        losses: TOP_PLAYER_OVERRIDES.losses
      };
    }

    const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const elo = 1000 + (seed % 500);
    const wins = (seed % 50);
    const losses = (seed % 30);

    return { elo, wins, losses };
  }

  function clampSyncedElo(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 1000;
    }
    return Math.max(1000, Math.min(4000, Math.round(numeric)));
  }

  function normalizeSyncedDevice(value) {
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

  function normalizeSyncedClass(value) {
    return normalizePlayerClassValue(value);
  }

  function normalizeSyncedClassList(value) {
    return normalizePlayerClassList(value);
  }

  function getDeviceIconSvg(device, iconClass = "player-device-icon") {
    const normalized = normalizeSyncedDevice(device);
    if (normalized === "PC") {
      return `<svg class="${iconClass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="12" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.8"></rect><path d="M8 20h8M10 16h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
    }

    if (normalized === "Mobile") {
      return `<svg class="${iconClass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="7" y="2" width="10" height="20" rx="2.2" ry="2.2" fill="none" stroke="currentColor" stroke-width="1.8"></rect><circle cx="12" cy="18" r="1" fill="currentColor"></circle></svg>`;
    }

    if (normalized === "Controller") {
      return `<svg class="${iconClass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 10h11l2.1 4.1a2.8 2.8 0 0 1-3.7 3.8L13.8 16h-3.6L8.1 17.9a2.8 2.8 0 0 1-3.7-3.8L6.5 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M9 13h2M10 12v2M15.2 13.1h.01M16.8 14.5h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
    }

    return `<svg class="${iconClass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"></circle><path d="M9.2 9.2h5.6v5.6H9.2z" fill="none" stroke="currentColor" stroke-width="1.6"></path></svg>`;
  }

  function normalizeSyncedDiscordId(value) {
    const normalized = String(value || "").trim().replace(/[<@!>]/g, "");
    if (/^\d{8,}$/.test(normalized)) {
      return normalized;
    }

    return "";
  }

  function normalizeSyncedUserId(value) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return "";
    }

    if (/^\d{3,14}$/.test(normalized)) {
      return normalized;
    }

    const pathMatch = normalized.match(/\/users\/(\d{3,14})(?:\/|$|\?)/i);
    if (pathMatch?.[1]) {
      return pathMatch[1];
    }

    const queryMatch = normalized.match(/[?&]userId=(\d{3,14})(?:&|$)/i);
    if (queryMatch?.[1]) {
      return queryMatch[1];
    }

    try {
      const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
      const parsed = new URL(withProtocol);
      const parsedPathMatch = parsed.pathname.match(/\/users\/(\d{3,14})(?:\/|$)/i);
      if (parsedPathMatch?.[1]) {
        return parsedPathMatch[1];
      }

      const parsedQueryId = parsed.searchParams.get("userId");
      if (parsedQueryId && /^\d{3,14}$/.test(parsedQueryId)) {
        return parsedQueryId;
      }
    } catch {
      return "";
    }

    return "";
  }

  async function resolveRobloxUserIdsByUsernames(usernames) {
    const requestUsernames = [...new Set(
      (Array.isArray(usernames) ? usernames : [])
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )];

    if (!requestUsernames.length) {
      return new Map();
    }

    try {
      const response = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usernames: requestUsernames,
          excludeBannedUsers: false
        })
      });

      if (!response.ok) {
        return new Map();
      }

      const payload = await response.json().catch(() => ({}));
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const resolved = new Map();

      rows.forEach((row) => {
        const name = normalizeText(row?.requestedUsername || row?.name).toLowerCase();
        const userId = Number(row?.id);
        if (!name || !Number.isFinite(userId) || userId <= 0) {
          return;
        }

        resolved.set(name, userId);
        avatarIdMap.set(name, userId);
      });

      return resolved;
    } catch {
      return new Map();
    }
  }

  async function fetchWebSyncConfig() {
    try {
      const response = await fetch(WEB_SYNC_ENDPOINT, { cache: "no-store" });
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

  function normalizeSyncedPlayers(config) {
    const raw = config?.players;
    if (!raw || typeof raw !== "object") {
      return {};
    }

    const output = {};
    Object.entries(raw).forEach(([nameKey, stats]) => {
      const key = String(nameKey || "").trim().toLowerCase();
      if (!key) {
        return;
      }

      const faction = sanitizeFactionValue(stats?.faction);
      const classList = normalizeSyncedClassList(stats?.classes ?? stats?.class);
      output[key] = {
        faction: faction === "N/A" ? "" : faction,
        class: classList[0] || "Unknown",
        classes: classList,
        elo: clampSyncedElo(stats?.elo),
        wins: Number(stats?.wins) || 0,
        losses: Number(stats?.losses) || 0,
        device: normalizeSyncedDevice(stats?.device)
      };
    });

    return output;
  }

  function normalizeSyncedExtraPlayers(config) {
    const raw = config?.extraPlayers;
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .slice(0, 120)
      .map((entry, index) => {
        const item = entry && typeof entry === "object" ? entry : {};
        const name = normalizeText(item.name || item.playerName);
        if (!name) {
          return null;
        }

        const lower = name.toLowerCase();
        const mappedUserId = avatarIdMap.get(lower) || fallbackAvatarId;
        const resolvedUserId = Number(normalizeSyncedUserId(item.userId) || mappedUserId);

        return {
          id: String(item.id || `extra-player-${index}`).trim(),
          name,
          faction: sanitizeFactionValue(item.faction || "N/A"),
          class: normalizeSyncedClass(item.class),
          classes: normalizeSyncedClassList(item.classes ?? item.class),
          country: normalizeText(item.country) || "N/A",
          discordId: normalizeSyncedDiscordId(item.discordId),
          userId: Number.isFinite(resolvedUserId) ? resolvedUserId : fallbackAvatarId,
          device: normalizeSyncedDevice(item.device)
        };
      })
      .filter(Boolean);
  }

  function getBodyAvatarApiUrl(userId) {
    const params = new URLSearchParams({
      userIds: String(userId || fallbackAvatarId),
      size: FULL_BODY_SIZE,
      format: AVATAR_FORMAT,
      isCircular: "false"
    });

    return `https://thumbnails.roblox.com/v1/users/avatar?${params.toString()}`;
  }

  async function fetchTopBodyAvatar(userId) {
    try {
      const response = await fetch(getBodyAvatarApiUrl(userId), { cache: "no-store" });
      if (!response.ok) {
        return "";
      }

      const payload = await response.json();
      const row = Array.isArray(payload?.data) ? payload.data[0] : null;
      if (row?.state === "Completed" && row?.imageUrl) {
        return row.imageUrl;
      }
    } catch {
      // Ignore and use fallback URLs.
    }

    return "";
  }

  async function fetchAvatarUrls(players) {
    const avatarMap = new Map();
    const safePlayers = Array.isArray(players) ? players : [];
    const ids = [];
    const unresolvedNames = [];
    const playersByName = new Map();

    safePlayers.forEach((player) => {
      const nameKey = normalizeText(player?.name).toLowerCase();
      if (nameKey) {
        if (!playersByName.has(nameKey)) {
          playersByName.set(nameKey, []);
        }

        playersByName.get(nameKey).push(player);
      }

      const normalizedUserId = normalizeSyncedUserId(player?.userId);
      if (normalizedUserId) {
        const userId = Number(normalizedUserId);
        if (Number.isFinite(userId) && userId > 0) {
          ids.push(userId);
        }
        return;
      }

      const mappedUserId = Number(nameKey ? avatarIdMap.get(nameKey) : 0);
      if (Number.isFinite(mappedUserId) && mappedUserId > 0) {
        player.userId = mappedUserId;
        ids.push(mappedUserId);
        return;
      }

      if (nameKey) {
        unresolvedNames.push(nameKey);
      }
    });

    if (unresolvedNames.length) {
      const CHUNK_SIZE = 50;
      const chunks = [];
      for (let index = 0; index < unresolvedNames.length; index += CHUNK_SIZE) {
        chunks.push(unresolvedNames.slice(index, index + CHUNK_SIZE));
      }

      const resolvedMaps = await Promise.all(chunks.map((chunkNames) => resolveRobloxUserIdsByUsernames(chunkNames)));
      resolvedMaps.forEach((resolvedMap) => {
        resolvedMap.forEach((resolvedUserId, nameKey) => {
          if (Number.isFinite(Number(resolvedUserId)) && Number(resolvedUserId) > 0) {
            ids.push(Number(resolvedUserId));
            const linkedPlayers = playersByName.get(nameKey) || [];
            linkedPlayers.forEach((player) => {
              player.userId = Number(resolvedUserId);
            });
          }
        });
      });
    }

    const uniqueIds = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
    if (!uniqueIds.length) {
      return avatarMap;
    }

    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(chunks.map(async (chunk) => {
      try {
        const response = await fetch(getThumbnailApiUrl(chunk), { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];

        rows.forEach((row) => {
          if (row?.state === "Completed" && row?.imageUrl && Number.isFinite(Number(row.targetId))) {
            avatarMap.set(Number(row.targetId), row.imageUrl);
          }
        });
      } catch {
        // Gracefully continue with legacy image fallback.
      }
    }));

    return avatarMap;
  }

  function getWaveStep(indexInGroup, groupSize) {
    const lastIndex = Math.max(0, groupSize - 1);
    const mirrored = Math.min(indexInGroup, lastIndex - indexInGroup);
    return Math.max(0, mirrored);
  }

  function buildPlayerCard(player, index, avatarMap) {
    const card = document.createElement("article");
    const kawaii = isKawaiiPlayer(player.name);
    card.className = kawaii ? "player-card is-kawaii" : "player-card";
    if (kawaii) {
      card.style.opacity = "1";
      card.style.visibility = "visible";
      card.style.transform = "none";
    }
    card.style.setProperty("--faction-flag-bg-image", getPrimaryFactionBackgroundImage(player.faction));
    card.tabIndex = 0;
    const groupIndex = Math.floor(index / GROUP_SIZE);
    const indexInGroup = index % GROUP_SIZE;
    const waveStep = getWaveStep(indexInGroup, GROUP_SIZE);
    card.style.setProperty("--group-delay", `${groupIndex * GROUP_DELAY_MS}ms`);
    card.style.setProperty("--item-delay", `${waveStep * WAVE_DELAY_MS}ms`);
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open Player ${player.name}`);

    const staticAvatar = getStaticAvatarUrl(player.userId);
    const robloxHeadshotAvatar = getRobloxHeadshotUrl(player.userId, 720);
    const fallbackAvatar = getFallbackAvatarUrl(player.name);
    const primaryAvatar =
      avatarMap.get(Number(player.userId)) ||
      staticAvatar ||
      robloxHeadshotAvatar ||
      fallbackAvatar;
    player.avatarUrl = primaryAvatar;
    const classList = normalizePlayerClassList(player.playerClasses ?? player.playerClass);
    const classChipsMarkup = (classList.length ? classList : ["Unknown"])
      .map((classLabel) => {
        const classIconPath = getClassIconPath(classLabel);
        const classIconMarkup = classIconPath
          ? `<img class="player-class-icon" src="${classIconPath}" alt="${escapeHtml(classLabel)} class icon" loading="lazy">`
          : "";

        return `<span class="player-meta-chip">${classIconMarkup}${escapeHtml(classLabel)}</span>`;
      })
      .join("");
    const deviceLabel = normalizeSyncedDevice(player.device);
    const factionChipMarkup = buildFactionChipHtml(player.faction, {
      chipClass: "player-faction-chip",
      maxItems: 1
    });

    card.innerHTML = `
      <img class="player-image" src="${primaryAvatar}" alt="${escapeHtml(player.name)} Roblox avatar" loading="lazy" referrerpolicy="no-referrer">
      <div class="player-overlay">
        <span class="player-label">Player</span>
        ${factionChipMarkup}
        <div class="player-meta-row">
          ${classChipsMarkup}
          <span class="player-meta-chip">${getDeviceIconSvg(deviceLabel)}${escapeHtml(deviceLabel)}</span>
        </div>
        <h3 class="player-name">${escapeHtml(player.name)}</h3>
      </div>
    `;

    if (kawaii && typeof buildKawaiiDecorHtml === "function") {
      try {
        card.insertAdjacentHTML("afterbegin", buildKawaiiDecorHtml());
      } catch (err) {
        console.warn("Kawaii decor failed for " + player.name, err);
      }
    }

    const imageNode = card.querySelector(".player-image");
    applyImageFallbackChain(imageNode, [
      primaryAvatar,
      staticAvatar,
      robloxHeadshotAvatar,
      fallbackAvatar
    ]);

    card.addEventListener("click", () => openModal(player));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(player);
      }
    });

    return card;
  }

  function openModal(player) {
    if (!modal || !modalAvatar || !modalName || !modalFaction || !modalCountry || !modalElo || !modalWL || !modalDiscord) {
      return;
    }

    if (modalPanelNode) {
      modalPanelNode.style.setProperty("--faction-flag-bg-image", getPrimaryFactionBackgroundImage(player.faction));
      modalPanelNode.classList.toggle("is-kawaii", isKawaiiPlayer(player.name));
    }

    const fallbackAvatar = getFallbackAvatarUrl(player.name);
    applyImageFallbackChain(modalAvatar, [
      player.bodyAvatarUrl,
      player.avatarUrl,
      getStaticAvatarUrl(player.userId),
      getRobloxHeadshotUrl(player.userId, 720),
      fallbackAvatar
    ]);
    modalAvatar.alt = `${player.name} Roblox avatar`;
    modalName.textContent = player.name;
    modalFaction.innerHTML = buildFactionChipHtml(player.faction, {
      chipClass: "modal-faction-chip",
      maxItems: 4,
      includeGroupWrapper: true,
      groupClass: "modal-faction-group"
    });
    modalCountry.textContent = `${countryToFlag(player.country)} ${player.country}`;
    modalElo.textContent = String(player.elo || 1000);
    modalWL.textContent = `${player.wins || 0} / ${player.losses || 0}`;
    if (modalChange) {
      const change = player.lastEloChange ?? player.eloChange ?? 0;
      modalChange.textContent = (change >= 0 ? "+" : "") + change;
    }
    if (/^\d{8,}$/.test(String(player.discordId || ""))) {
      modalDiscord.href = `https://discord.com/users/${player.discordId}`;
      modalDiscord.textContent = "Open Player Discord";
      modalDiscord.removeAttribute("aria-disabled");
    } else {
      modalDiscord.href = "#";
      modalDiscord.textContent = "Discord not linked";
      modalDiscord.setAttribute("aria-disabled", "true");
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function renderTopPlayerCard(player) {
    if (!topPlayerCard || !topPlayerNameNode || !topPlayerSubtitleNode || !topPlayerEloNode || !topPlayerWlNode || !topCountryBadgeNode || !topPlayerAvatarNode || !topFactionBadgeNode) {
      return;
    }

    topPlayerCard.style.setProperty("--faction-flag-bg-image", getPrimaryFactionBackgroundImage(player.faction));

    topPlayerNameNode.textContent = player.name;
    topPlayerSubtitleNode.textContent = TOP_PLAYER_OVERRIDES.subtitle;
    topPlayerEloNode.textContent = String(player.elo || 1000);
    topPlayerWlNode.textContent = `${player.wins || 0} / ${player.losses || 0}`;
    topCountryBadgeNode.textContent = `${countryToFlag(player.country)} ${player.country}`;
    const factionPrimaryToken = splitFactionTokens(player.faction)[0];
    const safeFactionToken = escapeHtml(factionPrimaryToken || "N/A");
    const badgeFlagPath = getFactionFlagPath(factionPrimaryToken);
    const badgeFlagMarkup = badgeFlagPath
      ? `<img class="faction-flag-icon" src="${badgeFlagPath}" alt="${safeFactionToken} flag" loading="lazy">`
      : "";
    topFactionBadgeNode.innerHTML = `${badgeFlagMarkup}${escapeHtml(safeFactionToken)}`;

    const heroAvatar = player.bodyAvatarUrl
      || player.avatarUrl
      || getStaticAvatarUrl(player.userId)
      || getRobloxHeadshotUrl(player.userId, 720)
      || getFallbackAvatarUrl(player.name);
    applyImageFallbackChain(topPlayerAvatarNode, [
      heroAvatar,
      getStaticAvatarUrl(player.userId),
      getRobloxHeadshotUrl(player.userId, 720),
      getFallbackAvatarUrl(player.name)
    ]);
    topPlayerAvatarNode.alt = `${player.name} Roblox avatar`;

    topPlayerCard.onclick = () => openModal(player);
    topPlayerCard.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(player);
      }
    };
  }

  function closeModal() {
    if (!modal) {
      return;
    }

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function isTypingTarget(target) {
    if (!target || typeof target !== "object") {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    const tag = String(target.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  async function loadPlayerLines() {
    // Ensure we wait for global data (mappings, fallbacks) to load first
    if (globalDataPromise) {
      await globalDataPromise;
    }

    try {
      const response = await fetch("discordlink", { cache: "no-store" });
      if (response.ok) {
        const text = await response.text();
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length > 0) {
          setOpsHudDataSource("discordlink live feed");
          return lines;
        }
      }
    } catch {
      // Fallback is used when local file serving blocks access.
    }

    setOpsHudDataSource("embedded fallback list");
    return fallbackPlayerLines;
  }

  function renderPlayers(players, avatarMap) {
    if (!playersGrid) {
      return;
    }

    playersGrid.innerHTML = "";

    if (!players.length) {
      const empty = document.createElement("p");
      empty.className = "player-name";
      empty.textContent = "No Player data found.";
      playersGrid.append(empty);
      return;
    }

    players.forEach((player, index) => {
      playersGrid.append(buildPlayerCard(player, index, avatarMap));
    });
  }

  async function init() {
    if (!playersGrid) {
      return;
    }

    // Ensure global data is ready
    if (globalDataPromise) {
      await globalDataPromise;
    }

    const [lines, syncedConfig] = await Promise.all([
      loadPlayerLines(),
      fetchWebSyncConfig()
    ]);
    const syncedPlayers = normalizeSyncedPlayers(syncedConfig);
    const syncedExtraPlayers = normalizeSyncedExtraPlayers(syncedConfig);

    const players = lines
      .map(parsePlayerLine)
      .filter(Boolean);

    const existingKeys = new Set(players.map((player) => String(player.name || "").trim().toLowerCase()));
    syncedExtraPlayers.forEach((entry) => {
      const key = String(entry.name || "").trim().toLowerCase();
      if (!key || existingKeys.has(key)) {
        return;
      }

      existingKeys.add(key);
      players.push({
        name: entry.name,
        faction: entry.faction,
        playerClasses: normalizeSyncedClassList(entry.classes ?? entry.class),
        playerClass: normalizeSyncedClass(entry.class),
        country: entry.country,
        discordId: entry.discordId,
        userId: entry.userId,
        avatarUrl: "",
        bodyAvatarUrl: "",
        elo: 1000,
        wins: 0,
        losses: 0,
        device: entry.device
      });
    });

    players.forEach((player) => {
      const key = String(player.name || "").toLowerCase();
      const override = syncedPlayers[key];
      const isTop = player.name.toLowerCase() === TOP_PLAYER_NAME.toLowerCase();
      const stats = getPlayerStats(player.name, isTop);
      player.elo = override?.elo ?? stats.elo;
      player.wins = override?.wins ?? stats.wins;
      player.losses = override?.losses ?? stats.losses;
      const classList = normalizeSyncedClassList(override?.classes ?? override?.class ?? player.playerClasses ?? player.playerClass);
      player.playerClasses = classList;
      player.playerClass = classList[0] || normalizeSyncedClass(player.playerClass);
      player.device = normalizeSyncedDevice(override?.device ?? player.device);
      if (override?.faction) {
        player.faction = override.faction;
      }
    });

    const topPlayer = players.find((player) => player.name.toLowerCase() === TOP_PLAYER_NAME.toLowerCase()) || players[0];
    const initialAvatarMap = new Map();

    if (topPlayer) {
      renderTopPlayerCard(topPlayer);
    }

    renderPlayers(players, initialAvatarMap);
    ensureShowcaseControls(players, initialAvatarMap);
    try {
      renderFactionNewsFeed(players);
    } catch (err) {
      console.warn("News feed failure (safely bypassed):", err);
    }

    try {
      renderFactionPulse(players);
    } catch (err) {
      console.warn("PulseRadar failure (safely bypassed):", err);
    }

    fetchAvatarUrls(players)
      .then((avatarMap) => {
        renderPlayers(players, avatarMap);
        ensureShowcaseControls(players, avatarMap);

        if (topPlayer) {
          renderTopPlayerCard(topPlayer);
        }
      })
      .catch(() => { });

    if (topPlayer) {
      fetchTopBodyAvatar(topPlayer.userId)
        .then((bodyAvatarUrl) => {
          if (!bodyAvatarUrl) {
            return;
          }

          topPlayer.bodyAvatarUrl = bodyAvatarUrl;
          renderTopPlayerCard(topPlayer);
        })
        .catch(() => { });
    }
  }

  if (closeModalButton) {
    closeModalButton.addEventListener("click", closeModal);
  }

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && modal.classList.contains("open")) {
      closeModal();
    }

    const isAdminShortcut = event.ctrlKey && event.shiftKey && String(event.key || "").toLowerCase() === "u";
    if (!isAdminShortcut || isTypingTarget(event.target)) {
      return;
    }

    if (isAdminPanelPage()) {
      return;
    }

    event.preventDefault();
    window.location.href = "entrenched-sysadmin-ops-portal.html";
  });

  if (playersGrid) {
    init();
  }

  if (typeof window !== "undefined") {
    window.renderFactionNewsFeed = renderFactionNewsFeed;
    window.renderFactionPulse = renderFactionPulse;
    window.openModal = openModal;
    window.closeModal = closeModal;
  }

  startOpsHud();
  startLfgQueueSystem();
  startLiveGameIntel();

  // Initiate global data loading immediately on every page
  window.globalDataPromise = loadGlobalData();

})();
