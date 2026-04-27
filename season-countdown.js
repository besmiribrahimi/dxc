/* ── Season One Countdown Popup ── */
(function () {
  const SEASON_START = new Date("2026-04-30T18:00:00+02:00");
  const DISMISS_KEY = "ae-season1-popup-dismissed-v1";
  const SHOW_DELAY_MS = 1200;

  // Don't show if already dismissed this session or season already started
  if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
  if (Date.now() >= SEASON_START.getTime()) return;

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      /* ── Season Countdown Overlay ── */
      .season-countdown-overlay {
        position: fixed;
        inset: 0;
        z-index: 200000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        opacity: 0;
        visibility: hidden;
        transition: opacity 500ms ease, visibility 500ms ease;
        pointer-events: none;
      }

      .season-countdown-overlay.is-visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .season-countdown-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(2, 6, 23, 0.88);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      .season-countdown-card {
        position: relative;
        max-width: 560px;
        width: 100%;
        border-radius: 24px;
        border: 1px solid rgba(147, 197, 253, 0.3);
        background: linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(10, 16, 33, 0.98));
        box-shadow:
          0 32px 80px rgba(0, 0, 0, 0.7),
          0 0 60px rgba(59, 130, 246, 0.15),
          inset 0 1px 0 rgba(147, 197, 253, 0.1);
        padding: 2.5rem 2rem 2rem;
        text-align: center;
        overflow: hidden;
        transform: scale(0.92) translateY(30px);
        transition: transform 600ms cubic-bezier(0.2, 1, 0.3, 1);
      }

      .season-countdown-overlay.is-visible .season-countdown-card {
        transform: scale(1) translateY(0);
      }

      /* Animated border glow */
      .season-countdown-card::before {
        content: "";
        position: absolute;
        inset: -2px;
        border-radius: 26px;
        background: conic-gradient(
          from 0deg,
          transparent 0deg,
          rgba(59, 130, 246, 0.4) 60deg,
          transparent 120deg,
          transparent 180deg,
          rgba(245, 158, 11, 0.3) 240deg,
          transparent 300deg
        );
        z-index: -1;
        animation: season-border-spin 6s linear infinite;
        filter: blur(3px);
      }

      .season-countdown-card::after {
        content: "";
        position: absolute;
        inset: 1px;
        border-radius: 23px;
        background: linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(10, 16, 33, 1));
        z-index: -1;
      }

      @keyframes season-border-spin {
        to { transform: rotate(360deg); }
      }

      .season-close-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid rgba(147, 197, 253, 0.3);
        background: rgba(2, 6, 23, 0.6);
        color: #94a3b8;
        font-size: 1.2rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 200ms, color 200ms, transform 200ms;
        z-index: 5;
      }

      .season-close-btn:hover {
        border-color: rgba(239, 68, 68, 0.6);
        color: #f87171;
        transform: rotate(90deg);
      }

      .season-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin-bottom: 1rem;
        padding: 0.3rem 1rem;
        border-radius: 999px;
        border: 1px solid rgba(245, 158, 11, 0.4);
        background: linear-gradient(120deg, rgba(245, 158, 11, 0.15), rgba(234, 88, 12, 0.1));
        font-size: 0.72rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        font-weight: 800;
        color: #fbbf24;
        font-family: "Exo 2", sans-serif;
        animation: season-badge-pulse 2s ease-in-out infinite;
      }

      .season-badge-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #f59e0b;
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
        animation: pulse-dot 1.5s ease-in-out infinite;
      }

      @keyframes season-badge-pulse {
        0%, 100% { box-shadow: 0 0 12px rgba(245, 158, 11, 0.1); }
        50% { box-shadow: 0 0 24px rgba(245, 158, 11, 0.25); }
      }

      .season-title {
        margin: 0 0 0.3rem;
        font-family: "Rajdhani", sans-serif;
        font-size: clamp(2rem, 6vw, 3rem);
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        line-height: 1;
        background: linear-gradient(90deg, #e2e8f0, #93c5fd, #3b82f6, #93c5fd, #e2e8f0);
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: season-title-shimmer 4s ease-in-out infinite;
      }

      @keyframes season-title-shimmer {
        0% { background-position: 0% center; }
        100% { background-position: 200% center; }
      }

      .season-subtitle {
        margin: 0 0 1.8rem;
        font-size: 1rem;
        color: #94a3b8;
        letter-spacing: 0.08em;
        font-weight: 500;
      }

      .season-subtitle strong {
        color: #f59e0b;
      }

      /* Countdown digits */
      .season-countdown-grid {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        margin-bottom: 1.8rem;
        flex-wrap: wrap;
      }

      .season-countdown-unit {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3rem;
        min-width: 80px;
      }

      .season-countdown-digits {
        font-family: "Rajdhani", sans-serif;
        font-size: clamp(2.8rem, 8vw, 4rem);
        font-weight: 700;
        line-height: 1;
        color: #eff6ff;
        text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
        background: linear-gradient(180deg, #eff6ff 30%, #60a5fa 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        transition: transform 300ms cubic-bezier(0.2, 1, 0.3, 1);
        min-width: 70px;
        padding: 0.4rem 0.6rem;
        border-radius: 14px;
        border: 1px solid rgba(147, 197, 253, 0.2);
        background-color: rgba(2, 6, 23, 0.5);
        /* Override for text gradient */
        background-image: linear-gradient(180deg, #eff6ff 30%, #60a5fa 100%);
        -webkit-background-clip: text;
        background-clip: text;
      }

      .season-countdown-digits.tick {
        transform: scale(1.12);
      }

      .season-countdown-label {
        font-size: 0.65rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 700;
      }

      .season-countdown-sep {
        font-family: "Rajdhani", sans-serif;
        font-size: 2.5rem;
        color: rgba(147, 197, 253, 0.3);
        line-height: 1;
        margin-top: -0.8rem;
        animation: season-sep-blink 1s step-end infinite;
      }

      @keyframes season-sep-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.2; }
      }

      .season-cta-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.8rem;
        flex-wrap: wrap;
      }

      .season-discord-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        min-height: 42px;
        padding: 0.4rem 1.4rem;
        border-radius: 12px;
        border: 1px solid rgba(88, 101, 242, 0.5);
        background: linear-gradient(120deg, rgba(88, 101, 242, 0.3), rgba(37, 99, 235, 0.25));
        color: #c4cbf5;
        text-decoration: none;
        font-family: "Exo 2", sans-serif;
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        transition: transform 200ms, box-shadow 200ms, border-color 200ms;
      }

      .season-discord-btn:hover {
        transform: translateY(-2px);
        border-color: rgba(88, 101, 242, 0.8);
        box-shadow: 0 8px 24px rgba(88, 101, 242, 0.3);
      }

      .season-discord-btn svg {
        width: 16px;
        height: 16px;
      }

      .season-dismiss-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0.4rem 1.4rem;
        border-radius: 12px;
        border: 1px solid rgba(147, 197, 253, 0.2);
        background: rgba(2, 6, 23, 0.4);
        color: #64748b;
        font-family: "Exo 2", sans-serif;
        font-size: 0.82rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: border-color 200ms, color 200ms;
      }

      .season-dismiss-btn:hover {
        border-color: rgba(147, 197, 253, 0.4);
        color: #94a3b8;
      }

      /* Season particle canvas */
      .season-particles {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        border-radius: 24px;
        overflow: hidden;
      }

      .season-countdown-card > *:not(.season-particles):not(.season-close-btn) {
        position: relative;
        z-index: 2;
      }

      .season-footer-note {
        margin-top: 1.2rem;
        font-size: 0.68rem;
        color: rgba(148, 163, 184, 0.5);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      @media (max-width: 480px) {
        .season-countdown-card {
          padding: 2rem 1.2rem 1.5rem;
        }

        .season-countdown-unit {
          min-width: 60px;
        }

        .season-countdown-sep {
          font-size: 1.8rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getTimeRemaining() {
    const total = Math.max(0, SEASON_START.getTime() - Date.now());
    return {
      total,
      days: Math.floor(total / (1000 * 60 * 60 * 24)),
      hours: Math.floor((total / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((total / (1000 * 60)) % 60),
      seconds: Math.floor((total / 1000) % 60)
    };
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function createPopup() {
    const overlay = document.createElement("div");
    overlay.className = "season-countdown-overlay";
    overlay.id = "seasonCountdownOverlay";
    overlay.innerHTML = `
      <div class="season-countdown-backdrop"></div>
      <div class="season-countdown-card">
        <canvas class="season-particles" id="seasonParticlesCanvas"></canvas>
        <button class="season-close-btn" id="seasonCloseBtn" aria-label="Close">&times;</button>

        <div class="season-badge">
          <span class="season-badge-dot"></span>
          Incoming Transmission
        </div>

        <h2 class="season-title">Season One</h2>
        <p class="season-subtitle">The official competitive season is <strong>almost here</strong></p>

        <div class="season-countdown-grid">
          <div class="season-countdown-unit">
            <span class="season-countdown-digits" id="seasonDays">${pad(getTimeRemaining().days)}</span>
            <span class="season-countdown-label">Days</span>
          </div>
          <span class="season-countdown-sep">:</span>
          <div class="season-countdown-unit">
            <span class="season-countdown-digits" id="seasonHours">${pad(getTimeRemaining().hours)}</span>
            <span class="season-countdown-label">Hours</span>
          </div>
          <span class="season-countdown-sep">:</span>
          <div class="season-countdown-unit">
            <span class="season-countdown-digits" id="seasonMinutes">${pad(getTimeRemaining().minutes)}</span>
            <span class="season-countdown-label">Minutes</span>
          </div>
          <span class="season-countdown-sep">:</span>
          <div class="season-countdown-unit">
            <span class="season-countdown-digits" id="seasonSeconds">${pad(getTimeRemaining().seconds)}</span>
            <span class="season-countdown-label">Seconds</span>
          </div>
        </div>

        <div class="season-cta-row">
          <a class="season-discord-btn" href="https://discord.gg/kTsPZcwK" target="_blank" rel="noreferrer noopener">
            <svg viewBox="0 0 127.14 96.36" fill="currentColor"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,33.35-1.71,58,0.54,82.3A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.2a68.42,68.42,0,0,1-10.85-5.18c.91-.68,1.8-1.39,2.66-2.14,20.94,9.75,43.79,9.75,64.47,0,.87.75,1.76,1.46,2.67,2.14A68.68,68.68,0,0,1,87.67,85.2a77.5,77.5,0,0,0,6.89,11.16A105.25,105.25,0,0,0,126.73,82.3C129.37,54.12,122.22,29.72,107.7,8.07ZM42.45,67.14C36.18,67.14,31,61.42,31,54.39S36.08,41.65,42.45,41.65,54,47.37,53.91,54.39,48.82,67.14,42.45,67.14Zm42.24,0c-6.27,0-11.43-5.72-11.43-12.75s5.08-12.74,11.43-12.74,11.54,5.72,11.43,12.74S91,67.14,84.69,67.14Z"/></svg>
            Join Discord
          </a>
          <button class="season-dismiss-btn" id="seasonDismissBtn">Got it</button>
        </div>

        <p class="season-footer-note">Ascend Entrenched Competitive Circuit</p>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function startParticles(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles = [];
    const PARTICLE_COUNT = 30;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.5 - 0.1,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        hue: Math.random() > 0.5 ? 220 : 38
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.opacity})`;
        ctx.fill();
      });

      requestAnimationFrame(draw);
    }

    draw();
  }

  function dismiss(overlay) {
    overlay.classList.remove("is-visible");
    sessionStorage.setItem(DISMISS_KEY, "1");
    setTimeout(() => overlay.remove(), 600);
  }

  function startCountdown(overlay) {
    const daysEl = document.getElementById("seasonDays");
    const hoursEl = document.getElementById("seasonHours");
    const minutesEl = document.getElementById("seasonMinutes");
    const secondsEl = document.getElementById("seasonSeconds");

    function tick(el, newVal) {
      if (!el) return;
      const current = el.textContent;
      if (current !== newVal) {
        el.textContent = newVal;
        el.classList.add("tick");
        setTimeout(() => el.classList.remove("tick"), 300);
      }
    }

    function update() {
      const t = getTimeRemaining();
      if (t.total <= 0) {
        dismiss(overlay);
        return;
      }

      tick(daysEl, pad(t.days));
      tick(hoursEl, pad(t.hours));
      tick(minutesEl, pad(t.minutes));
      tick(secondsEl, pad(t.seconds));
    }

    update();
    setInterval(update, 1000);
  }

  // Initialize
  function init() {
    injectStyles();
    const overlay = createPopup();

    // Wire close / dismiss buttons
    const closeBtn = document.getElementById("seasonCloseBtn");
    const dismissBtn = document.getElementById("seasonDismissBtn");
    const backdrop = overlay.querySelector(".season-countdown-backdrop");

    closeBtn?.addEventListener("click", () => dismiss(overlay));
    dismissBtn?.addEventListener("click", () => dismiss(overlay));
    backdrop?.addEventListener("click", () => dismiss(overlay));

    // Show with delay
    setTimeout(() => {
      overlay.classList.add("is-visible");
      startParticles(document.getElementById("seasonParticlesCanvas"));
      startCountdown(overlay);
    }, SHOW_DELAY_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
