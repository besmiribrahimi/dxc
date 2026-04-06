const fallbackPlayerLines = [
  "1. Bananaprouni -Faction: TWA | Country: Turkey -1074617547422441562",
  "2. 20SovietSO21 - Faction: DK | Country: Spain -  709893787220181024",
  "3. BLESK_BLESKAC - Faction: CZSK | Country: Slovakia -1105937367367430234",
  "4. Soliplismm -Faction: RKA | Country: Vietnam -1370210149872046111",
  "5. Clown213o - Faction: TCL | Country: N/A - 1031886526751199303",
  "6. DaSpokeyNameYT - Faction: N/A | Country: England -810172129063993355",
  "7. Dociusaltius - Faction: URF | Country: Sweden - 1280942991724515353",
  "8. doudperfectcom - Faction: AH | Country: Denmark - 709893787220181024",
  "9. fernichtung1 - Faction: TWL | Country: Germany - 1138569131835273306",
  "10. Flexmaster2002 - Faction: CZSK | Country: Czechia -758557476563320834",
  "11. hamit_gamer13000 - Faction: URF | Country: Turkey - 1203674300813676626",
  "12. ILIKEJOCK - Faction: TWL | Country: India - 903427514607742976",
  "13. iownlivy - Faction: AH/URF | Country: America - 1345260976131280966",
  "14. JacksonJGL - Faction: DK | Country: USA -1423843664416735305",
  "15. Jokerkingksh - Faction: TAE | Country: India -1269308875601871051",
  "16. kbfrm242 - Faction: AH | Country: Poland - 1160948303198965860",
  "17. ligth_hand - Faction: N/A | Country: Morocco -692456446637506640",
  "18. mattyDEAS - Faction: AH | Country: Scotland -290505755449098242",
  "19. Mike030312 - Faction: AH | Country: Spain -1268339311993159825",
  "20. MILITARYPRO123458 - Faction: URF/RKA | Country: Pakistan -1225114279095570585",
  "21. mlo1050 - Faction: CZSK | Country: Morocco -1338254502259855441",
  "22. MyNameIsBrickWall - Faction: DK | Country: UK -1164230762149724180",
  "23. nessa2008s - Faction: NDV | Country: Poland - 1170783507828703287",
  "24. Ninbinsin - Faction: TWL | Country: Uzbekistan - 1392952660268810304",
  "25. noah464 - Faction: TWL | Country: USA -1485287121660149790",
  "26. OnlyToast0 - Faction: AH | Country: UK - 1092548570948849777",
  "27. polloxlikop0911 - Faction: CZSK | Country: Spain - 1219797957205823599",
  "28. Prehist0rick - Faction: CZSK | Country: Netherlands - 1460270370232733720",
  "29. Quackenxnator - Faction: AH | Country: USA -1273758735738732626",
  "30. ramq124 - Faction: N/A | Country: Korea -1379471917744132209",
  "31. rittwdvk - Faction: AH | Country: USA -1056318347068850256",
  "32. Ruukke666 - Faction: AH | Country: Netherlands -1424751418329530418",
  "33. SAMOJEBEAST678 - Faction: URF | Country: Slovakia -1060198408071163974",
  "34. Sonyah13 - Faction: NDV | Country: Sweden -546300196963876889",
  "35. stolemyxrp - Faction: AH | Country: UK - 1457203936279924737",
  "36. Strango7 - Faction: CZSK | Country: Italy -866614107486158858",
  "37. SussyAmogusbals2 - Faction: NDV | Country: Kazakhstan - 1117543663355035718",
  "38. SwissAbyss1 - Faction: TWL | Country: USA - 1202382460118388746",
  "39. tamika2006s - Faction: NDV | Country: Sweden -719590123452498020",
  "40. ThatRandomPerson142 - Faction: RKA | Country: US - 1135256834148663407",
  "41. Vespartan_alt - Faction: TWL | Country: Czechia -1126609679955537921",
  "42. vcfghcemil - Faction: CZSK | Country: Germany - 1115662835972833311",
  "43. xxninjaxx9065 -Faction: N/A | Country: England - 805826703783231509",
  "44. umairomg777- Faction: AH | Country: india -790594364454862938",
  "45  kkevin789- Faction: AH |Country: USA -770824804676010004",
  "46. AvgEggEnjoyer- Faction: DK | Country: Czech Republic -805144861417144331"
];

const avatarIdMap = new Map([
  ["1xoji", 3879584970],
  ["20sovietso21", 1626472826],
  ["bananaprouni", 2483811288],
  ["blesk_bleskac", 1459210694],
  ["clown213o", 7690083810],
  ["daspokeynameyt", 531227865],
  ["dociusaltius", 8942473402],
  ["doudperfectcom", 1500083866],
  ["fernichtung1", 1353538228],
  ["flexmaster2002", 1580348110],
  ["hamit_gamer13000", 962032467],
  ["ilikejock", 7006486471],
  ["iownlivy", 144173904],
  ["jacksonjgl", 7203711117],
  ["jokerkingksh", 7646025503],
  ["kbfrm242", 10029985292],
  ["kkevin789", 356874951],
  ["ligth_hand", 3033171704],
  ["mattydeas", 3522921507],
  ["mike030312", 701820564],
  ["militarypro123458", 3809982795],
  ["mlo1050", 6228274852],
  ["mynameisbrickwall", 1686744432],
  ["nessa2008s", 105949022],
  ["ninbinsin", 7167592122],
  ["noah464", 15795537],
  ["onlytoast0", 7201544868],
  ["polloxlikop0911", 1106639346],
  ["prehist0rick", 10331502835],
  ["quackenxnator", 3183519478],
  ["ramq124", 2917331399],
  ["rittwdvk", 1620429291],
  ["ruukke666", 7223041185],
  ["samojebeast678", 5078731602],
  ["soliplismm", 2651722374],
  ["sonyah13", 603547403],
  ["stolemyxrp", 2219247830],
  ["strango7", 1321388284],
  ["sussyamogusbals2", 3608201663],
  ["swissabyss1", 339108819],
  ["tamika2006s", 187119271],
  ["thatrandomperson142", 3544844417],
  ["umairomg777", 5350074598],
  ["vcfghcemil", 4056889797],
  ["vespartan_alt", 1],
  ["xxninjaxx9065", 971867103],
  ["avgeggenjoyer", 1040455409]
]);

const fallbackAvatarId = 1;
const staticAvatarUrlMap = new Map([
  ["1", "https://t5.rbxcdn.com/30DAY-AvatarHeadshot-310966282D3529E36976BF6B07B1DC90-Png"],
  ["15795537", "https://t6.rbxcdn.com/30DAY-AvatarHeadshot-E3983E6C0261B86BD2771F423013EE82-Png"],
  ["105949022", "https://t0.rbxcdn.com/30DAY-AvatarHeadshot-49D0DCFE038EB9E22E415D7871DD61D3-Png"],
  ["144173904", "https://t4.rbxcdn.com/30DAY-AvatarHeadshot-4DBA50038CFAACD6437C8371AA1DFA6B-Png"],
  ["187119271", "https://t1.rbxcdn.com/30DAY-AvatarHeadshot-DBB5C083389785CB342A065CD4B1A156-Png"],
  ["339108819", "https://t7.rbxcdn.com/30DAY-AvatarHeadshot-C7F862E8AC8291161ED16AB6D21B8B0C-Png"],
  ["356874951", "https://t5.rbxcdn.com/30DAY-AvatarHeadshot-EA394A92FF416085028A27CBB47A5343-Png"],
  ["531227865", "https://t7.rbxcdn.com/30DAY-AvatarHeadshot-C9114A1D48DCA6BB1728F1C5382BD3F3-Png"],
  ["603547403", "https://t5.rbxcdn.com/30DAY-AvatarHeadshot-343CB04696D3A8FF9B6F8FA300A00967-Png"],
  ["6228274852", "https://t5.rbxcdn.com/30DAY-AvatarHeadshot-3AFB262B8F305A8B3AF6C02B4E269EC2-Png"],
  ["701820564", "https://t3.rbxcdn.com/30DAY-AvatarHeadshot-3FE82F2AC6CFC5DE7A23F237B9DD71D0-Png"],
  ["971867103", "https://t7.rbxcdn.com/30DAY-AvatarHeadshot-E27A02322EC846F332920DF243A663E1-Png"],
  ["1040455409", "https://t7.rbxcdn.com/30DAY-AvatarHeadshot-FEE35098A09155606B6B7632A739CEA7-Png"],
  ["1106639346", "https://t4.rbxcdn.com/30DAY-AvatarHeadshot-15385D565FD1B955A825593AC6C7F84B-Png"],
  ["1321388284", "https://t0.rbxcdn.com/30DAY-AvatarHeadshot-70ECF9D41CE7663302FC965607516F30-Png"],
  ["1353538228", "https://t5.rbxcdn.com/30DAY-AvatarHeadshot-4941839526E6A084CEF995EE42621BF7-Png"],
  ["1459210694", "https://t5.rbxcdn.com/30DAY-AvatarHeadshot-986454B00F97908468143D6ECCA573D6-Png"],
  ["1500083866", "https://t4.rbxcdn.com/30DAY-AvatarHeadshot-E023E23A18C8165D1E1A7BC533424FBE-Png"],
  ["1580348110", "https://t4.rbxcdn.com/30DAY-AvatarHeadshot-5B838B59A66DF69365CC8597A51155E5-Png"],
  ["1620429291", "https://t6.rbxcdn.com/30DAY-AvatarHeadshot-0EFAAC5869EB93F71AE140B1F6FFF24F-Png"],
  ["1626472826", "https://t7.rbxcdn.com/30DAY-AvatarHeadshot-D0B6E4371031F7ED74A892CDBA985C86-Png"],
  ["1686744432", "https://t7.rbxcdn.com/30DAY-AvatarHeadshot-F77C93661D9C1AC8B32B0D8F605864E6-Png"],
  ["2219247830", "https://t3.rbxcdn.com/30DAY-AvatarHeadshot-DD44C2718B021A857AC84C2DF27E58C0-Png"],
  ["2483811288", "https://t0.rbxcdn.com/30DAY-AvatarHeadshot-477404A853E778126C94AF455D693B54-Png"],
  ["2651722374", "https://t1.rbxcdn.com/30DAY-AvatarHeadshot-DBB88EB7E4035468F0867223EC737DA1-Png"],
  ["2917331399", "https://t6.rbxcdn.com/30DAY-AvatarHeadshot-F79E43180E8E4947F02DDE884FDCD457-Png"],
  ["3033171704", "https://t5.rbxcdn.com/30DAY-AvatarHeadshot-8A335F2409C1F447F76FED8B3CCCC263-Png"],
  ["3183519478", "https://t2.rbxcdn.com/30DAY-AvatarHeadshot-0BF68FADFCF9B921FC689FB4667CCF4C-Png"],
  ["3522921507", "https://t3.rbxcdn.com/30DAY-AvatarHeadshot-67B50DFFE50C017B26B451758CCD41D2-Png"],
  ["3544844417", "https://t7.rbxcdn.com/30DAY-AvatarHeadshot-D03244ACAF431A29DFD6623F24BF7F51-Png"],
  ["3608201663", "https://t1.rbxcdn.com/30DAY-AvatarHeadshot-0555EA04AAE8CCD0FC694A990A19DECD-Png"],
  ["3809982795", "https://t7.rbxcdn.com/30DAY-AvatarHeadshot-312DEA6AE8BA785761998F1A3C56A1FB-Png"],
  ["3879584970", "https://t0.rbxcdn.com/30DAY-AvatarHeadshot-95593AC73F3D3D0B1889F5030DC6E01A-Png"],
  ["4056889797", "https://t7.rbxcdn.com/30DAY-AvatarHeadshot-B3564D1C033BD1F1552CE1C3EC7DB110-Png"],
  ["5078731602", "https://t4.rbxcdn.com/30DAY-AvatarHeadshot-3DE29461D52FF22F630AAA5A76CBE6D1-Png"],
  ["5350074598", "https://t7.rbxcdn.com/30DAY-AvatarHeadshot-6AD2F1D4530567F7B7D9BBE724BE44D8-Png"],
  ["7006486471", "https://t6.rbxcdn.com/30DAY-AvatarHeadshot-AF92B762727A2F166953076E9CE11BD2-Png"],
  ["7167592122", "https://t3.rbxcdn.com/30DAY-AvatarHeadshot-F885010E5B46CC04CCF4551363A5631E-Png"],
  ["7201544868", "https://t5.rbxcdn.com/30DAY-AvatarHeadshot-FC15F9973081CCFB7C784B26BAAA2D13-Png"],
  ["7203711117", "https://t6.rbxcdn.com/30DAY-AvatarHeadshot-EC2C1E9E370F2D5386C833440B911AE4-Png"],
  ["7223041185", "https://t0.rbxcdn.com/30DAY-AvatarHeadshot-E8F4804C4CC6222F74FA9AC5B740E7B0-Png"],
  ["7646025503", "https://t4.rbxcdn.com/30DAY-AvatarHeadshot-FEB8ACD1821B280B43A1D89DB7017102-Png"],
  ["7690083810", "https://t4.rbxcdn.com/30DAY-AvatarHeadshot-57591F2EAB8F2F8D7CB45BDE9F4C766A-Png"],
  ["8942473402", "https://t4.rbxcdn.com/30DAY-AvatarHeadshot-2A2FE8D0E5C503690A38A895CC9D9BEA-Png"],
  ["10029985292", "https://t1.rbxcdn.com/30DAY-AvatarHeadshot-5A8660FF441C7EC49C7D62154E986808-Png"],
  ["10331502835", "https://t4.rbxcdn.com/30DAY-AvatarHeadshot-298E960617552A34E95943B0D9575E68-Png"]
]);

const playersGrid = document.getElementById("playersGrid");
const modal = document.getElementById("playerModal");
const closeModalButton = document.getElementById("closeModal");
const modalAvatar = document.getElementById("modalAvatar");
const modalName = document.getElementById("modalName");
const modalFaction = document.getElementById("modalFaction");
const modalCountry = document.getElementById("modalCountry");
const modalWins = document.getElementById("modalWins");
const modalKd = document.getElementById("modalKd");
const modalDiscord = document.getElementById("modalDiscord");
const topPlayerCard = document.getElementById("topPlayerCard");
const topPlayerNameNode = document.getElementById("topPlayerName");
const topPlayerSubtitleNode = document.getElementById("topPlayerSubtitle");
const topPlayerWinsNode = document.getElementById("topPlayerWins");
const topPlayerKdNode = document.getElementById("topPlayerKd");
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
  wins: 3,
  kd: 4.0,
  subtitle: "Dominating recent matches with top performance."
};
const FULL_BODY_SIZE = "720x720";
const factionFlagMap = new Map([
  ["72ND", "faction_flags/72ND.png"],
  ["AEF", "faction_flags/AEF.png"],
  ["AH", "faction_flags/AH.png"],
  ["ASHEN GUARD", "faction_flags/ASHEN GUARD.png"],
  ["BS", "faction_flags/BS.png"],
  ["DK", "faction_flags/DK.png"],
  ["DSA", "faction_flags/DSA.png"],
  ["IA", "faction_flags/IA.png"],
  ["INS", "faction_flags/INS.png"],
  ["KOC", "faction_flags/KOC.png"],
  ["NDV", "faction_flags/NDV.png"],
  ["NYS", "faction_flags/NYS.png"],
  ["RRF", "faction_flags/RRF.png"],
  ["SEM", "faction_flags/SEM.png"],
  ["TAE", "faction_flags/TAE.png"],
  ["TCL", "faction_flags/TCL.png"],
  ["TIO", "faction_flags/TIO.png"],
  ["TTI", "faction_flags/tti.png"],
  ["TWA", "faction_flags/TWA.png"],
  ["TWL", "faction_flags/TWL.png"],
  ["URF", "faction_flags/URF.png"]
]);

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitFactionTokens(faction) {
  const normalized = normalizeText(faction);
  if (!normalized || normalized.toUpperCase() === "N/A") {
    return ["N/A"];
  }

  return normalized
    .split(/[\/,&|]+/)
    .map((part) => normalizeText(part).toUpperCase())
    .filter(Boolean);
}

function getFactionFlagPath(token) {
  return factionFlagMap.get(String(token || "").toUpperCase()) || "";
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

  const withoutIndex = line.replace(/^\d+\s*\.?\s*/, "");
  const discordMatch = withoutIndex.match(/-\s*(\d{8,})\s*$/);
  if (!discordMatch) {
    return null;
  }

  const discordId = discordMatch[1];
  const withoutDiscord = withoutIndex.slice(0, discordMatch.index).trim();
  const dataMatch = withoutDiscord.match(/^(.*?)\s*-\s*Faction:\s*(.*?)\s*\|\s*Country:\s*(.*?)\s*$/i);
  if (!dataMatch) {
    return null;
  }

  const name = normalizeText(dataMatch[1]);
  const faction = normalizeText(dataMatch[2]) || "N/A";
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
    wins: 0,
    kd: 0
  };
}

function getStaticAvatarUrl(userId) {
  return staticAvatarUrlMap.get(String(userId || fallbackAvatarId)) || "";
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

function countryToFlag(country) {
  const normalized = normalizeText(country).toLowerCase();
  const map = {
    turkey: "TR",
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
    italy: "IT"
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

function getPlayerStats(name, isTopPlayer) {
  if (isTopPlayer) {
    return {
      wins: TOP_PLAYER_OVERRIDES.wins,
      kd: TOP_PLAYER_OVERRIDES.kd
    };
  }

  const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const wins = (seed % 10) + 1;
  const kd = Number((((seed % 34) + 13) / 10).toFixed(1));

  return { wins, kd };
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
  const ids = [...new Set(
    players
      .map((player) => Number(player.userId))
      .filter((id) => Number.isFinite(id) && id > 0)
  )];

  if (!ids.length) {
    return avatarMap;
  }

  const CHUNK_SIZE = 50;
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch(getThumbnailApiUrl(chunk), { cache: "no-store" });
      if (!response.ok) {
        continue;
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
  }

  return avatarMap;
}

function getWaveStep(indexInGroup, groupSize) {
  const lastIndex = Math.max(0, groupSize - 1);
  const mirrored = Math.min(indexInGroup, lastIndex - indexInGroup);
  return Math.max(0, mirrored);
}

function buildPlayerCard(player, index, avatarMap) {
  const card = document.createElement("article");
  card.className = "player-card";
  card.tabIndex = 0;
  const groupIndex = Math.floor(index / GROUP_SIZE);
  const indexInGroup = index % GROUP_SIZE;
  const waveStep = getWaveStep(indexInGroup, GROUP_SIZE);
  card.style.setProperty("--group-delay", `${groupIndex * GROUP_DELAY_MS}ms`);
  card.style.setProperty("--item-delay", `${waveStep * WAVE_DELAY_MS}ms`);
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open Player ${player.name}`);

  const primaryAvatar =
    avatarMap.get(Number(player.userId)) ||
    getStaticAvatarUrl(player.userId) ||
    getFallbackAvatarUrl(player.name);
  const fallbackAvatar = getFallbackAvatarUrl(player.name);
  player.avatarUrl = primaryAvatar;
  const factionChipMarkup = buildFactionChipHtml(player.faction, {
    chipClass: "player-faction-chip",
    maxItems: 1
  });

  card.innerHTML = `
    <img class="player-image" src="${primaryAvatar}" alt="${player.name} Roblox avatar" loading="lazy" referrerpolicy="no-referrer">
    <div class="player-overlay">
      <span class="player-label">Player</span>
      ${factionChipMarkup}
      <h3 class="player-name">${player.name}</h3>
    </div>
  `;

  const imageNode = card.querySelector(".player-image");
  imageNode.addEventListener("error", () => {
    imageNode.src = fallbackAvatar;
  });

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
  if (!modal || !modalAvatar || !modalName || !modalFaction || !modalCountry || !modalWins || !modalKd || !modalDiscord) {
    return;
  }

  modalAvatar.src = player.bodyAvatarUrl || player.avatarUrl || getStaticAvatarUrl(player.userId) || getFallbackAvatarUrl(player.name);
  modalAvatar.alt = `${player.name} Roblox avatar`;
  modalName.textContent = player.name;
  modalFaction.innerHTML = buildFactionChipHtml(player.faction, {
    chipClass: "modal-faction-chip",
    maxItems: 4,
    includeGroupWrapper: true,
    groupClass: "modal-faction-group"
  });
  modalCountry.textContent = `${countryToFlag(player.country)} ${player.country}`;
  modalWins.textContent = String(player.wins);
  modalKd.textContent = Number(player.kd).toFixed(1);
  modalDiscord.href = `https://discord.com/users/${player.discordId}`;
  modalDiscord.textContent = "Open Player Discord";

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function renderTopPlayerCard(player) {
  if (!topPlayerCard || !topPlayerNameNode || !topPlayerSubtitleNode || !topPlayerWinsNode || !topPlayerKdNode || !topCountryBadgeNode || !topPlayerAvatarNode || !topFactionBadgeNode) {
    return;
  }

  topPlayerNameNode.textContent = player.name;
  topPlayerSubtitleNode.textContent = TOP_PLAYER_OVERRIDES.subtitle;
  topPlayerWinsNode.textContent = String(player.wins);
  topPlayerKdNode.textContent = Number(player.kd).toFixed(1);
  topCountryBadgeNode.textContent = `${countryToFlag(player.country)} ${player.country}`;
  const factionPrimaryToken = splitFactionTokens(player.faction)[0];
  const safeFactionToken = escapeHtml(factionPrimaryToken || "N/A");
  const badgeFlagPath = getFactionFlagPath(factionPrimaryToken);
  const badgeFlagMarkup = badgeFlagPath
    ? `<img class="faction-flag-icon" src="${badgeFlagPath}" alt="${safeFactionToken} flag" loading="lazy">`
    : "";
  topFactionBadgeNode.innerHTML = `${badgeFlagMarkup}${safeFactionToken}`;

  const heroAvatar = player.bodyAvatarUrl || player.avatarUrl || getStaticAvatarUrl(player.userId) || getFallbackAvatarUrl(player.name);
  topPlayerAvatarNode.src = heroAvatar;
  topPlayerAvatarNode.alt = `${player.name} Roblox avatar`;

  const fallbackAvatar = getFallbackAvatarUrl(player.name);
  topPlayerAvatarNode.addEventListener("error", () => {
    topPlayerAvatarNode.src = fallbackAvatar;
  }, { once: true });

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
  try {
    const response = await fetch("discordlink", { cache: "no-store" });
    if (response.ok) {
      const text = await response.text();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length > 0) {
        return lines;
      }
    }
  } catch {
    // Fallback is used when local file serving blocks access.
  }

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

  const lines = await loadPlayerLines();
  const players = lines
    .map(parsePlayerLine)
    .filter(Boolean);

  players.forEach((player) => {
    const isTop = player.name.toLowerCase() === TOP_PLAYER_NAME.toLowerCase();
    const stats = getPlayerStats(player.name, isTop);
    player.wins = stats.wins;
    player.kd = stats.kd;
  });

  const avatarMap = await fetchAvatarUrls(players);

  const topPlayer = players.find((player) => player.name.toLowerCase() === TOP_PLAYER_NAME.toLowerCase()) || players[0];
  if (topPlayer) {
    topPlayer.bodyAvatarUrl = await fetchTopBodyAvatar(topPlayer.userId);
    renderTopPlayerCard(topPlayer);
  }

  renderPlayers(players, avatarMap);
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

  const isAdminShortcut = event.ctrlKey && event.shiftKey && String(event.key || "").toLowerCase() === "a";
  if (!isAdminShortcut || isTypingTarget(event.target)) {
    return;
  }

  const pathname = String(window.location.pathname || "").toLowerCase();
  if (pathname.endsWith("/admin.html") || pathname.endsWith("admin.html")) {
    return;
  }

  event.preventDefault();
  window.location.href = "admin.html";
});

if (playersGrid) {
  init();
}
