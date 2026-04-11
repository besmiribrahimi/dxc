const CLIPS_CONFIG_ENDPOINT = "/api/leaderboard-config";

const clipsStatusNode = document.getElementById("clipsStatus");
const editsGridNode = document.getElementById("editsGrid");
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

  if (/^data:(video|image)\/[a-z0-9.+-]+;base64,/i.test(raw)) {
    return raw.length <= 3_000_000 ? raw : "";
  }

  const extractedMatch = raw.match(/https?:\/\/[^\s<>()]+/i);
  const extractedRaw = extractedMatch
    ? extractedMatch[0]
    : raw
      .replace(/[<>]/g, "")
      .split(/\s+/)
      .filter(Boolean)[0] || "";

  const cleaned = extractedRaw.replace(/[),.;!]+$/g, "").trim();
  if (!cleaned) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;

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

function toMedalEmbedUrl(urlValue) {
  const source = String(urlValue || "").trim();
  if (!/medal\.tv/i.test(source)) {
    return "";
  }

  try {
    const parsed = new URL(source);
    const path = String(parsed.pathname || "");
    const clipMatch = path.match(/\/games\/([^/]+)\/clips\/([^/?#]+)/i);
    if (clipMatch) {
      return `https://medal.tv/games/${clipMatch[1]}/clips/${clipMatch[2]}?embed=1`;
    }

    const fallbackMatch = source.match(/medal\.tv\/clips\/([^/?#]+)/i);
    if (fallbackMatch) {
      return `https://medal.tv/clips/${fallbackMatch[1]}?embed=1`;
    }
  } catch {
    return "";
  }

  return "";
}

function isVideoUrl(urlValue) {
  const value = String(urlValue || "").trim();
  if (!value) {
    return false;
  }

  if (/^data:video\//i.test(value)) {
    return true;
  }

  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(value);
}

function isImageUrl(urlValue) {
  const value = String(urlValue || "").trim();
  if (!value) {
    return false;
  }

  if (/^data:image\//i.test(value)) {
    return true;
  }

  return /\.(jpg|jpeg|png|gif|webp|avif)(\?|#|$)/i.test(value);
}

function buildClipMediaMarkup(clip) {
  const medalEmbedUrl = toMedalEmbedUrl(clip.url);
  if (medalEmbedUrl) {
    return `<iframe class="clip-media clip-media-embed" src="${safeText(medalEmbedUrl)}" title="${safeText(clip.title)}" loading="lazy" allowfullscreen></iframe>`;
  }

  if (isVideoUrl(clip.url)) {
    return `<video class="clip-media" controls preload="metadata" src="${safeText(clip.url)}"></video>`;
  }

  if (isImageUrl(clip.url)) {
    return `<img class="clip-media" src="${safeText(clip.url)}" alt="${safeText(clip.title)} media" loading="lazy">`;
  }

  return "";
}

function normalizeClipEntry(raw, index = 0) {
  const entry = raw && typeof raw === "object" ? raw : {};
  const title = String(entry.title || "").trim().slice(0, 120);
  const url = normalizeClipUrl(entry.url);
  const type = String(entry.type || "clip").trim().toLowerCase() === "edit" ? "edit" : "clip";

  return {
    id: String(entry.id || `clip-${index}`).trim(),
    type,
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
  if (/^data:(video|image)\//i.test(String(urlValue || "").trim())) {
    return "UPLOAD";
  }

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
  const typeLabel = clip.type === "edit" ? "EDIT" : "CLIP";

  return `
    <article class="clip-card${featured ? " featured" : ""}">
      <h3>${safeText(clip.title)}</h3>
      <div class="clip-meta">
        <span class="clip-chip">${typeLabel}</span>
        <span class="clip-chip">${safeText(playerLabel)}</span>
        <span class="clip-chip">${safeText(provider)}</span>
      </div>
      ${buildClipMediaMarkup(clip)}
      <p>${safeText(clip.description || "No description provided.")}</p>
      <a class="admin-button clip-link" href="${safeText(clip.url)}" target="_blank" rel="noreferrer noopener">${clip.type === "edit" ? "Open Edit" : "Watch Clip"}</a>
    </article>
  `;
}

function renderClipBoards(clips) {
  if (!editsGridNode || !clipsGridNode || !clipsStatusNode) {
    return;
  }

  const safeClips = Array.isArray(clips) ? clips : [];
  const edits = safeClips.filter((clip) => clip.type === "edit");
  const regularClips = safeClips.filter((clip) => clip.type !== "edit");

  clipsStatusNode.textContent = `${regularClips.length} clip${regularClips.length === 1 ? "" : "s"} and ${edits.length} edit${edits.length === 1 ? "" : "s"} loaded.`;

  if (!edits.length) {
    editsGridNode.innerHTML = "<p class=\"clip-empty\">No edits published yet.</p>";
  } else {
    editsGridNode.innerHTML = edits
      .map((clip) => buildClipCard(clip, clip.featured))
      .join("");
  }

  if (!regularClips.length) {
    clipsGridNode.innerHTML = "<p class=\"clip-empty\">No clips published yet. Admins can add clips from the Admin panel.</p>";
    return;
  }

  clipsGridNode.innerHTML = regularClips
    .map((clip) => buildClipCard(clip, clip.featured))
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

    if (editsGridNode) {
      editsGridNode.innerHTML = "<p class=\"clip-empty\">Could not load edits.</p>";
    }

    if (clipsGridNode) {
      clipsGridNode.innerHTML = "<p class=\"clip-empty\">Please try again in a moment.</p>";
    }
  }
}

loadClips();
