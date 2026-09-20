/** 粒子背景：低帧率自动降级，尊重 prefers-reduced-motion，可手动关闭。 */

const COLORS = ['rgba(124,92,255,', 'rgba(47,216,224,', 'rgba(255,122,195,'];

export function createParticles(canvas) {
  const context = canvas?.getContext?.('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!context) {
    canvas?.setAttribute?.('hidden', 'hidden');
    return { setEnabled() {}, isReduced: () => reduceMotion.matches };
  }
  let particles = [];
  let frame = 0;
  let enabled = false;
  let degraded = false;
  let targetCount = 0;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let lastSample = 0;
  let frames = 0;

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const area = width * height;
    const base = Math.round(area / 16000);
    targetCount = Math.max(18, Math.min(degraded ? 26 : 90, base));
    syncCount();
  }

  function spawn() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      radius: Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.4 + 0.18,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    };
  }

  function syncCount() {
    while (particles.length < targetCount) particles.push(spawn());
    if (particles.length > targetCount) particles.length = targetCount;
  }

  function step(time) {
    if (!enabled) return;
    frames += 1;
    if (!lastSample) lastSample = time;
    if (time - lastSample > 1500) {
      const fps = (frames * 1000) / (time - lastSample);
      frames = 0;
      lastSample = time;
      if (fps < 32 && !degraded) {
        degraded = true;
        targetCount = Math.max(16, Math.round(targetCount * 0.45));
        syncCount();
      } else if (fps < 20 && degraded) {
        stop();
        clear();
        return;
      }
    }

    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < -20) particle.x = width + 20;
      if (particle.x > width + 20) particle.x = -20;
      if (particle.y < -20) particle.y = height + 20;
      if (particle.y > height + 20) particle.y = -20;
      context.beginPath();
      context.fillStyle = `${particle.color}${particle.alpha})`;
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }

    if (!degraded) {
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 130) continue;
          context.beginPath();
          context.strokeStyle = `rgba(124,92,255,${(1 - distance / 130) * 0.12})`;
          context.lineWidth = 1;
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
    }

    frame = requestAnimationFrame(step);
  }

  function clear() {
    context.clearRect(0, 0, width, height);
  }

  function start() {
    if (enabled) return;
    enabled = true;
    canvas.hidden = false;
    resize();
    lastSample = 0;
    frames = 0;
    frame = requestAnimationFrame(step);
  }

  function stop() {
    enabled = false;
    cancelAnimationFrame(frame);
    canvas.hidden = true;
    clear();
  }

  window.addEventListener('resize', () => {
    if (enabled) resize();
  });

  reduceMotion.addEventListener?.('change', () => {
    if (reduceMotion.matches) stop();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(frame);
    else if (enabled) frame = requestAnimationFrame(step);
  });

  return {
    setEnabled(next) {
      if (next && !reduceMotion.matches) start();
      else stop();
    },
    isReduced: () => reduceMotion.matches
  };
}
