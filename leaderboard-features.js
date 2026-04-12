function setupVideoBackground() {
    const videoContainer = document.getElementById('video-background-container');
    if (!videoContainer) return;

    const videoSources = [
        'https://pixabay.com/videos/download/video-31377_medium.mp4',
        'https://pixabay.com/videos/download/video-27902_medium.mp4',
        'https://pixabay.com/videos/download/video-22720_medium.mp4',
        'https://pixabay.com/videos/download/video-79930_large.mp4'
    ];

    const videoElement = document.getElementById('video-background');
    if (videoElement) {
        const randomVideo = videoSources[Math.floor(Math.random() * videoSources.length)];
        const sourceElement = document.createElement('source');
        sourceElement.src = randomVideo;
        sourceElement.type = 'video/mp4';
        videoElement.appendChild(sourceElement);
    }
}

function setupParticleAnimation() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particles = [];

    const particleOptions = {
        count: 50,
        speed: 0.5,
        color: 'rgba(132, 160, 255, 0.5)'
    };

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = (Math.random() * 2 - 1) * particleOptions.speed;
            this.speedY = (Math.random() * 2 - 1) * particleOptions.speed;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.size > 0.2) this.size -= 0.01;

            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }

        draw() {
            ctx.fillStyle = particleOptions.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        for (let i = 0; i < particleOptions.count; i++) {
            particles.push(new Particle());
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }
        requestAnimationFrame(animateParticles);
    }

    initParticles();
    animateParticles();

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particles = [];
        initParticles();
    });
}
