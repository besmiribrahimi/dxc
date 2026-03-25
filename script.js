// Player Data
const playerData = [
    { username: "20SovietSO21", faction: "DK", country: "Spain" },
    { username: "BLESK_BLESKAC", faction: "CZSK", country: "Slovakia" },
    { username: "Clown213o", faction: "TCL", country: "N/A" },
    { username: "crimsvonn", faction: "DK", country: "US" },
    { username: "DaSpokeyNameYT", faction: "N/A", country: "England" },
    { username: "Dociusaltius", faction: "URF", country: "Sweden" },
    { username: "doudperfectcom", faction: "AH", country: "Denmark" },
    { username: "fernichtung1", faction: "TWL", country: "Germany" },
    { username: "Flexmaster2002", faction: "CZSK", country: "Czechia" },
    { username: "hamit_gamer13000", faction: "URF", country: "Turkey" },
    { username: "ILIKEJOCK", faction: "TWL", country: "India" },
    { username: "iownlivy", faction: "AH/URF", country: "America" },
    { username: "Jokerkingksh", faction: "TAE", country: "India" },
    { username: "kbfrm242", faction: "AH", country: "Poland" },
    { username: "ligth_hand", faction: "N/A", country: "Morocco" },
    { username: "MILITARYPRO123458", faction: "URF/RKA", country: "Pakistan" },
    { username: "MyNameIsBrickWall", faction: "DK", country: "UK" },
    { username: "nessa2008s", faction: "NDV", country: "Poland" },
    { username: "Ninbinsin", faction: "TWL", country: "Uzbekistan" },
    { username: "noah464", faction: "TWL", country: "USA" },
    { username: "OnlyToast0", faction: "AH", country: "UK" },
    { username: "polloxlikop0911", faction: "CZSK", country: "Spain" },
    { username: "Prehist0rick", faction: "CZSK", country: "Netherlands" },
    { username: "Quackenxnator", faction: "AH", country: "USA" },
    { username: "ramq124", faction: "N/A", country: "Korea" },
    { username: "Ruukke666", faction: "AH", country: "Netherlands" },
    { username: "SAMOJEBEAST678", faction: "URF", country: "Slovakia" },
    { username: "Sonyah13", faction: "NDV", country: "Sweden" },
    { username: "stolemyxrp", faction: "AH", country: "UK" },
    { username: "Strango7", faction: "CZSK", country: "Italy" },
    { username: "SussyAmogusbals2", faction: "NDV", country: "Kazakhstan" },
    { username: "SwissAbyss1", faction: "TWL", country: "USA" },
    { username: "tamika2006s", faction: "NDV", country: "Sweden" },
    { username: "ThatRandomPerson142", faction: "RKA", country: "US" },
    { username: "vcfghcemil", faction: "CZSK", country: "Germany" },
    { username: "xxninjaxx9065", faction: "TWL", country: "UK" }
];

// ELO system configuration (public rules)
const ELO_DEFAULT = 1000;

const ELO_RULES = {
    oneVOne: {
        win: {
            same: 500,
            higher: 650,
            lower: 350
        },
        loss: {
            same: -400,
            higher: -250,
            lower: -550
        }
    },
    factionBattle: {
        win: {
            top: 400,
            average: 200,
            low: 100
        },
        loss: {
            top: -100,
            average: -200,
            low: -305
        }
    },
    levels: [
        { level: 1, minElo: 450 },
        { level: 2, minElo: 500 },
        { level: 3, minElo: 600 },
        { level: 4, minElo: 750 },
        { level: 5, minElo: 1000 },
        { level: 6, minElo: 1200 },
        { level: 7, minElo: 1400 },
        { level: 8, minElo: 1800 },
        { level: 9, minElo: 2000 },
        { level: 10, minElo: 2400 }
    ]
};

function getLevelFromElo(elo) {
    const sorted = [...ELO_RULES.levels].sort((a, b) => b.minElo - a.minElo);
    const match = sorted.find((entry) => elo >= entry.minElo);
    return match ? match.level : 1;
}

function getRelativeTierByLevel(playerElo, opponentElo) {
    const playerLevel = getLevelFromElo(playerElo);
    const opponentLevel = getLevelFromElo(opponentElo);

    if (playerLevel === opponentLevel) return 'same';
    return opponentLevel > playerLevel ? 'higher' : 'lower';
}

let quickFilterMode = 'all';
let searchDebounceTimer = null;

// Initialize player rankings
let playerRankings = playerData.map((player, index) => {
    return {
        rank: index + 1,
        previousRank: index + 1,
        rankChange: 0,
        username: player.username,
        faction: player.faction,
        country: player.country,
        addedOrder: index + 1,
        isNew: index >= playerData.length - 8,
        level: getLevelFromElo(ELO_DEFAULT),
        elo: ELO_DEFAULT,
        wins: 0,
        losses: 0,
        trend: 'neutral'
    };
});

// Sort by ELO
resortRankings();

// Country to Emoji mapping
const countryEmojis = {
    'Poland': '🇵🇱',
    'Turkey': '🇹🇷',
    'Czechia': '🇨🇿',
    'Sweden': '🇸🇪',
    'India': '🇮🇳',
    'Slovakia': '🇸🇰',
    'Spain': '🇪🇸',
    'Denmark': '🇩🇰',
    'UK': '🇬🇧',
    'England': '🇬🇧',
    'Netherlands': '🇳🇱',
    'America': '🇺🇸',
    'US': '🇺🇸',
    'USA': '🇺🇸',
    'Kazakhstan': '🇰🇿',
    'Germany': '🇩🇪',
    'Italy': '🇮🇹',
    'Korea': '🇰🇷',
    'Morocco': '🇲🇦',
    'Pakistan': '🇵🇰',
    'Uzbekistan': '🇺🇿',
    'N/A': '❓'
};

function getCountryEmoji(country) {
    return countryEmojis[country] || '🌍';
}

// Faction Flags - using PNG files
const factionImages = {
    'DK': 'faction_flags/DK.png',
    'TCL': 'faction_flags/TCL.png',
    'AH': 'faction_flags/AH.png',
    'TWL': 'faction_flags/TWL.png',
    'TAE': 'faction_flags/TAE.png',
    'NDV': 'faction_flags/NDV.png',
    'URF': 'faction_flags/AEF.png',
    'AH/URF': 'faction_flags/AH.png',
    'FLASH': 'faction_flags/DK.png',
    'N/A': ''
};

function getFactionFlag(faction) {
    const fileName = factionImages[(faction || '').toUpperCase()];
    if (!fileName) return '';
    return fileName;
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    populateFilters();
    renderLeaderboard(playerRankings);
    updateQuickStats(playerRankings.length);
    
    // Event listeners
    document.getElementById('searchInput').addEventListener('input', debounceFilterLeaderboard);
    document.getElementById('factionFilter').addEventListener('change', filterLeaderboard);
    document.getElementById('countryFilter').addEventListener('change', filterLeaderboard);
    document.querySelectorAll('.quick-chip').forEach((chip) => {
        chip.addEventListener('click', () => setQuickFilter(chip.dataset.chip || 'all'));
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closePlayerModal();
        }
    });
});

// Populate filter dropdowns
function populateFilters() {
    const factions = [...new Set(playerData.map(p => p.faction))].sort();
    const countries = [...new Set(playerData.map(p => p.country))].sort();
    
    const factionFilter = document.getElementById('factionFilter');
    const countryFilter = document.getElementById('countryFilter');
    
    factions.forEach(faction => {
        const option = document.createElement('option');
        option.value = faction;
        option.textContent = faction;
        factionFilter.appendChild(option);
    });
    
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = getCountryEmoji(country) + ' ' + country;
        countryFilter.appendChild(option);
    });
}

// Render leaderboard
function renderLeaderboard(players) {
    const table = document.getElementById('leaderboardTable');
    table.innerHTML = '';

    if (!players.length) {
        renderTopPodium([]);
        table.innerHTML = '<div class="no-results">No players match the current filters.</div>';
        updateQuickStats(0);
        return;
    }

    const podiumPlayers = renderTopPodium(players);
    const podiumUsernames = new Set(podiumPlayers.map((player) => player.username));
    const tablePlayers = players.filter((player) => !podiumUsernames.has(player.username));

    if (!tablePlayers.length) {
        table.innerHTML = '<div class="no-results">Top players are shown on the podium above.</div>';
        updateQuickStats(players.length);
        return;
    }
    
    tablePlayers.forEach((player, index) => {
        const row = document.createElement('div');
        const rankClass = player.rank <= 3 ? `rank-${player.rank}` : '';
        row.className = `leaderboard-row ${player.rank <= 3 ? 'top-3' : ''} ${rankClass}`.trim();
        row.style.cursor = 'pointer';
        row.style.animationDelay = `${Math.min(index * 24, 260)}ms`;
        
        const trendEmoji = player.trend === 'up' ? '↑' : player.trend === 'down' ? '↓' : '→';
        const trendClass = `trend-${player.trend}`;
        const trendValue = player.rankChange > 0 ? `+${player.rankChange}` : `${player.rankChange}`;
        
        const wlClass = player.wins >= player.losses ? '' : 'negative';
        const badges = getPlayerBadges(player)
            .map((badge) => `<span class="player-badge badge-${badge.toLowerCase().replace(/\s+/g, '-')}">${badge}</span>`)
            .join('');
        
        const factionImg = getFactionFlag(player.faction);
        const factionDisplay = factionImg ? `<img src="${factionImg}" alt="${player.faction}" class="faction-flag">` : '';
        
        row.innerHTML = `
            <div class="rank">${player.rank}</div>
            <div class="player-info">
                <div class="player-avatar">${player.username.charAt(0).toUpperCase()}</div>
                <div class="player-name">
                    <strong>${player.username}</strong>
                    <small>${factionDisplay}${factionDisplay ? ' ' : ''}${player.faction}</small>
                    ${badges ? `<div class="player-badges">${badges}</div>` : ''}
                </div>
            </div>
            <div class="stats-row">
                <div class="stat">
                    <span class="level-badge">
                        <img src="${player.level}.png" alt="Level ${player.level}" class="level-img" onerror="this.style.display='none'">
                        Lvl ${player.level}
                    </span>
                </div>
                <div class="stat elo">${player.elo.toFixed(0)}</div>
                <div class="stat win-loss ${wlClass}">${player.wins}W-${player.losses}L</div>
                <div class="stat faction-tag">${factionDisplay}${factionDisplay ? ' ' : ''}${player.faction}</div>
                <div class="stat country-tag">${getCountryEmoji(player.country)} ${player.country}</div>
            </div>
            <div class="trend ${trendClass}"><span class="trend-arrow">${trendEmoji}</span><span class="trend-value">${trendValue}</span></div>
        `;
        
        row.addEventListener('click', () => openPlayerModal(player.username));
        table.appendChild(row);
    });

    updateQuickStats(players.length);
}

function renderTopPodium(players) {
    const podium = document.getElementById('topPodium');
    if (!podium) return [];

    const top = [...players]
        .sort((a, b) => b.elo - a.elo)
        .slice(0, 3);

    if (!top.length) {
        podium.innerHTML = '';
        return [];
    }

    const getPlayer = (place) => top[place - 1] || null;
    const p1 = getPlayer(1);
    const p2 = getPlayer(2);
    const p3 = getPlayer(3);

    const renderSlot = (player, place) => {
        if (!player) {
            return `
                <div class="podium-slot slot-${place} empty">
                    <div class="podium-step step-${place}">#${place}</div>
                </div>
            `;
        }

        const factionImg = getFactionFlag(player.faction);
        const factionDisplay = factionImg ? `<img src="${factionImg}" alt="${player.faction}" class="faction-flag">` : '';
        const medal = place === 1 ? 'GOLD' : place === 2 ? 'SILVER' : 'BRONZE';
        const badges = getPlayerBadges(player).slice(0, 1)
            .map((badge) => `<span class="player-badge badge-${badge.toLowerCase().replace(/\s+/g, '-')}">${badge}</span>`)
            .join('');

        return `
            <div class="podium-slot slot-${place}" data-username="${player.username}">
                <div class="podium-player-card">
                    <div class="podium-crown">${medal}</div>
                    <strong>${player.username}</strong>
                    <small>${factionDisplay}${factionDisplay ? ' ' : ''}${player.faction}</small>
                    <span>${getCountryEmoji(player.country)} ${player.country}</span>
                    ${badges}
                </div>
                <div class="podium-step step-${place}">
                    <div class="podium-place">#${place}</div>
                    <div class="podium-elo">${player.elo.toFixed(0)} ELO</div>
                </div>
            </div>
        `;
    };

    podium.innerHTML = `
        ${renderSlot(p2, 2)}
        ${renderSlot(p1, 1)}
        ${renderSlot(p3, 3)}
    `;

    podium.querySelectorAll('.podium-slot[data-username]').forEach((slot) => {
        slot.addEventListener('click', () => openPlayerModal(slot.dataset.username));
    });

    return top;
}

// Filter leaderboard
function filterLeaderboard() {
    const searchTerm = document.getElementById('searchInput').value;
    const factionFilter = document.getElementById('factionFilter').value;
    const countryFilter = document.getElementById('countryFilter').value;
    const effectiveFactionFilter = factionFilter || (quickFilterMode === 'my-faction' ? getMostCommonFaction() : '');
    const searchTokens = normalizeSearchText(searchTerm).split(' ').filter(Boolean);

    let filtered = playerRankings.filter(player => {
        const searchable = normalizeSearchText(`${player.username} ${player.faction} ${player.country}`);
        const matchesSearch = searchTokens.every((token) => searchable.includes(token));
        const matchesFaction = !effectiveFactionFilter || player.faction === effectiveFactionFilter;
        const matchesCountry = !countryFilter || player.country === countryFilter;
        
        return matchesSearch && matchesFaction && matchesCountry;
    });

    if (quickFilterMode === 'top10') {
        filtered = filtered.slice(0, 10);
    } else if (quickFilterMode === 'new') {
        filtered = filtered.filter((player) => player.isNew);
    }
    
    renderLeaderboard(filtered);
}

function debounceFilterLeaderboard() {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(() => {
        filterLeaderboard();
    }, 120);
}

function normalizeSearchText(value) {
    return (value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function setQuickFilter(mode) {
    if (quickFilterMode === mode && mode !== 'all') {
        mode = 'all';
    }

    quickFilterMode = mode;
    document.querySelectorAll('.quick-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.chip === mode);
    });
    filterLeaderboard();
}

function getMostCommonFaction() {
    const factionCounts = playerData.reduce((acc, player) => {
        acc[player.faction] = (acc[player.faction] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(factionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function getPlayerBadges(player) {
    const badges = [];

    if (player.rank <= 3) badges.push('Top Fragger');
    if (player.wins >= 5 && player.wins > player.losses) badges.push('Clutch');
    if (player.rankChange > 0 || (player.rank > 3 && player.rank <= 10)) badges.push('Rising');

    return badges.slice(0, 2);
}

function updateQuickStats(shownCount) {
    const factionCount = new Set(playerData.map(player => player.faction)).size;
    const countryCount = new Set(playerData.map(player => player.country)).size;

    const totalPlayers = document.getElementById('totalPlayers');
    const totalFactions = document.getElementById('totalFactions');
    const totalCountries = document.getElementById('totalCountries');
    const shownPlayers = document.getElementById('shownPlayers');

    if (totalPlayers) totalPlayers.textContent = playerData.length;
    if (totalFactions) totalFactions.textContent = factionCount;
    if (totalCountries) totalCountries.textContent = countryCount;
    if (shownPlayers) shownPlayers.textContent = shownCount;
}

function resortRankings() {
    const previousRanks = new Map(playerRankings.map((player) => [player.username, player.rank || 0]));

    playerRankings.sort((a, b) => b.elo - a.elo);
    
    playerRankings.forEach((player, index) => {
        const newRank = index + 1;
        const oldRank = previousRanks.get(player.username) || newRank;
        player.previousRank = oldRank;
        player.rank = newRank;
        player.rankChange = oldRank - newRank;
        player.trend = player.rankChange > 0 ? 'up' : player.rankChange < 0 ? 'down' : 'neutral';
    });
}

function applyEloChange(player, delta) {
    const previousElo = player.elo;
    player.elo = Math.max(0, player.elo + delta);
    player.level = getLevelFromElo(player.elo);
    return player.elo - previousElo;
}

function apply1v1Result(winnerUsername, loserUsername) {
    const winner = playerRankings.find((p) => p.username === winnerUsername);
    const loser = playerRankings.find((p) => p.username === loserUsername);
    if (!winner || !loser || winner.username === loser.username) return null;

    const winnerTier = getRelativeTierByLevel(winner.elo, loser.elo);
    const loserTier = getRelativeTierByLevel(loser.elo, winner.elo);

    const winnerDelta = ELO_RULES.oneVOne.win[winnerTier];
    const loserDelta = ELO_RULES.oneVOne.loss[loserTier];

    applyEloChange(winner, winnerDelta);
    applyEloChange(loser, loserDelta);

    winner.wins += 1;
    loser.losses += 1;

    resortRankings();
    renderLeaderboard(playerRankings);

    return {
        winner: { username: winner.username, delta: winnerDelta, elo: winner.elo, level: winner.level },
        loser: { username: loser.username, delta: loserDelta, elo: loser.elo, level: loser.level }
    };
}

function applyFactionBattleResult(username, teamResult, performanceTier) {
    const player = playerRankings.find((p) => p.username === username);
    if (!player) return null;

    const normalizedTeamResult = (teamResult || '').toLowerCase();
    const normalizedTier = (performanceTier || '').toLowerCase();
    const tierMap = { avg: 'average', average: 'average', top: 'top', low: 'low' };
    const mappedTier = tierMap[normalizedTier] || normalizedTier;

    const teamRules = ELO_RULES.factionBattle[normalizedTeamResult];
    if (!teamRules || typeof teamRules[mappedTier] !== 'number') return null;

    const delta = teamRules[mappedTier];
    applyEloChange(player, delta);
    resortRankings();
    renderLeaderboard(playerRankings);

    return { username: player.username, delta, elo: player.elo, level: player.level };
}

// Expose ELO engine for future admin tooling or console usage.
window.eloSystem = {
    ELO_RULES,
    getLevelFromElo,
    apply1v1Result,
    applyFactionBattleResult,
    getRankings: () => [...playerRankings]
};

// Switch between views
function switchView(viewName, event) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    document.getElementById(viewName + '-view').classList.add('active');
    
    if (event && event.target && event.target.classList) {
        event.target.classList.add('active');
    }
}

// Open player profile modal
function openPlayerModal(username) {
    const player = playerRankings.find(p => p.username === username);
    if (!player) return;
    
    // Set player info
    document.getElementById('playerModalName').textContent = player.username;
    document.getElementById('playerRank').textContent = `#${player.rank}`;
    document.getElementById('playerELO').textContent = player.elo.toFixed(0);
    document.getElementById('playerWL').textContent = `${player.wins}W - ${player.losses}L`;
    document.getElementById('playerLevel').textContent = `Level ${player.level}`;
    
    const factionImg = getFactionFlag(player.faction);
    const factionDisplay = factionImg ? `<img src="${factionImg}" alt="${player.faction}" class="faction-flag"> ${player.faction}` : player.faction;
    document.getElementById('playerFaction').innerHTML = factionDisplay;
    
    document.getElementById('playerCountry').textContent = `${getCountryEmoji(player.country)} ${player.country}`;
    
    // Show modal
    const modal = document.getElementById('playerModal');
    modal.classList.remove('closing');
    modal.classList.add('active');
    document.body.classList.add('modal-open');
}

// Close player profile modal
function closePlayerModal() {
    const modal = document.getElementById('playerModal');
    if (!modal.classList.contains('active')) return;
    modal.classList.add('closing');
    setTimeout(() => {
        modal.classList.remove('active', 'closing');
        document.body.classList.remove('modal-open');
    }, 180);
}

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
    const modal = document.getElementById('playerModal');
    if (event.target === modal) {
        closePlayerModal();
    }
});
