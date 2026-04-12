/* ── Floating Particle System ──
   Renders subtle, ambient particles on a fixed canvas.
   Completely non-interactive and lightweight. */

(function initParticles() {
  const canvas = document.getElementById("particleCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let particles = [];
  let animationId = null;
  let lastTime = 0;

  const PARTICLE_COUNT = 60;
  const MAX_SIZE = 2.8;
  const MIN_SIZE = 0.6;
  const MAX_SPEED = 0.25;
  const MIN_SPEED = 0.05;
  const CONNECTION_DISTANCE = 140;
  const CONNECTION_OPACITY = 0.06;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  function createParticle() {
    const size = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE);
    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    const angle = Math.random() * Math.PI * 2;
    const brightness = 140 + Math.floor(Math.random() * 115);

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      size,
      speedX: Math.cos(angle) * speed,
      speedY: Math.sin(angle) * speed,
      opacity: 0.15 + Math.random() * 0.45,
      baseOpacity: 0.15 + Math.random() * 0.45,
      pulseSpeed: 0.002 + Math.random() * 0.004,
      pulsePhase: Math.random() * Math.PI * 2,
      r: brightness,
      g: Math.min(255, brightness + 40 + Math.floor(Math.random() * 30)),
      b: 253,
    };
  }

  function initParticleArray() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle());
    }
  }

  function updateParticle(p, dt) {
    p.x += p.speedX * dt;
    p.y += p.speedY * dt;

    // Pulse opacity
    p.pulsePhase += p.pulseSpeed * dt;
    p.opacity = p.baseOpacity + Math.sin(p.pulsePhase) * 0.15;

    // Wrap around edges with buffer
    if (p.x < -10) p.x = width + 10;
    if (p.x > width + 10) p.x = -10;
    if (p.y < -10) p.y = height + 10;
    if (p.y > height + 10) p.y = -10;
  }

  function drawParticle(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.opacity})`;
    ctx.fill();

    // Glow effect for larger particles
    if (p.size > 1.8) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.opacity * 0.08})`;
      ctx.fill();
    }
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECTION_DISTANCE) {
          const opacity = (1 - dist / CONNECTION_DISTANCE) * CONNECTION_OPACITY;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(147, 197, 253, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animate(timestamp) {
    const dt = lastTime ? Math.min(timestamp - lastTime, 50) : 16;
    lastTime = timestamp;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      updateParticle(particles[i], dt);
      drawParticle(particles[i]);
    }

    drawConnections();

    animationId = requestAnimationFrame(animate);
  }

  // Throttled resize handler
  let resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
    }, 150);
  });

  // Handle page visibility to pause when hidden
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    } else {
      if (!animationId) {
        lastTime = 0;
        animationId = requestAnimationFrame(animate);
      }
    }
  });

  // Initialize
  resize();
  initParticleArray();
  animationId = requestAnimationFrame(animate);
})();

/* ── Shimmer injection for player cards ──
   Adds a shimmer div to each player-card after they are rendered. */

(function initShimmer() {
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;

        // Handle direct player-card additions
        if (node.classList && node.classList.contains("player-card")) {
          injectShimmer(node);
        }

        // Handle children of added containers
        const cards = node.querySelectorAll ? node.querySelectorAll(".player-card") : [];
        cards.forEach(injectShimmer);
      });
    });
  });

  function injectShimmer(card) {
    if (card.querySelector(".card-shimmer")) return;
    const shimmer = document.createElement("div");
    shimmer.className = "card-shimmer";
    shimmer.setAttribute("aria-hidden", "true");
    card.appendChild(shimmer);
  }

  const grid = document.getElementById("playersGrid");
  if (grid) {
    observer.observe(grid, { childList: true, subtree: true });

    // Handle cards already rendered
    grid.querySelectorAll(".player-card").forEach(injectShimmer);
  }
})();
