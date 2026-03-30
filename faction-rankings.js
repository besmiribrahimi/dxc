const factionTiers = [
    {
        id: 'elite',
        label: 'Elite',
        description: 'Top-end performance and consistency in current fixtures.',
        factions: ['DK', 'AH', 'TTI2']
    },
    {
        id: 'top-mid',
        label: 'Top Mid',
        description: 'Strong teams capable of beating elite opponents in form.',
        factions: ['SWL', 'IA', '271ST', 'CZSK']
    },
    {
        id: 'mid',
        label: 'Mid',
        description: 'Competitive pool with volatile weekly form.',
        factions: ['TWA', 'RRF', 'INS', 'RKA 2']
    },
    {
        id: 'low-mid',
        label: 'Low Mid',
        description: 'Developing factions and mixed rosters.',
        factions: ['URF', 'TAE', 'AEF', 'NDV', 'KOC', 'Everybody else']
    }
];

const tierAccent = {
    elite: 'tier-elite',
    'top-mid': 'tier-top-mid',
    mid: 'tier-mid',
    'low-mid': 'tier-low-mid'
};

const AUTO_ROTATE_INTERVAL_MS = 7000;
const AUTO_FEATURE_STORAGE_KEY = 'draxar_faction_auto_rotate_v1';

const flagCandidates = {
    DK: ['faction_flags/DK.png'],
    AH: ['faction_flags/AH.png'],
    TTI2: ['faction_flags/tti.png'],
    SWL: ['faction_flags/SWL.png'],
    IA: ['faction_flags/IA.png'],
    '271ST': ['faction_flags/271ST.png'],
    CZSK: ['faction_flags/CZSK.png'],
    TWA: ['faction_flags/TWA.png'],
    RRF: ['faction_flags/RRF.png'],
    INS: ['faction_flags/INS.png'],
    'RKA 2': ['faction_flags/RKA2.png', 'faction_flags/RKA 2.png', 'faction_flags/RKA.png'],
    URF: ['faction_flags/URF.png'],
    TAE: ['faction_flags/TAE.png'],
    AEF: ['faction_flags/AEF.png'],
    NDV: ['faction_flags/NDV.png'],
    KOC: ['faction_flags/KOC.png']
};

function uniqueValues(values) {
    const seen = new Set();
    const out = [];
    values.forEach((value) => {
        if (!value || seen.has(value)) return;
        seen.add(value);
        out.push(value);
    });
    return out;
}

function buildFlagCandidates(name) {
    const explicit = flagCandidates[name] || [];
    const raw = String(name || '').trim();
    if (!raw) return explicit;

    const upper = raw.toUpperCase();
    const lower = raw.toLowerCase();
    const compact = raw.replace(/\s+/g, '');
    const compactUpper = compact.toUpperCase();
    const compactLower = compact.toLowerCase();

    const generic = [
        `faction_flags/${raw}.png`,
        `faction_flags/${upper}.png`,
        `faction_flags/${lower}.png`,
        `faction_flags/${compact}.png`,
        `faction_flags/${compactUpper}.png`,
        `faction_flags/${compactLower}.png`
    ];

    return uniqueValues([...explicit, ...generic]);
}

const allEntries = factionTiers.flatMap((tier) =>
    tier.factions.map((name) => ({
        name,
        tierId: tier.id,
        tierLabel: tier.label,
        tierDescription: tier.description
    }))
);

let activeTier = 'all';
let activeSearch = '';
let activeFaction = null;
let autoFeatureEnabled = true;
let autoFeatureTimer = null;
let autoFeatureCursor = 0;

const gridEl = document.getElementById('factionGrid');
const tierFiltersEl = document.getElementById('tierFilters');
const searchEl = document.getElementById('factionSearch');
const controlStatsEl = document.getElementById('factionControlStats');
const autoFeatureToggleEl = document.getElementById('autoFeatureToggle');
const autoFeatureStatusEl = document.getElementById('autoFeatureStatus');

const spotlightNameEl = document.getElementById('spotlightName');
const spotlightTierEl = document.getElementById('spotlightTier');
const spotlightCopyEl = document.getElementById('spotlightCopy');
const spotlightPeersEl = document.getElementById('spotlightPeers');
const spotlightFlagEl = document.getElementById('spotlightFlag');
const featuredBadgeEl = document.getElementById('featuredBadge');

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function getTierById(tierId) {
    return factionTiers.find((tier) => tier.id === tierId);
}

function getFilteredEntries() {
    return allEntries.filter((entry) => {
        const tierMatch = activeTier === 'all' || entry.tierId === activeTier;
        const searchMatch = !activeSearch || normalizeText(entry.name).includes(activeSearch);
        return tierMatch && searchMatch;
    });
}

function getDailyFeaturedIndex(totalLength) {
    if (!totalLength) return 0;
    const now = new Date();
    const utcDayKey = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const daySerial = Math.floor(utcDayKey / 86400000);
    return daySerial % totalLength;
}

function getDailyFeaturedEntry(entries) {
    if (!entries.length) return null;
    return entries[getDailyFeaturedIndex(entries.length)] || null;
}

function makeFallbackMark(name) {
    const clean = String(name || '').replace(/[^A-Za-z0-9]/g, '');
    return clean ? clean.slice(0, 3).toUpperCase() : 'N/A';
}

function buildFlagMarkup(name) {
    const candidates = buildFlagCandidates(name);
    if (!candidates.length) {
        return `<span class="faction-flag-fallback">${makeFallbackMark(name)}</span>`;
    }

    const escapedAlt = name.replace(/"/g, '&quot;');
    const sources = candidates.join('|').replace(/"/g, '&quot;');
    return `<img src="${candidates[0]}" alt="${escapedAlt} flag" class="faction-flag faction-dynamic-flag" data-fallback="${sources}">`;
}

function buildTokenMarkup(name) {
    return `
        <button type="button" class="faction-token" data-faction="${name}">
            <span class="faction-token-flag-wrap">${buildFlagMarkup(name)}</span>
            <span class="faction-token-name">${name}</span>
        </button>
    `;
}

function setSpotlightFlag(name) {
    if (!spotlightFlagEl) return;

    const candidates = buildFlagCandidates(name);
    if (!candidates.length) {
        spotlightFlagEl.innerHTML = `<span class="faction-stage-fallback">${makeFallbackMark(name)}</span>`;
        return;
    }

    const escapedAlt = name.replace(/"/g, '&quot;');
    const sources = candidates.join('|').replace(/"/g, '&quot;');
    spotlightFlagEl.innerHTML = `<img src="${candidates[0]}" alt="${escapedAlt} flag" class="faction-stage-flag-image faction-dynamic-flag" data-fallback="${sources}">`;
}

function setSpotlight(entry) {
    const visibleEntries = getFilteredEntries();
    const dailyFeatured = getDailyFeaturedEntry(visibleEntries);

    if (!entry) {
        spotlightNameEl.textContent = 'Select a faction';
        spotlightTierEl.textContent = 'Tier: -';
        spotlightCopyEl.textContent = 'Click any faction below to focus it and compare against same-tier peers.';
        spotlightPeersEl.innerHTML = '';
        setSpotlightFlag('');
        if (featuredBadgeEl) {
            featuredBadgeEl.textContent = autoFeatureEnabled ? 'Auto Rotation Spotlight' : 'Manual Spotlight';
            featuredBadgeEl.classList.remove('is-featured');
        }
        return;
    }

    const tier = getTierById(entry.tierId);
    const peers = tier ? tier.factions.filter((name) => name !== entry.name) : [];

    spotlightNameEl.textContent = entry.name;
    spotlightTierEl.textContent = `Tier: ${entry.tierLabel}`;
    spotlightCopyEl.textContent = tier ? tier.description : '';
    setSpotlightFlag(entry.name);

    if (featuredBadgeEl) {
        const isFeatured = Boolean(dailyFeatured && dailyFeatured.name === entry.name);
        featuredBadgeEl.textContent = isFeatured
            ? 'Featured Faction of the Day'
            : (autoFeatureEnabled ? 'Auto Rotation Spotlight' : 'Manual Spotlight');
        featuredBadgeEl.classList.toggle('is-featured', isFeatured);
    }

    spotlightPeersEl.innerHTML = peers.length
        ? peers.map((peer) => `<span class="faction-peer-chip">${peer}</span>`).join('')
        : '<span class="faction-peer-chip">No peer list</span>';
}

function buildVisibleTierMap(entries) {
    const names = new Set(entries.map((entry) => entry.name));
    return factionTiers
        .map((tier) => ({
            ...tier,
            visibleFactions: tier.factions.filter((name) => names.has(name))
        }))
        .filter((tier) => tier.visibleFactions.length > 0);
}

function buildTierSeparatorMarkup() {
    return `
        <div class="tier-separator" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
}

function stopAutoFeatureRotation() {
    if (!autoFeatureTimer) return;
    clearInterval(autoFeatureTimer);
    autoFeatureTimer = null;
}

function syncAutoFeatureStatus(entries = getFilteredEntries()) {
    if (!autoFeatureStatusEl) return;

    if (!entries.length) {
        autoFeatureStatusEl.textContent = autoFeatureEnabled
            ? 'Auto focus ready. Adjust filters to show factions.'
            : 'Auto focus paused. Adjust filters to show factions.';
        return;
    }

    const featured = getDailyFeaturedEntry(entries);
    const featuredName = featured ? featured.name : 'N/A';

    autoFeatureStatusEl.textContent = autoFeatureEnabled
        ? `Auto rotating every 7s • Daily seed: ${featuredName}`
        : `Auto focus paused • Daily featured: ${featuredName}`;
}

function startAutoFeatureRotation(entries = getFilteredEntries()) {
    stopAutoFeatureRotation();
    if (!autoFeatureEnabled || !entries.length) {
        syncAutoFeatureStatus(entries);
        return;
    }

    const currentIndex = entries.findIndex((entry) => activeFaction && entry.name === activeFaction.name);
    if (currentIndex >= 0) {
        autoFeatureCursor = currentIndex;
    } else if (autoFeatureCursor < 0 || autoFeatureCursor >= entries.length) {
        autoFeatureCursor = getDailyFeaturedIndex(entries.length);
    }

    const current = entries[autoFeatureCursor];
    if (current) {
        activeFaction = current;
        setSpotlight(activeFaction);
        paintActiveToken();
        hydrateFlagFallbacks();
    }

    syncAutoFeatureStatus(entries);

    autoFeatureTimer = setInterval(() => {
        if (!autoFeatureEnabled) return;

        const liveEntries = getFilteredEntries();
        if (!liveEntries.length) {
            stopAutoFeatureRotation();
            syncAutoFeatureStatus(liveEntries);
            return;
        }

        autoFeatureCursor = (autoFeatureCursor + 1) % liveEntries.length;
        activeFaction = liveEntries[autoFeatureCursor];
        setSpotlight(activeFaction);
        paintActiveToken();
        hydrateFlagFallbacks();
        syncAutoFeatureStatus(liveEntries);
    }, AUTO_ROTATE_INTERVAL_MS);
}

function loadAutoFeaturePreference() {
    try {
        return localStorage.getItem(AUTO_FEATURE_STORAGE_KEY) !== '0';
    } catch {
        return true;
    }
}

function setAutoFeatureEnabled(enabled, { persist = true, restart = true } = {}) {
    autoFeatureEnabled = Boolean(enabled);

    if (autoFeatureToggleEl) {
        autoFeatureToggleEl.classList.toggle('active', autoFeatureEnabled);
        autoFeatureToggleEl.textContent = autoFeatureEnabled ? 'Auto Focus: On' : 'Auto Focus: Off';
        autoFeatureToggleEl.setAttribute('aria-pressed', autoFeatureEnabled ? 'true' : 'false');
    }

    if (persist) {
        try {
            localStorage.setItem(AUTO_FEATURE_STORAGE_KEY, autoFeatureEnabled ? '1' : '0');
        } catch {
            // Ignore storage issues in restricted browsing contexts.
        }
    }

    if (autoFeatureEnabled) {
        if (restart) {
            startAutoFeatureRotation(getFilteredEntries());
        } else {
            syncAutoFeatureStatus(getFilteredEntries());
        }
    } else {
        stopAutoFeatureRotation();
        syncAutoFeatureStatus(getFilteredEntries());
        if (activeFaction) {
            setSpotlight(activeFaction);
        }
    }
}

function renderLanes() {
    const entries = getFilteredEntries();

    if (!entries.length) {
        gridEl.innerHTML = '<div class="no-results">No factions matched this filter.</div>';
        controlStatsEl.textContent = 'Showing 0 factions';
        stopAutoFeatureRotation();
        syncAutoFeatureStatus(entries);
        setSpotlight(null);
        return;
    }

    const visibleTiers = buildVisibleTierMap(entries);

    const html = visibleTiers
        .map((tier, index) => {
            const accentClass = tierAccent[tier.id] || '';
            return `
                <article class="faction-lane ${accentClass}" data-tier="${tier.id}">
                    <header class="faction-lane-head">
                        <h3>${tier.label}</h3>
                        <p>${tier.description}</p>
                    </header>
                    <div class="faction-token-row">
                        ${tier.visibleFactions.map((name) => buildTokenMarkup(name)).join('')}
                    </div>
                </article>
                ${index < visibleTiers.length - 1 ? buildTierSeparatorMarkup() : ''}
            `;
        })
        .join('');

    gridEl.innerHTML = html;
    controlStatsEl.textContent = `Showing ${entries.length} faction${entries.length === 1 ? '' : 's'}`;

    if (activeFaction) {
        const stillVisible = entries.find((entry) => entry.name === activeFaction.name);
        if (!stillVisible) {
            activeFaction = autoFeatureEnabled
                ? entries[getDailyFeaturedIndex(entries.length)]
                : entries[0];
        }
    } else {
        activeFaction = autoFeatureEnabled
            ? entries[getDailyFeaturedIndex(entries.length)]
            : entries[0];
    }

    setSpotlight(activeFaction);
    paintActiveToken();
    hydrateFlagFallbacks();
    syncAutoFeatureStatus(entries);

    if (autoFeatureEnabled) {
        startAutoFeatureRotation(entries);
    } else {
        stopAutoFeatureRotation();
    }
}

function paintActiveToken() {
    const tokens = Array.from(document.querySelectorAll('.faction-token'));
    tokens.forEach((token) => {
        const isActive = activeFaction && token.dataset.faction === activeFaction.name;
        token.classList.toggle('is-active', isActive);
        token.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function hydrateFlagFallbacks() {
    const images = Array.from(document.querySelectorAll('.faction-dynamic-flag'));
    images.forEach((img) => {
        const fallback = String(img.dataset.fallback || '');
        if (!fallback) return;

        const candidates = fallback.split('|').filter(Boolean);
        let cursor = 0;

        const onError = () => {
            cursor += 1;
            if (cursor < candidates.length) {
                img.src = candidates[cursor];
                return;
            }

            const marker = document.createElement('span');
            const inSpotlight = img.classList.contains('faction-stage-flag-image');
            marker.className = inSpotlight ? 'faction-stage-fallback' : 'faction-flag-fallback';
            marker.textContent = makeFallbackMark(img.alt.replace(' flag', ''));
            img.replaceWith(marker);
        };

        img.addEventListener('error', onError, { once: false });
    });
}

function handleTierFilter(event) {
    const target = event.target.closest('button[data-tier]');
    if (!target) return;

    activeTier = target.dataset.tier || 'all';
    Array.from(tierFiltersEl.querySelectorAll('button[data-tier]')).forEach((button) => {
        const isActive = button === target;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    renderLanes();
}

function handleSearchInput(event) {
    activeSearch = normalizeText(event.target.value);
    renderLanes();
}

function selectFactionByName(name) {
    const selected = allEntries.find((entry) => entry.name === name);
    if (!selected) return;

    const tierId = selected.tierId;
    const tier = getTierById(tierId);
    if (!name || !tier) return;

    activeFaction = {
        name,
        tierId,
        tierLabel: tier.label,
        tierDescription: tier.description
    };

    const visibleEntries = getFilteredEntries();
    const visibleIndex = visibleEntries.findIndex((entry) => entry.name === name);
    if (visibleIndex >= 0) {
        autoFeatureCursor = visibleIndex;
    }

    setSpotlight(activeFaction);
    paintActiveToken();
    hydrateFlagFallbacks();
    syncAutoFeatureStatus(visibleEntries);

    if (autoFeatureEnabled) {
        startAutoFeatureRotation(visibleEntries);
    }
}

function handleTokenInteraction(event) {
    const token = event.target.closest('.faction-token');
    if (!token) return;
    selectFactionByName(token.dataset.faction);
}

function handleTokenKeyboard(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const token = event.target.closest('.faction-token');
    if (!token) return;

    event.preventDefault();
    selectFactionByName(token.dataset.faction);
}

function handleAutoFeatureToggle() {
    setAutoFeatureEnabled(!autoFeatureEnabled);
}

function initFactionPage() {
    setAutoFeatureEnabled(loadAutoFeaturePreference(), { persist: false, restart: false });

    tierFiltersEl.addEventListener('click', handleTierFilter);
    searchEl.addEventListener('input', handleSearchInput);
    gridEl.addEventListener('click', handleTokenInteraction);
    gridEl.addEventListener('keydown', handleTokenKeyboard);
    autoFeatureToggleEl?.addEventListener('click', handleAutoFeatureToggle);

    renderLanes();
}

initFactionPage();
