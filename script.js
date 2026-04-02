// Player Data
const playerData = [
    { username: "1Xoji", faction: "N/A", country: "North America" },
    { username: "20SovietSO21", faction: "DK", country: "Spain" },
    { username: "BLESK_BLESKAC", faction: "CZSK", country: "Slovakia" },
    { username: "Clown213o", faction: "TCL", country: "N/A" },
    { username: "DaSpokeyNameYT", faction: "N/A", country: "England" },
    { username: "Dociusaltius", faction: "URF", country: "Sweden" },
    { username: "doudperfectcom", faction: "AH", country: "Denmark" },
    { username: "fernichtung1", faction: "TWL", country: "Germany" },
    { username: "Flexmaster2002", faction: "CZSK", country: "Czechia" },
    { username: "hamit_gamer13000", faction: "URF", country: "Turkey" },
    { username: "ILIKEJOCK", faction: "TWL", country: "India" },
    { username: "iownlivy", faction: "AH/URF", country: "USA" },
    { username: "JacksonJGL", faction: "DK", country: "USA" },
    { username: "Jokerkingksh", faction: "TAE", country: "India" },
    { username: "kbfrm242", faction: "AH", country: "Poland" },
    { username: "ligth_hand", faction: "N/A", country: "Morocco" },
    { username: "mattyDEAS", faction: "AH", country: "Scotland" },
    { username: "Mike030312", faction: "AH", country: "Spain" },
    { username: "MILITARYPRO123458", faction: "URF/RKA", country: "Pakistan" },
    { username: "mlo1050", faction: "CZSK", country: "Morocco" },
    { username: "MyNameIsBrickWall", faction: "DK", country: "United Kingdom" },
    { username: "nessa2008s", faction: "NDV", country: "Poland" },
    { username: "Ninbinsin", faction: "TWL", country: "Uzbekistan" },
    { username: "noah464", faction: "TWL", country: "USA" },
    { username: "OnlyToast0", faction: "AH", country: "United Kingdom" },
    { username: "polloxlikop0911", faction: "CZSK", country: "Spain" },
    { username: "Prehist0rick", faction: "CZSK", country: "Netherlands" },
    { username: "Quackenxnator", faction: "AH", country: "USA" },
    { username: "ramq124", faction: "N/A", country: "Korea" },
    { username: "rittwdvk", faction: "AH", country: "USA" },
    { username: "Ruukke666", faction: "AH", country: "Netherlands" },
    { username: "SAMOJEBEAST678", faction: "URF", country: "Slovakia" },
    { username: "Sonyah13", faction: "NDV", country: "Sweden" },
    { username: "stolemyxrp", faction: "AH", country: "United Kingdom" },
    { username: "Strango7", faction: "CZSK", country: "Italy" },
    { username: "SussyAmogusbals2", faction: "NDV", country: "Kazakhstan" },
    { username: "SwissAbyss1", faction: "TWL", country: "USA" },
    { username: "tamika2006s", faction: "NDV", country: "Sweden" },
    { username: "ThatRandomPerson142", faction: "RKA", country: "USA" },
    { username: "ThatThatRandomPerson142", faction: "RKA", country: "US" },
    { username: "Vespartan_alt", faction: "TWL", country: "Czechia" },
    { username: "vcfghcemil", faction: "CZSK", country: "Germany" },
    { username: "xxninjaxx9065", faction: "TWL", country: "United Kingdom" },
    { username: "kkevin789", faction: "AH", country: "USA" },
    { username: "Soliplismm", faction: "RKA", country: "Vietnam" }
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
const ADMIN_ORDER_STORAGE_KEY = 'draxar_admin_order_v1';
const ADMIN_LEVEL_STORAGE_KEY = 'draxar_admin_levels_v1';
const GLOBAL_ORDER_ENDPOINT = '/api/rankings/order';
let adminOrderDraft = [];
let adminDragIndex = null;
let adminSessionActive = false;
const editorDragState = {
    active: false,
    offsetX: 0,
    offsetY: 0
};

function createBootLoaderController() {
    const loader = document.getElementById('bootLoader');
    if (!loader) {
        return { complete: () => {} };
    }

    const statusNode = document.getElementById('bootLoaderStatus');
    const percentNode = document.getElementById('bootLoaderPercent');
    const barNode = document.getElementById('bootLoaderBar');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const steps = [
        { at: 0, text: 'Syncing ranked telemetry...' },
        { at: 20, text: 'Loading faction banners...' },
        { at: 45, text: 'Calibrating ranking systems...' },
        { at: 70, text: 'Preparing match overlays...' },
        { at: 90, text: 'Finalizing competitive feed...' }
    ];

    let progress = 0;
    let activeStep = 0;
    let isComplete = false;

    const paintProgress = (value) => {
        progress = Math.max(progress, Math.min(100, value));
        if (barNode) barNode.style.width = `${progress}%`;
        if (percentNode) percentNode.textContent = `${Math.round(progress)}%`;

        while (activeStep < steps.length - 1 && progress >= steps[activeStep + 1].at) {
            activeStep += 1;
        }
        if (statusNode) statusNode.textContent = steps[activeStep].text;
    };

    paintProgress(4);

    const timer = setInterval(() => {
        if (isComplete) return;
        const increment = progress < 70
            ? (6 + Math.random() * 8)
            : (2 + Math.random() * 4);
        paintProgress(Math.min(94, progress + increment));
    }, reducedMotion ? 80 : 120);

    return {
        complete(finalText = 'Arena online. Good luck.') {
            if (isComplete) return;
            isComplete = true;
            clearInterval(timer);
            if (statusNode) statusNode.textContent = finalText;
            paintProgress(100);

            setTimeout(() => {
                loader.classList.add('is-glitching');
                setTimeout(() => {
                    loader.classList.add('is-done');
                    document.body.classList.remove('is-loading');
                    setTimeout(() => loader.remove(), 420);
                }, reducedMotion ? 20 : 150);
            }, reducedMotion ? 80 : 240);
        }
    };
}

function showToast(title, detail, tone = 'queue') {
    const stack = document.getElementById('toastStack');
    if (!stack) return;

    const toast = document.createElement('div');
    const safeTone = ['win', 'loss', 'queue'].includes(tone) ? tone : 'queue';
    toast.className = `toast ${safeTone}`;
    toast.innerHTML = `<span class="toast-title">${title}</span><span class="toast-meta">${detail}</span>`;

    stack.prepend(toast);

    if (stack.children.length > 4) {
        stack.lastElementChild?.remove();
    }

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 240);
    }, 2800);
}

const matchPopupProfiles = {
    oneVOneWin: { tone: 'win', icon: '⚔', cue: 'match.win.1v1' },
    oneVOneLoss: { tone: 'loss', icon: '☠', cue: 'match.loss.1v1' },
    factionWin: { tone: 'win', icon: '▲', cue: 'match.win.faction' },
    factionLoss: { tone: 'loss', icon: '▼', cue: 'match.loss.faction' },
    queue: { tone: 'queue', icon: '◆', cue: 'queue.status' },
    queueStatus: { tone: 'queue', icon: '◉', cue: 'queue.status.update' },
    systemNotice: { tone: 'queue', icon: '⌁', cue: 'system.notice.general' },
    streakWin: { tone: 'win', icon: '🔥', cue: 'streak.win.update' },
    streakLoss: { tone: 'loss', icon: '❄', cue: 'streak.loss.update' }
};

function getMatchPopupProfile(profileName) {
    const safeName = typeof profileName === 'string' ? profileName.trim() : '';
    const selected = matchPopupProfiles[safeName] || matchPopupProfiles.queue;
    return { ...selected };
}

function setMatchPopupProfile(profileName, updates = {}) {
    const safeName = typeof profileName === 'string' ? profileName.trim() : '';
    if (!safeName || typeof updates !== 'object' || updates === null) return false;

    const base = matchPopupProfiles[safeName] || matchPopupProfiles.queue;
    matchPopupProfiles[safeName] = {
        ...base,
        ...updates
    };

    return true;
}

function emitSoundHook(cue, payload = {}) {
    if (!cue) return;

    const detail = { cue, ...payload, timestamp: Date.now() };
    document.dispatchEvent(new CustomEvent('draxar:sound-cue', { detail }));

    if (typeof window.onDraxarSoundCue === 'function') {
        window.onDraxarSoundCue(detail);
    }
}

function createSoundFxEngine() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let audioContext = null;
    let masterGain = null;
    let enabled = !prefersReducedMotion;

    const ensureContext = () => {
        if (audioContext) return audioContext;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;

        audioContext = new AudioCtx();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.12;
        masterGain.connect(audioContext.destination);
        return audioContext;
    };

    const unlock = () => {
        const ctx = ensureContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
    };

    const playTone = ({
        freqStart,
        freqEnd = freqStart,
        duration = 0.09,
        type = 'triangle',
        volume = 0.22,
        when = 0
    }) => {
        if (!enabled) return;
        const ctx = ensureContext();
        if (!ctx || !masterGain) return;

        const startAt = ctx.currentTime + when;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(50, freqStart), startAt);
        osc.frequency.exponentialRampToValueAtTime(Math.max(50, freqEnd), startAt + duration);

        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startAt);
        osc.stop(startAt + duration + 0.01);
    };

    const playCue = (cue = '') => {
        if (!enabled) return;
        unlock();

        if (cue.includes('match.win')) {
            playTone({ freqStart: 520, freqEnd: 640, duration: 0.09, type: 'triangle', volume: 0.23 });
            playTone({ freqStart: 660, freqEnd: 840, duration: 0.11, type: 'triangle', volume: 0.2, when: 0.085 });
            return;
        }

        if (cue.includes('match.loss')) {
            playTone({ freqStart: 430, freqEnd: 260, duration: 0.12, type: 'sawtooth', volume: 0.17 });
            playTone({ freqStart: 280, freqEnd: 170, duration: 0.13, type: 'triangle', volume: 0.15, when: 0.1 });
            return;
        }

        if (cue.includes('streak.win')) {
            playTone({ freqStart: 640, freqEnd: 760, duration: 0.08, type: 'triangle', volume: 0.2 });
            playTone({ freqStart: 820, freqEnd: 980, duration: 0.1, type: 'triangle', volume: 0.19, when: 0.075 });
            playTone({ freqStart: 1040, freqEnd: 1160, duration: 0.08, type: 'sine', volume: 0.13, when: 0.16 });
            return;
        }

        if (cue.includes('streak.loss')) {
            playTone({ freqStart: 380, freqEnd: 240, duration: 0.11, type: 'triangle', volume: 0.15 });
            return;
        }

        if (cue === 'ui.modal.player.open') {
            playTone({ freqStart: 580, freqEnd: 700, duration: 0.07, type: 'sine', volume: 0.14 });
            playTone({ freqStart: 920, freqEnd: 1060, duration: 0.08, type: 'triangle', volume: 0.1, when: 0.065 });
            return;
        }

        if (cue.includes('queue') || cue.includes('system.notice')) {
            playTone({ freqStart: 470, freqEnd: 520, duration: 0.07, type: 'sine', volume: 0.12 });
            return;
        }

        playTone({ freqStart: 500, freqEnd: 560, duration: 0.07, type: 'triangle', volume: 0.11 });
    };

    const onSoundCue = (event) => {
        const cue = event?.detail?.cue || '';
        playCue(cue);
    };

    const unlockEvents = ['pointerdown', 'keydown', 'touchstart'];
    unlockEvents.forEach((eventName) => {
        window.addEventListener(eventName, unlock, { passive: true });
    });

    document.addEventListener('draxar:sound-cue', onSoundCue);

    return {
        playCue,
        enable() {
            enabled = true;
            unlock();
        },
        disable() {
            enabled = false;
        },
        setVolume(value) {
            if (!masterGain) ensureContext();
            if (!masterGain) return;
            const safeVolume = Math.max(0, Math.min(1, Number(value) || 0));
            masterGain.gain.value = safeVolume;
        },
        isEnabled() {
            return enabled;
        }
    };
}

const soundFx = createSoundFxEngine();
window.soundFx = soundFx;

function showMatchResultPopup({ title, detail, tone = 'queue', icon = 'i', cue = '', profileName = '', soundPayload = {} }) {
    const profile = profileName ? getMatchPopupProfile(profileName) : null;
    const resolvedTone = profile?.tone || tone;
    const resolvedIcon = profile?.icon || icon;
    const resolvedCue = profile?.cue || cue;

    const stack = document.getElementById('matchResultStack');
    if (!stack) {
        showToast(title, detail, resolvedTone);
        emitSoundHook(resolvedCue, soundPayload);
        return;
    }

    const popup = document.createElement('article');
    const safeTone = ['win', 'loss', 'queue'].includes(resolvedTone) ? resolvedTone : 'queue';
    popup.className = `match-popup ${safeTone}`;
    popup.innerHTML = `
        <span class="match-popup-icon" aria-hidden="true">${resolvedIcon}</span>
        <div class="match-popup-copy">
            <strong>${title}</strong>
            <span>${detail}</span>
        </div>
    `;

    stack.prepend(popup);

    if (stack.children.length > 3) {
        stack.lastElementChild?.remove();
    }

    emitSoundHook(resolvedCue, soundPayload);

    setTimeout(() => {
        popup.classList.add('hide');
        setTimeout(() => popup.remove(), 260);
    }, 3000);
}

function notifyWithProfile(profileName, title, detail, soundPayload = {}) {
    showMatchResultPopup({
        title,
        detail,
        profileName,
        soundPayload
    });
}

function getRevealTargetsForView(viewName, viewEl) {
    const selectors = {
        leaderboard: ['.page-header', '.podium-wrap', '.leaderboard'],
        elo: ['.page-header', '.elo-system-header', '.elo-card'],
        matches: ['.page-header', '.faction-ranking-board', '.match-card']
    };

    const configured = selectors[viewName] || [];
    if (configured.length) {
        const matches = configured
            .flatMap((selector) => Array.from(viewEl.querySelectorAll(selector)))
            .filter((item, index, list) => list.indexOf(item) === index);
        if (matches.length) {
            return matches;
        }
    }

    return Array.from(viewEl.children);
}

function runCinematicSectionReveal(viewName) {
    const targetView = document.getElementById(`${viewName}-view`);
    if (!targetView) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = getRevealTargetsForView(viewName, targetView);

    targetView.classList.remove('cinematic-ready', 'cinematic-run');
    targets.forEach((item) => {
        item.classList.remove('cinematic-item');
        item.style.removeProperty('--cinematic-delay');
    });

    if (!targets.length) return;

    targetView.classList.add('cinematic-ready');
    targets.forEach((item, index) => {
        item.classList.add('cinematic-item');
        item.style.setProperty('--cinematic-delay', `${reducedMotion ? 0 : Math.min(index * 95, 420)}ms`);
    });

    requestAnimationFrame(() => {
        targetView.classList.add('cinematic-run');
    });
}

function normalizeCountry(country) {
    const rawValue = (country || 'N/A').trim();
    const key = rawValue
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const countryAliases = {
        'uk': 'United Kingdom',
        'united kingdom': 'United Kingdom',
        'great britain': 'United Kingdom',
        'britain': 'United Kingdom',
        'us': 'USA',
        'usa': 'USA',
        'united states': 'USA',
        'united states of america': 'USA',
        'america': 'USA'
    };

    return countryAliases[key] || rawValue;
}

playerData.forEach((player) => {
    player.country = normalizeCountry(player.country);
});

const seededPerformanceOverrides = {
    // 2 wins vs same-level opponents: 2 * +500 ELO
    '20SovietSO21': { eloDelta: 1000, wins: 2, losses: 0 }
};

function normalizeLevelValue(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(10, parsed));
}

const UNRATED_DEFAULT_LEVEL = 5;

function defaultLevelForRank(rank) {
    if (rank < 1 || rank > 10) return UNRATED_DEFAULT_LEVEL;
    return Math.max(1, 11 - rank);
}

function buildRankingsFromPlayerData(previousRankings = []) {
    const previousByUsername = new Map((previousRankings || []).map((player) => [player.username, player]));

    return playerData.map((player, index) => {
        const seeded = seededPerformanceOverrides[player.username] || { eloDelta: 0, wins: 0, losses: 0 };
        const seededElo = Math.max(0, ELO_DEFAULT + seeded.eloDelta);
        const existing = previousByUsername.get(player.username);
        const rank = index + 1;

        const safeElo = Number.isFinite(existing?.elo) ? Math.max(0, existing.elo) : seededElo;
        const safeWins = Number.isFinite(existing?.wins) ? Math.max(0, existing.wins) : seeded.wins;
        const safeLosses = Number.isFinite(existing?.losses) ? Math.max(0, existing.losses) : seeded.losses;
        const storedPlayerLevel = normalizeLevelValue(player?.level);
        const existingLevel = normalizeLevelValue(existing?.level);
        const levelCandidate = existingLevel || storedPlayerLevel || defaultLevelForRank(rank);
        const safeLevel = levelCandidate || defaultLevelForRank(rank);

        player.level = safeLevel;

        return {
            rank,
            previousRank: Number.isFinite(existing?.rank) ? existing.rank : rank,
            rankChange: 0,
            username: player.username,
            faction: player.faction,
            country: player.country,
            addedOrder: rank,
            isNew: index >= playerData.length - 8,
            level: safeLevel,
            elo: safeElo,
            wins: safeWins,
            losses: safeLosses,
            trend: 'neutral'
        };
    });
}

// Initialize player rankings
let playerRankings = buildRankingsFromPlayerData();

// Normalize initial ranking metadata
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
    'United Kingdom': '🇬🇧',
    'England': '🇬🇧',
    'Netherlands': '🇳🇱',
    'USA': '🇺🇸',
    'Kazakhstan': '🇰🇿',
    'Germany': '🇩🇪',
    'Italy': '🇮🇹',
    'Korea': '🇰🇷',
    'Morocco': '🇲🇦',
    'North America': '🌎',
    'Pakistan': '🇵🇰',
    'Scotland': '🏴',
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
    'URF': 'faction_flags/URF.png',
    'AH/URF': 'faction_flags/URF.png',
    'URF/RKA': 'faction_flags/URF.png',
    'FLASH': 'faction_flags/DK.png',
    'N/A': ''
};

function getFactionFlag(faction) {
    const normalizedFaction = (faction || '').toUpperCase().trim();
    if (!normalizedFaction) return '';

    if (factionImages[normalizedFaction]) {
        return factionImages[normalizedFaction];
    }

    if (normalizedFaction.includes('URF')) {
        return factionImages.URF;
    }

    const firstToken = normalizedFaction.split(/[\s,/|]+/).find(Boolean);
    return firstToken ? (factionImages[firstToken] || '') : '';
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    const bootLoader = createBootLoaderController();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startupView = window.location.hash === '#matches' ? 'matches' : 'leaderboard';

    await applyInitialRankingOrder();
    populateFilters();
    renderLeaderboard(playerRankings);
    updateQuickStats(playerRankings.length);
    switchView(startupView);
    
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

    initializePlayerModalFx();
    initializeMovableEditor();

    setTimeout(() => {
        bootLoader.complete();

        setTimeout(() => {
            runCinematicSectionReveal(startupView);
            notifyWithProfile('queueStatus', 'Ranked Queue', 'Status: Open and matching players', { status: 'open' });
            notifyWithProfile(
                'systemNotice',
                'Ranking Update',
                'ELO has been removed because the ratio between active and offline players is too high. Staff will now judge players.'
            );
            notifyWithProfile(
                'systemNotice',
                'Roster Update',
                'crimsvonn has been removed from the rankings after quitting the game.'
            );
        }, reducedMotion ? 0 : 210);
    }, reducedMotion ? 160 : 900);
});

// Populate filter dropdowns
function populateFilters() {
    const factionFilter = document.getElementById('factionFilter');
    const countryFilter = document.getElementById('countryFilter');
    if (!factionFilter || !countryFilter) return;

    factionFilter.innerHTML = '<option value="">All Factions</option>';
    countryFilter.innerHTML = '<option value="">All Countries</option>';

    const factions = [...new Set(playerData.map(p => p.faction))].sort();
    const countries = [...new Set(playerData.map(p => p.country))].sort();
    
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
        const displayLevel = normalizeLevelValue(player.level) || defaultLevelForRank(player.rank);
        const hasLevel = displayLevel > 0;
        const leftColumnLevel = hasLevel ? displayLevel : UNRATED_DEFAULT_LEVEL;
        const levelMarkup = hasLevel
            ? `
                <span class="level-badge">
                    <img src="${displayLevel}.png" alt="Level ${displayLevel}" class="level-img" onerror="this.style.display='none'">
                    Lvl ${displayLevel}
                </span>
            `
            : `<span class="level-badge">Lvl ${UNRATED_DEFAULT_LEVEL}</span>`;
        
        row.innerHTML = `
            <div class="rank">${leftColumnLevel}</div>
            <div class="player-info">
                <div class="player-avatar">${player.username.charAt(0).toUpperCase()}</div>
                <div class="player-name">
                    <strong>${player.username}</strong>
                    <small>${factionDisplay}${factionDisplay ? ' ' : ''}${player.faction}</small>
                    ${badges ? `<div class="player-badges">${badges}</div>` : ''}
                </div>
            </div>
            <div class="stats-row">
                <div class="stat">${levelMarkup}</div>
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

    const top = players.slice(0, 3);

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
                    <div class="podium-player-card">
                        <div class="podium-crown">OPEN</div>
                        <strong>Awaiting contender</strong>
                        <small>Climb the ladder to claim this spot</small>
                    </div>
                    <div class="podium-step step-${place}">#${place}</div>
                </div>
            `;
        }

        const factionImg = getFactionFlag(player.faction);
        const factionDisplay = factionImg ? `<img src="${factionImg}" alt="${player.faction}" class="faction-flag">` : '';
        const medal = place === 1 ? 'GOLD' : place === 2 ? 'SILVER' : 'BRONZE';
        const medalIcon = place === 1 ? '★' : place === 2 ? '◆' : '▲';
        const rankShift = player.rankChange > 0
            ? `+${player.rankChange}`
            : player.rankChange < 0
                ? `${player.rankChange}`
                : '0';
        const rankShiftClass = player.rankChange > 0 ? 'up' : player.rankChange < 0 ? 'down' : 'steady';
        const podiumLevel = normalizeLevelValue(player.level) || defaultLevelForRank(place);
        const badges = getPlayerBadges(player).slice(0, 1)
            .map((badge) => `<span class="player-badge badge-${badge.toLowerCase().replace(/\s+/g, '-')}">${badge}</span>`)
            .join('');

        return `
            <div class="podium-slot slot-${place}" data-username="${player.username}">
                <div class="podium-player-card">
                    <div class="podium-crown"><span>${medal}</span><span class="podium-medal-icon">${medalIcon}</span></div>
                    <strong>${player.username}</strong>
                    <small>${factionDisplay}${factionDisplay ? ' ' : ''}${player.faction}</small>
                    <span>${getCountryEmoji(player.country)} ${player.country}</span>
                    <div class="podium-meta-row">
                        <span class="podium-level">Lvl ${podiumLevel}</span>
                        <span class="podium-record">${player.wins}W-${player.losses}L</span>
                    </div>
                    ${badges}
                </div>
                <div class="podium-step step-${place}">
                    <div class="podium-place">#${place}</div>
                    <div class="podium-elo">Lvl ${podiumLevel}</div>
                    <div class="podium-rank-delta ${rankShiftClass}">${rankShift}</div>
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

    if (mode !== 'all') {
        notifyWithProfile('systemNotice', 'Filter Updated', `Mode: ${mode.replace('-', ' ')}`, { mode });
    }
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
    
    playerRankings.forEach((player, index) => {
        const newRank = index + 1;
        const oldRank = previousRanks.get(player.username) || newRank;
        player.previousRank = oldRank;
        player.rank = newRank;
        player.rankChange = oldRank - newRank;
        player.trend = player.rankChange > 0 ? 'up' : player.rankChange < 0 ? 'down' : 'neutral';
        player.level = normalizeLevelValue(player.level) || defaultLevelForRank(newRank);
    });

    const rankingByUsername = new Map(playerRankings.map((player) => [player.username, player]));
    playerData.forEach((player) => {
        const ranking = rankingByUsername.get(player.username);
        if (ranking) {
            player.level = ranking.level;
        }
    });
}

function resetFiltersForFreshData() {
    quickFilterMode = 'all';

    const searchInput = document.getElementById('searchInput');
    const factionFilter = document.getElementById('factionFilter');
    const countryFilter = document.getElementById('countryFilter');

    if (searchInput) searchInput.value = '';
    if (factionFilter) factionFilter.value = '';
    if (countryFilter) countryFilter.value = '';

    document.querySelectorAll('.quick-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.chip === 'all');
    });
}

function setEditorStatus(message, tone = 'neutral') {
    const statusNode = document.getElementById('editorStatus');
    if (!statusNode) return;

    statusNode.textContent = message;
    statusNode.classList.remove('success', 'error');
    if (tone === 'success') statusNode.classList.add('success');
    if (tone === 'error') statusNode.classList.add('error');
}

function createAdminOrderDraft() {
    return playerRankings.map((player) => ({
        username: player.username,
        faction: player.faction,
        country: player.country,
        level: normalizeLevelValue(player.level) || defaultLevelForRank(player.rank)
    }));
}

function getStoredAdminOrder() {
    try {
        const raw = localStorage.getItem(ADMIN_ORDER_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
    } catch {
        return [];
    }
}

function storeAdminOrder(usernames) {
    try {
        localStorage.setItem(ADMIN_ORDER_STORAGE_KEY, JSON.stringify(usernames));
    } catch {
        // Ignore storage failures in private modes.
    }
}

function getStoredAdminLevels() {
    try {
        const raw = localStorage.getItem(ADMIN_LEVEL_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

        const sanitized = {};
        Object.entries(parsed).forEach(([username, value]) => {
            const safeName = String(username || '').trim();
            if (!safeName) return;
            const safeLevel = normalizeLevelValue(value);
            if (safeLevel > 0) {
                sanitized[safeName] = safeLevel;
            }
        });

        return sanitized;
    } catch {
        return {};
    }
}

function storeAdminLevels(levelsByUsername) {
    const safeLevels = {};
    if (levelsByUsername && typeof levelsByUsername === 'object' && !Array.isArray(levelsByUsername)) {
        Object.entries(levelsByUsername).forEach(([username, value]) => {
            const safeName = String(username || '').trim();
            if (!safeName) return;
            const safeLevel = normalizeLevelValue(value);
            if (safeLevel > 0) {
                safeLevels[safeName] = safeLevel;
            }
        });
    }

    try {
        localStorage.setItem(ADMIN_LEVEL_STORAGE_KEY, JSON.stringify(safeLevels));
    } catch {
        // Ignore storage failures in private modes.
    }
}

function sanitizeLevelMap(levelsByUsername) {
    const safeLevels = {};
    if (!levelsByUsername || typeof levelsByUsername !== 'object' || Array.isArray(levelsByUsername)) {
        return safeLevels;
    }

    Object.entries(levelsByUsername).forEach(([username, value]) => {
        const safeName = String(username || '').trim();
        if (!safeName) return;
        const safeLevel = normalizeLevelValue(value);
        if (safeLevel > 0) {
            safeLevels[safeName] = safeLevel;
        }
    });

    return safeLevels;
}

function createLevelMapFromAdminDraft() {
    const levels = {};

    adminOrderDraft.forEach((entry, index) => {
        const fallbackLevel = defaultLevelForRank(index + 1);
        const safeLevel = normalizeLevelValue(entry.level) || fallbackLevel;
        levels[entry.username] = safeLevel;
    });

    return levels;
}

function normalizeAdminDraftLevels() {
    adminOrderDraft.forEach((entry, index) => {
        const fallbackLevel = defaultLevelForRank(index + 1);
        entry.level = normalizeLevelValue(entry.level) || fallbackLevel;
    });
}

function applyManualPlayerOrder(usernames, { persist = true, refresh = true, levelsByUsername = {} } = {}) {
    const rankingByUsername = new Map(playerRankings.map((player) => [player.username, player]));
    const dataByUsername = new Map(playerData.map((player) => [player.username, player]));
    const availableUsernames = playerRankings.map((player) => player.username);
    const availableSet = new Set(availableUsernames);
    const seen = new Set();
    const orderedUsernames = [];

    usernames.forEach((username) => {
        if (!availableSet.has(username) || seen.has(username)) return;
        seen.add(username);
        orderedUsernames.push(username);
    });

    availableUsernames.forEach((username) => {
        if (seen.has(username)) return;
        seen.add(username);
        orderedUsernames.push(username);
    });

    playerRankings = orderedUsernames
        .map((username) => rankingByUsername.get(username))
        .filter(Boolean);

    const reorderedPlayers = orderedUsernames
        .map((username) => dataByUsername.get(username))
        .filter(Boolean);
    playerData.splice(0, playerData.length, ...reorderedPlayers);

    const safeLevels = sanitizeLevelMap(levelsByUsername);

    playerRankings.forEach((player, index) => {
        const rank = index + 1;
        player.rank = rank;
        player.previousRank = rank;
        player.rankChange = 0;
        player.trend = 'neutral';
        player.addedOrder = rank;

        const fallbackLevel = defaultLevelForRank(rank);
        const existingLevel = normalizeLevelValue(player.level);
        const selectedLevel = normalizeLevelValue(safeLevels[player.username]);
        const nextLevel = selectedLevel || existingLevel || fallbackLevel;

        player.level = nextLevel;
        const source = dataByUsername.get(player.username);
        if (source) source.level = nextLevel;
    });

    if (persist) {
        storeAdminOrder(orderedUsernames);
        const levelsToStore = {};
        playerRankings.forEach((player) => {
            const safeLevel = normalizeLevelValue(player.level);
            if (safeLevel > 0) {
                levelsToStore[player.username] = safeLevel;
            }
        });
        storeAdminLevels(levelsToStore);
    }

    if (refresh) {
        populateFilters();
        resetFiltersForFreshData();
        renderLeaderboard(playerRankings);
        updateQuickStats(playerRankings.length);
    }

    return orderedUsernames;
}

async function applyInitialRankingOrder() {
    const globalResult = await adminRequest(GLOBAL_ORDER_ENDPOINT, { method: 'GET' });
    const globalOrder = Array.isArray(globalResult?.payload?.order) ? globalResult.payload.order : [];
    const globalLevels = sanitizeLevelMap(globalResult?.payload?.levels);

    if (globalResult.ok && globalOrder.length) {
        applyManualPlayerOrder(globalOrder, { persist: true, refresh: false, levelsByUsername: globalLevels });
        return;
    }

    const storedOrder = getStoredAdminOrder();
    const storedLevels = getStoredAdminLevels();
    if (!storedOrder.length) return;
    applyManualPlayerOrder(storedOrder, { persist: false, refresh: false, levelsByUsername: storedLevels });
}

function moveAdminDraftPlayer(fromIndex, toIndex) {
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= adminOrderDraft.length || toIndex >= adminOrderDraft.length) return;
    if (fromIndex === toIndex) return;

    const [entry] = adminOrderDraft.splice(fromIndex, 1);
    adminOrderDraft.splice(toIndex, 0, entry);
}

function renderAdminPlayerList(listNode) {
    if (!listNode) return;
    normalizeAdminDraftLevels();
    listNode.innerHTML = '';

    adminOrderDraft.forEach((player, index) => {
        const item = document.createElement('li');
        item.className = 'admin-player-item';
        item.draggable = true;
        item.dataset.index = String(index);

        const main = document.createElement('div');
        main.className = 'admin-player-main';

        const rank = document.createElement('span');
        rank.className = 'admin-player-rank';
        rank.textContent = `#${index + 1}`;

        const meta = document.createElement('div');
        meta.className = 'admin-player-meta';

        const username = document.createElement('strong');
        username.textContent = player.username;

        const details = document.createElement('small');
        details.textContent = `${player.faction} | ${player.country}`;

        meta.appendChild(username);
        meta.appendChild(details);

        main.appendChild(rank);
        main.appendChild(meta);

        const controls = document.createElement('div');
        controls.className = 'admin-player-move';

        const levelSelect = document.createElement('select');
        levelSelect.className = 'admin-level-select';
        levelSelect.dataset.levelIndex = String(index);

        for (let level = 1; level <= 10; level += 1) {
            const option = document.createElement('option');
            option.value = String(level);
            option.textContent = `Lvl ${level}`;
            levelSelect.appendChild(option);
        }

        levelSelect.value = String(normalizeLevelValue(player.level) || defaultLevelForRank(index + 1));

        controls.appendChild(levelSelect);

        const upButton = document.createElement('button');
        upButton.type = 'button';
        upButton.className = 'editor-action-btn';
        upButton.textContent = 'Up';
        upButton.dataset.move = 'up';
        upButton.dataset.index = String(index);
        upButton.disabled = index === 0;

        const downButton = document.createElement('button');
        downButton.type = 'button';
        downButton.className = 'editor-action-btn';
        downButton.textContent = 'Down';
        downButton.dataset.move = 'down';
        downButton.dataset.index = String(index);
        downButton.disabled = index === adminOrderDraft.length - 1;

        controls.appendChild(upButton);
        controls.appendChild(downButton);

        item.appendChild(main);
        item.appendChild(controls);

        item.addEventListener('dragstart', (event) => {
            adminDragIndex = index;
            event.dataTransfer.effectAllowed = 'move';
            item.classList.add('dragging-item');
        });

        item.addEventListener('dragover', (event) => {
            event.preventDefault();
            item.classList.add('drag-over');
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (event) => {
            event.preventDefault();
            item.classList.remove('drag-over');

            if (adminDragIndex === null) return;
            moveAdminDraftPlayer(adminDragIndex, index);
            adminDragIndex = null;
            renderAdminPlayerList(listNode);
        });

        item.addEventListener('dragend', () => {
            adminDragIndex = null;
            listNode.querySelectorAll('.admin-player-item').forEach((node) => {
                node.classList.remove('drag-over', 'dragging-item');
            });
        });

        listNode.appendChild(item);
    });
}

async function adminRequest(path, { method = 'GET', body } = {}) {
    const options = {
        method,
        credentials: 'include',
        headers: {},
    };

    if (body !== undefined) {
        options.body = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(path, options);
        let payload = {};
        try {
            payload = await response.json();
        } catch {
            payload = {};
        }

        return { ok: response.ok, status: response.status, payload };
    } catch {
        return { ok: false, status: 0, payload: { error: 'Network error' } };
    }
}

function clampEditorPosition(panel, left, top) {
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - panel.offsetHeight - margin);

    return {
        left: Math.min(Math.max(margin, left), maxLeft),
        top: Math.min(Math.max(margin, top), maxTop)
    };
}

function initializeMovableEditor() {
    const panel = document.getElementById('movableEditor');
    const handle = document.getElementById('movableEditorHandle');
    const toggle = document.getElementById('editorToggle');
    const close = document.getElementById('editorClose');
    const authBlock = document.getElementById('adminAuthBlock');
    const controls = document.getElementById('adminControls');
    const passwordInput = document.getElementById('adminPasswordInput');
    const loginButton = document.getElementById('adminLoginBtn');
    const logoutButton = document.getElementById('adminLogout');
    const applyOrderButton = document.getElementById('adminApplyOrder');
    const resetOrderButton = document.getElementById('adminResetOrder');
    const listNode = document.getElementById('adminPlayerList');
    const logoImage = document.querySelector('.logo-image');
    const SECRET_ADMIN_SEQUENCE = 'draxaradmin';
    let typedSequence = '';
    let logoTapCount = 0;
    let logoTapTimer = null;
    let logoLongPressTimer = null;
    let logoLongPressTriggered = false;

    if (!panel || !handle || !toggle || !close || !authBlock || !controls || !passwordInput || !loginButton || !logoutButton || !applyOrderButton || !resetOrderButton || !listNode) return;

    const setAuthView = (isAuthenticated) => {
        adminSessionActive = isAuthenticated;
        authBlock.hidden = isAuthenticated;
        controls.hidden = !isAuthenticated;
        logoutButton.hidden = !isAuthenticated;
    };

    const refreshDraftFromRankings = () => {
        adminOrderDraft = createAdminOrderDraft();
        renderAdminPlayerList(listNode);
    };

    const refreshAuthState = async () => {
        const result = await adminRequest('/api/admin/session', { method: 'GET' });
        const isAuthenticated = Boolean(result.ok && result.payload && result.payload.authenticated === true);
        setAuthView(isAuthenticated);
        return isAuthenticated;
    };

    const syncPanelViewportMode = () => {
        const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
        panel.classList.toggle('mobile-open', isMobileViewport);

        if (isMobileViewport) {
            panel.style.left = '';
            panel.style.top = '';
            panel.style.right = '';
        }
    };

    const openPanel = async () => {
        syncPanelViewportMode();
        panel.classList.add('active');
        panel.setAttribute('aria-hidden', 'false');
        toggle.classList.add('active');

        setEditorStatus('Checking admin session...');
        const authenticated = await refreshAuthState();
        if (authenticated) {
            refreshDraftFromRankings();
            setEditorStatus('Admin unlocked. Reorder players and edit levels for all players.', 'success');
        } else {
            setEditorStatus('Locked: enter admin password.', 'error');
            passwordInput.focus();
        }
    };

    const closePanel = () => {
        panel.classList.remove('active', 'dragging');
        panel.setAttribute('aria-hidden', 'true');
        toggle.classList.remove('active');
    };

    const togglePanel = async () => {
        if (panel.classList.contains('active')) {
            closePanel();
        } else {
            await openPanel();
        }
    };

    const shouldIgnoreSecretKeyEvent = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return false;

        const tagName = target.tagName;
        return target.isContentEditable
            || tagName === 'INPUT'
            || tagName === 'TEXTAREA'
            || tagName === 'SELECT';
    };

    toggle.addEventListener('click', async () => {
        await togglePanel();
    });

    close.addEventListener('click', closePanel);

    loginButton.addEventListener('click', async () => {
        const password = passwordInput.value;
        if (!password) {
            setEditorStatus('Password is required.', 'error');
            return;
        }

        setEditorStatus('Signing in...');
        const result = await adminRequest('/api/admin/login', {
            method: 'POST',
            body: { password }
        });

        if (!result.ok) {
            const message = result.payload?.error || 'Access denied.';
            setEditorStatus(message, 'error');
            return;
        }

        passwordInput.value = '';
        setAuthView(true);
        refreshDraftFromRankings();
        setEditorStatus('Admin unlocked. You can reorder players and edit levels for all players.', 'success');
    });

    passwordInput.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        loginButton.click();
    });

    logoutButton.addEventListener('click', async () => {
        await adminRequest('/api/admin/logout', { method: 'POST' });
        setAuthView(false);
        setEditorStatus('Logged out. Admin panel is locked.', 'error');
    });

    listNode.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const button = target.closest('button[data-move]');
        if (!button) return;

        const index = Number.parseInt(button.dataset.index || '-1', 10);
        const direction = button.dataset.move;
        if (direction === 'up') {
            moveAdminDraftPlayer(index, index - 1);
        } else if (direction === 'down') {
            moveAdminDraftPlayer(index, index + 1);
        }

        renderAdminPlayerList(listNode);
    });

    listNode.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;

        const index = Number.parseInt(target.dataset.levelIndex || '-1', 10);
        if (!Number.isInteger(index) || index < 0 || index >= adminOrderDraft.length) return;

        adminOrderDraft[index].level = normalizeLevelValue(target.value) || defaultLevelForRank(index + 1);
    });

    applyOrderButton.addEventListener('click', async () => {
        if (!adminSessionActive) {
            setEditorStatus('Login required before applying order.', 'error');
            return;
        }

        normalizeAdminDraftLevels();
        const orderedUsernames = adminOrderDraft.map((entry) => entry.username);
        const levelMap = createLevelMapFromAdminDraft();
        setEditorStatus('Saving global ranking...');

        const saveResult = await adminRequest('/api/admin/ranking-order', {
            method: 'PUT',
            body: { order: orderedUsernames, levels: levelMap }
        });

        if (!saveResult.ok) {
            const canFallbackLocal = saveResult.status === 0 || saveResult.status === 404;

            if (canFallbackLocal) {
                applyManualPlayerOrder(orderedUsernames, { persist: true, refresh: true, levelsByUsername: levelMap });
                refreshDraftFromRankings();
                setEditorStatus('Global sync unavailable. Saved locally only on this device.', 'error');
                showToast('Admin Update', 'Saved locally only.', 'loss');
                return;
            }

            const errorMessage = saveResult.payload?.error || 'Failed to save global ranking order.';
            setEditorStatus(errorMessage, 'error');
            return;
        }

        applyManualPlayerOrder(orderedUsernames, { persist: true, refresh: true, levelsByUsername: levelMap });
        refreshDraftFromRankings();
        setEditorStatus('Global order and levels saved. It will sync across devices.', 'success');
        showToast('Admin Update', 'Global ranking updated.', 'queue');
    });

    resetOrderButton.addEventListener('click', () => {
        if (!adminSessionActive) return;
        refreshDraftFromRankings();
        setEditorStatus('List reset to current leaderboard order.', 'success');
    });

    document.addEventListener('keydown', async (event) => {
        if (shouldIgnoreSecretKeyEvent(event)) return;

        const key = String(event.key || '').toLowerCase();
        if (event.ctrlKey && event.shiftKey && key === 'a') {
            event.preventDefault();
            await togglePanel();
            return;
        }

        if (event.altKey || event.ctrlKey || event.metaKey || key.length !== 1) return;

        typedSequence = (typedSequence + key).slice(-SECRET_ADMIN_SEQUENCE.length);
        if (typedSequence === SECRET_ADMIN_SEQUENCE) {
            typedSequence = '';
            await togglePanel();
        }
    });

    if (logoImage) {
        const resetLogoTapTimer = () => {
            if (logoTapTimer) {
                clearTimeout(logoTapTimer);
                logoTapTimer = null;
            }
        };

        const registerLogoTap = async () => {
            logoTapCount += 1;

            resetLogoTapTimer();

            logoTapTimer = setTimeout(() => {
                logoTapCount = 0;
            }, 1800);

            if (logoTapCount >= 5) {
                logoTapCount = 0;
                resetLogoTapTimer();
                await togglePanel();
            }
        };

        const clearLogoLongPressTimer = () => {
            if (!logoLongPressTimer) return;
            clearTimeout(logoLongPressTimer);
            logoLongPressTimer = null;
        };

        logoImage.addEventListener('pointerdown', (event) => {
            if (event.pointerType !== 'touch') return;
            logoLongPressTriggered = false;
            clearLogoLongPressTimer();
            logoLongPressTimer = setTimeout(async () => {
                logoLongPressTriggered = true;
                logoTapCount = 0;
                resetLogoTapTimer();
                await togglePanel();
            }, 800);
        });

        logoImage.addEventListener('pointerup', async (event) => {
            if (event.pointerType === 'touch') {
                clearLogoLongPressTimer();
                if (logoLongPressTriggered) {
                    logoLongPressTriggered = false;
                    return;
                }
            }

            await registerLogoTap();
        });

        logoImage.addEventListener('pointercancel', () => {
            clearLogoLongPressTimer();
            logoLongPressTriggered = false;
        });

        logoImage.addEventListener('pointerleave', () => {
            clearLogoLongPressTimer();
        });
    }

    handle.addEventListener('pointerdown', (event) => {
        if (!panel.classList.contains('active')) return;
        if (panel.classList.contains('mobile-open')) return;
        if (event.target instanceof HTMLElement && event.target.closest('button')) return;

        editorDragState.active = true;
        const rect = panel.getBoundingClientRect();
        editorDragState.offsetX = event.clientX - rect.left;
        editorDragState.offsetY = event.clientY - rect.top;
        panel.classList.add('dragging');
        panel.style.left = `${rect.left}px`;
        panel.style.top = `${rect.top}px`;
        panel.style.right = 'auto';

        handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener('pointermove', (event) => {
        if (!editorDragState.active) return;
        const nextLeft = event.clientX - editorDragState.offsetX;
        const nextTop = event.clientY - editorDragState.offsetY;
        const clamped = clampEditorPosition(panel, nextLeft, nextTop);
        panel.style.left = `${clamped.left}px`;
        panel.style.top = `${clamped.top}px`;
    });

    handle.addEventListener('pointerup', (event) => {
        if (!editorDragState.active) return;
        editorDragState.active = false;
        panel.classList.remove('dragging');
        handle.releasePointerCapture(event.pointerId);
    });

    handle.addEventListener('pointercancel', () => {
        editorDragState.active = false;
        panel.classList.remove('dragging');
    });

    window.addEventListener('resize', () => {
        syncPanelViewportMode();
        if (!panel.classList.contains('active')) return;
        if (panel.classList.contains('mobile-open')) return;
        if (!panel.style.left || !panel.style.top) return;

        const left = Number.parseFloat(panel.style.left);
        const top = Number.parseFloat(panel.style.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return;

        const clamped = clampEditorPosition(panel, left, top);
        panel.style.left = `${clamped.left}px`;
        panel.style.top = `${clamped.top}px`;
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && panel.classList.contains('active')) {
            closePanel();
        }
    });

    syncPanelViewportMode();
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

    showMatchResultPopup({
        title: `1v1 Result: ${winner.username} won`,
        detail: `${winner.username} +${winnerDelta} ELO | ${loser.username} ${loserDelta} ELO`,
        profileName: 'oneVOneWin',
        soundPayload: { winner: winner.username, loser: loser.username }
    });

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

    showMatchResultPopup({
        title: 'Faction Battle Update',
        detail: `${player.username} ${delta >= 0 ? '+' : ''}${delta} ELO (${mappedTier})`,
        profileName: delta >= 0 ? 'factionWin' : 'factionLoss',
        soundPayload: { username: player.username, delta, tier: mappedTier }
    });

    return { username: player.username, delta, elo: player.elo, level: player.level };
}

// Expose ELO engine for future admin tooling or console usage.
window.eloSystem = {
    ELO_RULES,
    getLevelFromElo,
    apply1v1Result,
    applyFactionBattleResult,
    getRankings: () => [...playerRankings],
    notify: (title, detail) => notifyWithProfile('systemNotice', title, detail),
    queueStatus: (status) => notifyWithProfile('queueStatus', 'Queue Status', status, { status }),
    streakUpdate: (username, streakCount) => {
        const count = Number(streakCount) || 0;
        const profileName = count >= 0 ? 'streakWin' : 'streakLoss';
        const label = count >= 0 ? `+${count}` : `${count}`;
        notifyWithProfile(profileName, 'Streak Update', `${username} ${label} momentum`, { username, streakCount: count });
    }
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
    runCinematicSectionReveal(viewName);
    
    if (event && event.target && event.target.classList) {
        event.target.classList.add('active');
        return;
    }

    const matchingLink = document.querySelector(`.nav-link[href="#${viewName}"]`);
    if (matchingLink) {
        matchingLink.classList.add('active');
    }
}

function getPlayerTierLabel(player) {
    if (player.rank === 1) return 'Champion';
    if (player.rank <= 3) return 'Podium';
    if (player.rank <= 10) return 'Contender';
    const level = normalizeLevelValue(player.level);
    if (level >= 7) return 'Elite';
    if (level >= 4) return 'Veteran';
    return 'Unrated';
}

function getPlayerModalMoodClass(player) {
    if (player.rank === 1) return 'modal-elite';
    if (player.trend === 'up') return 'modal-rising';
    if (player.trend === 'down') return 'modal-falling';
    return 'modal-steady';
}

function animateModalNumber(node, targetValue, { prefix = '', suffix = '', duration = 440 } = {}) {
    if (!node) return;

    const endValue = Number(targetValue);
    if (!Number.isFinite(endValue)) {
        node.textContent = `${prefix}${targetValue}${suffix}`;
        return;
    }

    const startValue = Number(node.dataset.lastValue || 0);
    const delta = endValue - startValue;

    if (Math.abs(delta) < 1) {
        node.textContent = `${prefix}${Math.round(endValue)}${suffix}`;
        node.dataset.lastValue = String(endValue);
        return;
    }

    const startTime = performance.now();
    const animate = (now) => {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (delta * eased);
        node.textContent = `${prefix}${Math.round(current)}${suffix}`;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            node.dataset.lastValue = String(endValue);
        }
    };

    requestAnimationFrame(animate);
}

function resetModalMotion(content) {
    if (!content) return;
    content.style.setProperty('--modal-tilt-x', '0deg');
    content.style.setProperty('--modal-tilt-y', '0deg');
    content.style.setProperty('--modal-pointer-x', '50%');
    content.style.setProperty('--modal-pointer-y', '50%');
}

function initializePlayerModalFx() {
    const modal = document.getElementById('playerModal');
    const content = modal?.querySelector('.modal-content');
    if (!modal || !content) return;

    resetModalMotion(content);

    content.addEventListener('pointermove', (event) => {
        if (!modal.classList.contains('active')) return;

        const rect = content.getBoundingClientRect();
        const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
        const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
        const tiltX = ((pointerY - 50) / 50) * -2.4;
        const tiltY = ((pointerX - 50) / 50) * 2.4;

        content.style.setProperty('--modal-pointer-x', `${pointerX.toFixed(2)}%`);
        content.style.setProperty('--modal-pointer-y', `${pointerY.toFixed(2)}%`);
        content.style.setProperty('--modal-tilt-x', `${tiltX.toFixed(2)}deg`);
        content.style.setProperty('--modal-tilt-y', `${tiltY.toFixed(2)}deg`);
    });

    content.addEventListener('pointerleave', () => {
        resetModalMotion(content);
    });
}

// Open player profile modal
function openPlayerModal(username) {
    const player = playerRankings.find(p => p.username === username);
    if (!player) return;
    
    // Set player info
    document.getElementById('playerModalName').textContent = player.username;
    animateModalNumber(document.getElementById('playerRank'), player.rank, { prefix: '#', duration: 320 });
    document.getElementById('playerWL').textContent = `${player.wins}W - ${player.losses}L`;
    const levelNode = document.getElementById('playerLevel');
    if (levelNode) {
        const safeLevel = normalizeLevelValue(player.level);
        levelNode.textContent = `Level ${safeLevel || defaultLevelForRank(player.rank)}`;
    }
    
    const factionImg = getFactionFlag(player.faction);
    const factionDisplay = factionImg ? `<img src="${factionImg}" alt="${player.faction}" class="faction-flag"> ${player.faction}` : player.faction;
    document.getElementById('playerFaction').innerHTML = factionDisplay;
    
    document.getElementById('playerCountry').textContent = `${getCountryEmoji(player.country)} ${player.country}`;

    const trendLabel = player.trend === 'up' ? 'Rising' : player.trend === 'down' ? 'Under Pressure' : 'Stable';
    const trendArrow = player.trend === 'up' ? '↑' : player.trend === 'down' ? '↓' : '→';
    const heroAvatar = document.getElementById('playerHeroAvatar');
    const heroRankRing = document.getElementById('playerHeroRankRing');
    const heroSubtitle = document.getElementById('playerHeroSubtitle');
    const heroChipTrend = document.getElementById('playerHeroChipTrend');
    const heroChipRecord = document.getElementById('playerHeroChipRecord');
    const heroChipTier = document.getElementById('playerHeroChipTier');

    if (heroAvatar) heroAvatar.textContent = player.username.charAt(0).toUpperCase();
    if (heroRankRing) heroRankRing.textContent = `#${player.rank}`;
    if (heroSubtitle) heroSubtitle.textContent = `${getCountryEmoji(player.country)} ${player.country} | ${player.faction}`;
    if (heroChipTrend) heroChipTrend.textContent = `${trendArrow} Trend: ${trendLabel}`;
    if (heroChipRecord) heroChipRecord.textContent = `Record: ${player.wins}W-${player.losses}L`;
    if (heroChipTier) heroChipTier.textContent = `Tier: ${getPlayerTierLabel(player)}`;
    
    // Show modal
    const modal = document.getElementById('playerModal');
    const modalContent = modal.querySelector('.modal-content');
    modalContent.classList.remove('modal-elite', 'modal-rising', 'modal-falling', 'modal-steady');
    modalContent.classList.add(getPlayerModalMoodClass(player));
    resetModalMotion(modalContent);
    modal.classList.remove('closing');
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    emitSoundHook('ui.modal.player.open', {
        username: player.username,
        rank: player.rank,
        trend: player.trend,
        tier: getPlayerTierLabel(player)
    });
}

// Close player profile modal
function closePlayerModal() {
    const modal = document.getElementById('playerModal');
    if (!modal.classList.contains('active')) return;
    resetModalMotion(modal.querySelector('.modal-content'));
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

window.matchPopups = {
    show: showMatchResultPopup,
    soundHook: emitSoundHook,
    getProfile: getMatchPopupProfile,
    setProfile: setMatchPopupProfile,
    profiles: matchPopupProfiles,
    notifyQueue: (title, detail, payload = {}) => notifyWithProfile('queueStatus', title, detail, payload),
    notifySystem: (title, detail, payload = {}) => notifyWithProfile('systemNotice', title, detail, payload),
    notifyStreak: (title, detail, isPositive = true, payload = {}) => notifyWithProfile(isPositive ? 'streakWin' : 'streakLoss', title, detail, payload)
};
