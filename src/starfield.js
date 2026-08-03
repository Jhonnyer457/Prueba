// Fondo de estrellas sutil, en tonos violeta/blanco, con parpadeo y
// deriva lenta. Corre en un <canvas> fijo detrás de toda la interfaz.
// Pensado para ser liviano (pocas estrellas, sin librerías externas).

let ctx, canvas, stars = [], running = false;

function rand(min, max) { return Math.random() * (max - min) + min; }

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function makeStars() {
  const count = Math.min(120, Math.floor((window.innerWidth * window.innerHeight) / 9000));
  stars = Array.from({ length: count }, () => ({
    x: rand(0, window.innerWidth),
    y: rand(0, window.innerHeight),
    r: rand(0.5, 1.6),
    baseAlpha: rand(0.25, 0.9),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.4, 1.2),
    drift: rand(-0.04, 0.06),
    violet: Math.random() < 0.35,
  }));
}

let t = 0;
function frame() {
  if (!running) return;
  t += 0.016;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const s of stars) {
    const twinkle = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
    const alpha = s.baseAlpha * (0.35 + 0.65 * twinkle);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = s.violet
      ? `rgba(167,139,250,${alpha.toFixed(3)})`
      : `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.fill();

    s.y += s.drift;
    if (s.y > window.innerHeight + 4) s.y = -4;
    if (s.y < -4) s.y = window.innerHeight + 4;
  }
  requestAnimationFrame(frame);
}

export function initStarfield() {
  if (canvas) return; // ya inicializado
  canvas = document.createElement('canvas');
  canvas.id = 'starfield';
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '0',
    pointerEvents: 'none',
  });
  document.body.prepend(canvas);
  ctx = canvas.getContext('2d');
  resize();
  makeStars();
  running = true;
  requestAnimationFrame(frame);

  window.addEventListener('resize', () => {
    resize();
    makeStars();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  });
}
