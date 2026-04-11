const CLIPS_CONFIG_ENDPOINT = "/api/leaderboard-config";

const clipsStatusNode = document.getElementById("clipsStatus");
const clipsFeaturedNode = document.getElementById("clipsFeatured");
const clipsGridNode = document.getElementById("clipsGrid");

function safeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeClipUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeClipEntry(raw, index = 0) {
  const entry = raw && typeof raw === "object" ? raw : {};
  const title = String(entry.title || "").trim().slice(0, 120);
  const url = normalizeClipUrl(entry.url);

  return {
    id: String(entry.id || `clip-${index}`).trim(),
    title,
    url,
    player: String(entry.player || "").trim().slice(0, 64),
    description: String(entry.description || "").trim().slice(0, 280),
    featured: Boolean(entry.featured)
  };
}

function normalizeClips(rawClips) {
  if (!Array.isArray(rawClips)) {
    return [];
  }

  return rawClips
    .map((entry, index) => normalizeClipEntry(entry, index))
    .filter((entry) => Boolean(entry.title) && Boolean(entry.url));
}

function getClipProvider(urlValue) {
  try {
    const host = new URL(urlValue).hostname.replace(/^www\./i, "");
    const label = host.split(".")[0] || host;
    return label.toUpperCase();
  } catch {
    return "CLIP";
  }
}

function buildClipCard(clip, featured = false) {
  const playerLabel = clip.player ? `Player: ${clip.player}` : "Community Clip";
  const provider = getClipProvider(clip.url);

  return `
    <article class="clip-card${featured ? " featured" : ""}">
      <h3>${safeText(clip.title)}</h3>
      <div class="clip-meta">
        <span class="clip-chip">${safeText(playerLabel)}</span>
        <span class="clip-chip">${safeText(provider)}</span>
      </div>
      <p>${safeText(clip.description || "No description provided.")}</p>
      <a class="admin-button clip-link" href="${safeText(clip.url)}" target="_blank" rel="noreferrer noopener">Watch Clip</a>
    </article>
  `;
}

function renderClipBoards(clips) {
  if (!clipsFeaturedNode || !clipsGridNode || !clipsStatusNode) {
    return;
  }

  if (!Array.isArray(clips) || !clips.length) {
    clipsStatusNode.textContent = "No clips published yet.";
    clipsFeaturedNode.innerHTML = "<p class=\"clip-empty\">No featured clip yet.</p>";
    clipsGridNode.innerHTML = "<p class=\"clip-empty\">Admins can add clips from the Admin panel.</p>";
    return;
  }

  const featuredClip = clips.find((clip) => clip.featured) || clips[0];
  const listClips = clips.filter((clip) => clip.id !== featuredClip.id);

  clipsStatusNode.textContent = `${clips.length} clip${clips.length === 1 ? "" : "s"} loaded.`;
  clipsFeaturedNode.innerHTML = buildClipCard(featuredClip, true);

  if (!listClips.length) {
    clipsGridNode.innerHTML = "<p class=\"clip-empty\">Add more clips to build out this section.</p>";
    return;
  }

  clipsGridNode.innerHTML = listClips
    .map((clip) => buildClipCard(clip, false))
    .join("");
}

async function loadClips() {
  if (clipsStatusNode) {
    clipsStatusNode.textContent = "Loading clips...";
  }

  try {
    const response = await fetch(CLIPS_CONFIG_ENDPOINT, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    const clips = normalizeClips(payload?.config?.clips);
    renderClipBoards(clips);
  } catch {
    if (clipsStatusNode) {
      clipsStatusNode.textContent = "Could not load clips right now.";
    }

    if (clipsFeaturedNode) {
      clipsFeaturedNode.innerHTML = "<p class=\"clip-empty\">Could not load featured clip.</p>";
    }

    if (clipsGridNode) {
      clipsGridNode.innerHTML = "<p class=\"clip-empty\">Please try again in a moment.</p>";
    }
  }
}

loadClips();
