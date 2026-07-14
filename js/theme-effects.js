/**
 * ThemeEffectsManager
 * Canvas-based particle effects engine and CSS effect helpers.
 * All canvas effects run in a shared requestAnimationFrame loop.
 * CSS-based effects (fog, wet-glass, lightning) manipulate the DOM directly.
 */

/* ========================================
   BASE
   ======================================== */
class BaseEffect {
  constructor(canvas, ctx) {
    this._canvas = canvas;
    this._ctx = ctx;
  }
  init()       {}
  update()     {}
  destroy()    {}
}

/* ========================================
   RAIN
   ======================================== */
class RainEffect extends BaseEffect {
  constructor(canvas, ctx, opts = {}) {
    super(canvas, ctx);
    this._count    = opts.count    || 180;
    this._speedMin = opts.speedMin || 10;
    this._speedMax = opts.speedMax || 18;
    this._angleDeg = opts.angle    || 20;
    this._drops    = [];
  }

  init() {
    for (let i = 0; i < this._count; i++) {
      this._drops.push(this._makeDrop(false));
    }
  }

  _makeDrop(fromTop) {
    const { width, height } = this._canvas;
    return {
      x:       Math.random() * width * 1.3,
      y:       fromTop ? -Math.random() * 120 : Math.random() * height,
      length:  9 + Math.random() * 14,
      speed:   this._speedMin + Math.random() * (this._speedMax - this._speedMin),
      opacity: 0.15 + Math.random() * 0.28,
    };
  }

  update() {
    const ctx = this._ctx;
    const rad = (this._angleDeg * Math.PI) / 180;
    const sinA = Math.sin(rad);
    const cosA = Math.cos(rad);

    ctx.save();
    ctx.strokeStyle = 'rgba(180, 220, 255, 1)';
    ctx.lineWidth   = 0.7;
    ctx.lineCap     = 'round';

    for (const d of this._drops) {
      ctx.globalAlpha = d.opacity;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + sinA * d.length, d.y + cosA * d.length);
      ctx.stroke();

      d.x += sinA * d.speed;
      d.y += cosA * d.speed;

      if (d.y > this._canvas.height + 40 || d.x > this._canvas.width + 40) {
        Object.assign(d, this._makeDrop(true));
        d.x = Math.random() * this._canvas.width * 0.85;
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/* ========================================
   HEAVY RAIN
   ======================================== */
class HeavyRainEffect extends RainEffect {
  constructor(canvas, ctx) {
    super(canvas, ctx, { count: 320, speedMin: 20, speedMax: 30, angle: 25 });
  }
}

/* ========================================
   LIGHTNING
   ======================================== */
class LightningEffect extends BaseEffect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this._timer   = null;
    this._overlay = null;
  }

  init() {
    this._overlay = document.createElement('div');
    Object.assign(this._overlay.style, {
      position:      'fixed',
      inset:         '0',
      zIndex:        '9',
      background:    'rgba(210, 225, 255, 0)',
      pointerEvents: 'none',
      transition:    'background 80ms ease',
    });
    document.body.appendChild(this._overlay);
    this._schedule();
  }

  _schedule() {
    const delay = 3500 + Math.random() * 9000;
    this._timer = setTimeout(() => { this._flash(); this._schedule(); }, delay);
  }

  _flash() {
    if (!this._overlay) return;
    this._overlay.style.background = 'rgba(200, 220, 255, 0.38)';
    setTimeout(() => {
      if (!this._overlay) return;
      this._overlay.style.background = 'rgba(200, 220, 255, 0)';
      /* Sometimes a second flash */
      if (Math.random() > 0.45) {
        setTimeout(() => {
          if (!this._overlay) return;
          this._overlay.style.background = 'rgba(200, 220, 255, 0.28)';
          setTimeout(() => {
            if (this._overlay) this._overlay.style.background = 'rgba(200, 220, 255, 0)';
          }, 70);
        }, 130);
      }
    }, 95);
  }

  destroy() {
    clearTimeout(this._timer);
    this._overlay?.remove();
    this._overlay = null;
  }
}

/* ========================================
   HEARTS (Valentine)
   ======================================== */
class HeartsEffect extends BaseEffect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this._hearts = [];
  }

  init() {
    for (let i = 0; i < 28; i++) this._hearts.push(this._makeHeart());
  }

  _makeHeart() {
    const { width, height } = this._canvas;
    const colors = ['#ff6b9d', '#ff8fab', '#ff4d7d', '#e91e63', '#f06292', '#f48fb1', '#ff80ab'];
    return {
      x:          Math.random() * width,
      y:          height + 20 + Math.random() * 120,
      size:       8 + Math.random() * 18,
      speedY:     0.45 + Math.random() * 0.95,
      opacity:    0.55 + Math.random() * 0.40,
      color:      colors[Math.floor(Math.random() * colors.length)],
      wobble:     Math.random() * Math.PI * 2,
      wobbleSpd:  0.014 + Math.random() * 0.014,
      rotation:   (Math.random() - 0.5) * 0.6,
    };
  }

  /* Parametric heart curve */
  _drawHeart(ctx, cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    const s  = size / 17;
    let first = true;
    for (let t = 0; t <= Math.PI * 2 + 0.05; t += 0.05) {
      const x =  s * 16 * Math.pow(Math.sin(t), 3);
      const y = -s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.restore();
  }

  update() {
    const ctx = this._ctx;
    for (const h of this._hearts) {
      ctx.save();
      ctx.globalAlpha = h.opacity;
      ctx.fillStyle   = h.color;
      ctx.translate(h.x + Math.sin(h.wobble) * 22, h.y);
      ctx.rotate(h.rotation);
      this._drawHeart(ctx, 0, 0, h.size);
      ctx.fill();
      ctx.restore();

      h.y        -= h.speedY;
      h.wobble   += h.wobbleSpd;
      h.opacity  -= 0.00055;

      if (h.y < -70 || h.opacity <= 0) Object.assign(h, this._makeHeart());
    }
    ctx.globalAlpha = 1;
  }
}

/* ========================================
   SNOW (Christmas)
   ======================================== */
class SnowEffect extends BaseEffect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this._flakes = [];
  }

  init() {
    for (let i = 0; i < 130; i++) this._flakes.push(this._makeFlake(false));
  }

  _makeFlake(fromTop) {
    const { width, height } = this._canvas;
    return {
      x:         Math.random() * width,
      y:         fromTop ? -10 : Math.random() * height,
      r:         1.2 + Math.random() * 3.5,
      speed:     0.35 + Math.random() * 1.2,
      drift:     (Math.random() - 0.5) * 0.45,
      opacity:   0.35 + Math.random() * 0.55,
      wobble:    Math.random() * Math.PI * 2,
      wobbleSpd: 0.007 + Math.random() * 0.013,
    };
  }

  update() {
    const ctx    = this._ctx;
    const canvas = this._canvas;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';

    for (const f of this._flakes) {
      ctx.globalAlpha = f.opacity;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();

      f.y        += f.speed;
      f.x        += Math.sin(f.wobble) * 0.55 + f.drift;
      f.wobble   += f.wobbleSpd;

      if (f.y > canvas.height + 20) Object.assign(f, this._makeFlake(true));
    }
    ctx.globalAlpha = 1;
  }
}

/* ========================================
   FIREWORKS (New Year)
   ======================================== */
class FireworksEffect extends BaseEffect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this._rockets   = [];
    this._particles = [];
    this._timer     = null;
  }

  init()    { this._scheduleLaunch(); }

  _scheduleLaunch() {
    const delay = 700 + Math.random() * 1400;
    this._timer = setTimeout(() => { this._launch(); this._scheduleLaunch(); }, delay);
  }

  _launch() {
    const { width, height } = this._canvas;
    const COLORS = ['#FFD700','#FF6B6B','#4ECDC4','#F7FFF7','#FFE66D','#A8DADC','#FF9F1C','#FFFFFF','#DDA0DD'];
    this._rockets.push({
      x:       width  * (0.15 + Math.random() * 0.70),
      y:       height,
      targetY: height * (0.07 + Math.random() * 0.38),
      speed:   9 + Math.random() * 5,
      color:   COLORS[Math.floor(Math.random() * COLORS.length)],
      trail:   [],
    });
  }

  _burst(x, y, color) {
    const count = 75 + Math.floor(Math.random() * 55);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const spd   = 1.5 + Math.random() * 4.8;
      this._particles.push({
        x, y,
        vx:      Math.cos(angle) * spd,
        vy:      Math.sin(angle) * spd,
        color,
        opacity: 1,
        size:    1.5 + Math.random() * 2.5,
        gravity: 0.048 + Math.random() * 0.04,
        drag:    0.972,
        fade:    0.010 + Math.random() * 0.008,
      });
    }
  }

  update() {
    const ctx = this._ctx;

    /* Rockets */
    for (let i = this._rockets.length - 1; i >= 0; i--) {
      const r = this._rockets[i];
      r.trail.push({ x: r.x, y: r.y });
      if (r.trail.length > 14) r.trail.shift();

      r.trail.forEach((t, idx) => {
        ctx.globalAlpha = (idx / r.trail.length) * 0.7;
        ctx.fillStyle   = r.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      });

      r.y -= r.speed;
      if (r.y <= r.targetY) {
        this._burst(r.x, r.y, r.color);
        this._rockets.splice(i, 1);
      }
    }

    /* Burst particles */
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
      ctx.fill();

      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.opacity -= p.fade;
      p.size    *= 0.993;

      if (p.opacity <= 0) this._particles.splice(i, 1);
    }

    ctx.globalAlpha = 1;
  }

  destroy() {
    clearTimeout(this._timer);
    this._rockets   = [];
    this._particles = [];
  }
}

/* ========================================
   FOG (CSS-based DOM layers)
   ======================================== */
class FogEffect extends BaseEffect {
  constructor() {
    super(null, null);
    this._layers = [];
  }

  init() {
    const defs = [
      { left: '-15%', top: '8%',  w: '75%', h: '38%', dur: 28, del: 0,   op: 0.14, blur: 85  },
      { left: '25%',  top: '38%', w: '85%', h: '48%', dur: 38, del: -13, op: 0.10, blur: 105 },
      { left: '-8%',  top: '58%', w: '65%', h: '33%', dur: 22, del: -7,  op: 0.11, blur: 75  },
      { left: '48%',  top: '0%',  w: '58%', h: '28%', dur: 33, del: -20, op: 0.08, blur: 95  },
    ];

    defs.forEach((d, i) => {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position:         'fixed',
        left:             d.left,
        top:              d.top,
        width:            d.w,
        height:           d.h,
        background:       `radial-gradient(ellipse, rgba(180, 195, 222, ${d.op * 1.6}) 0%, transparent 70%)`,
        filter:           `blur(${d.blur}px)`,
        pointerEvents:    'none',
        zIndex:           '2',
        animation:        `fogDrift${i % 2 === 0 ? 'A' : 'B'} ${d.dur}s ease-in-out ${d.del}s infinite`,
        willChange:       'transform',
      });
      document.body.appendChild(el);
      this._layers.push(el);
    });
  }

  destroy() {
    this._layers.forEach(el => el.remove());
    this._layers = [];
  }
}

/* ========================================
   CONFETTI (Birthday / Celebration)
   ======================================== */
class ConfettiEffect extends BaseEffect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this._pieces = [];
  }

  init() {
    for (let i = 0; i < 90; i++) this._pieces.push(this._makePiece(false));
  }

  _makePiece(fromTop) {
    const { width, height } = this._canvas;
    const COLORS = [
      '#FF6B6B','#FFD700','#4ECDC4','#A8DADC','#FF9F1C',
      '#6C5CE7','#fd79a8','#00B894','#FFEAA7','#74B9FF','#FF4081',
    ];
    return {
      x:         Math.random() * width,
      y:         fromTop ? -15 : Math.random() * height,
      w:         5 + Math.random() * 8,
      h:         3 + Math.random() * 4,
      color:     COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation:  Math.random() * Math.PI * 2,
      rotSpd:    (Math.random() - 0.5) * 0.15,
      speedY:    2.0 + Math.random() * 3.0,
      drift:     (Math.random() - 0.5) * 1.5,
      opacity:   0.70 + Math.random() * 0.30,
      wobble:    Math.random() * Math.PI * 2,
      wobbleSpd: 0.03 + Math.random() * 0.03,
    };
  }

  update() {
    const ctx    = this._ctx;
    const canvas = this._canvas;
    for (const p of this._pieces) {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle   = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();

      p.y        += p.speedY;
      p.x        += Math.sin(p.wobble) * 1.2 + p.drift;
      p.rotation += p.rotSpd;
      p.wobble   += p.wobbleSpd;

      if (p.y > canvas.height + 20) Object.assign(p, this._makePiece(true));
    }
    ctx.globalAlpha = 1;
  }
}

/* ========================================
   PETALS (Anniversary / Romance)
   ======================================== */
class PetalsEffect extends BaseEffect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this._petals = [];
  }

  init() {
    for (let i = 0; i < 35; i++) this._petals.push(this._makePetal(false));
  }

  _makePetal(fromTop) {
    const { width, height } = this._canvas;
    const COLORS = ['#FF6B9D','#FF8FAB','#FFACC7','#FFB3C6','#E91E63','#F48FB1','#F8BBD0','#CE93D8'];
    return {
      x:         Math.random() * width,
      y:         fromTop ? -25 : Math.random() * height,
      rx:        5 + Math.random() * 10,   /* petal horizontal radius */
      ry:        9 + Math.random() * 14,   /* petal vertical radius */
      color:     COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation:  Math.random() * Math.PI * 2,
      rotSpd:    (Math.random() - 0.5) * 0.03,
      speedY:    0.55 + Math.random() * 0.95,
      wobble:    Math.random() * Math.PI * 2,
      wobbleSpd: 0.013 + Math.random() * 0.013,
      opacity:   0.45 + Math.random() * 0.45,
    };
  }

  update() {
    const ctx    = this._ctx;
    const canvas = this._canvas;
    for (const p of this._petals) {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle   = p.color;
      ctx.translate(p.x + Math.sin(p.wobble) * 18, p.y);
      ctx.rotate(p.rotation);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      p.y        += p.speedY;
      p.wobble   += p.wobbleSpd;
      p.rotation += p.rotSpd;

      if (p.y > canvas.height + 30) Object.assign(p, this._makePetal(true));
    }
    ctx.globalAlpha = 1;
  }
}

/* ========================================
   LANTERNS (Idul Fitri / Idul Adha)
   ======================================== */
class LanternsEffect extends BaseEffect {
  constructor(canvas, ctx) {
    super(canvas, ctx);
    this._lanterns = [];
  }

  init() {
    for (let i = 0; i < 14; i++) this._lanterns.push(this._makeLantern());
  }

  _makeLantern() {
    const { width, height } = this._canvas;
    const PALETTE = [
      { r: 255, g: 210, b: 0   },  /* gold */
      { r: 255, g: 155, b: 0   },  /* amber */
      { r: 255, g: 90,  b: 30  },  /* orange-red */
      { r: 255, g: 240, b: 130 },  /* pale gold */
    ];
    const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    return {
      x:         Math.random() * width,
      y:         height + 40 + Math.random() * 250,
      w:         14 + Math.random() * 16,
      h:         20 + Math.random() * 18,
      r: c.r, g: c.g, b: c.b,
      speedY:    0.35 + Math.random() * 0.75,
      drift:     (Math.random() - 0.5) * 0.38,
      wobble:    Math.random() * Math.PI * 2,
      wobbleSpd: 0.008 + Math.random() * 0.012,
      opacity:   0.50 + Math.random() * 0.45,
      flicker:   Math.random() * Math.PI * 2,
      flickerSpd: 0.05 + Math.random() * 0.08,
    };
  }

  _draw(ctx, l) {
    const { w, h, r, g, b, flicker } = l;
    const glowA = 0.28 + Math.sin(flicker) * 0.10;

    /* Outer glow */
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.6);
    grd.addColorStop(0, `rgba(${r},${g},${b},${glowA + 0.20})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 1.6, h * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Body */
    ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.46, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Top cap */
    ctx.fillStyle = `rgba(${Math.min(r+40,255)},${Math.min(g+40,255)},${Math.min(b+40,255)},0.5)`;
    ctx.fillRect(-w * 0.28, -h * 0.50, w * 0.56, h * 0.10);

    /* Bottom cap */
    ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
    ctx.fillRect(-w * 0.20, h * 0.42, w * 0.40, h * 0.09);

    /* String */
    ctx.strokeStyle = `rgba(${r},${Math.floor(g*0.7)},0,0.50)`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.50);
    ctx.lineTo(0, -h * 0.68);
    ctx.stroke();
  }

  update() {
    const ctx    = this._ctx;
    const canvas = this._canvas;
    for (const l of this._lanterns) {
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.translate(l.x + Math.sin(l.wobble) * 14, l.y);
      this._draw(ctx, l);
      ctx.restore();

      l.y       -= l.speedY;
      l.x       += l.drift;
      l.wobble  += l.wobbleSpd;
      l.flicker += l.flickerSpd;

      if (l.y < -90) Object.assign(l, this._makeLantern());
    }
    ctx.globalAlpha = 1;
  }
}

/* ========================================
   WET GLASS (CSS class toggle)
   ======================================== */
class WetGlassEffect extends BaseEffect {
  constructor() { super(null, null); }
  init()    { document.body.classList.add('fx-wet-glass'); }
  destroy() { document.body.classList.remove('fx-wet-glass'); }
}

/* ========================================
   EFFECTS MANAGER (orchestrator)
   ======================================== */
export class ThemeEffectsManager {
  constructor(canvas) {
    this._canvas  = canvas;
    this._ctx     = canvas.getContext('2d');
    this._effects = [];
    this._frame   = null;
    this._onResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  /**
   * Start a set of named effects, stopping any currently running ones.
   * @param {string[]} names
   */
  start(names) {
    this.stop();
    this._effects = names.map(n => this._create(n)).filter(Boolean);
    this._effects.forEach(e => e.init());
    this._loop();
  }

  /** Stop all active effects and clear the canvas. */
  stop() {
    if (this._frame) { cancelAnimationFrame(this._frame); this._frame = null; }
    this._effects.forEach(e => e.destroy());
    this._effects = [];
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  _create(name) {
    switch (name) {
      case 'rain':       return new RainEffect(this._canvas, this._ctx);
      case 'heavy-rain': return new HeavyRainEffect(this._canvas, this._ctx);
      case 'lightning':  return new LightningEffect(this._canvas, this._ctx);
      case 'hearts':     return new HeartsEffect(this._canvas, this._ctx);
      case 'snow':       return new SnowEffect(this._canvas, this._ctx);
      case 'fireworks':  return new FireworksEffect(this._canvas, this._ctx);
      case 'confetti':   return new ConfettiEffect(this._canvas, this._ctx);
      case 'petals':     return new PetalsEffect(this._canvas, this._ctx);
      case 'lanterns':   return new LanternsEffect(this._canvas, this._ctx);
      case 'fog':        return new FogEffect();
      case 'wet-glass':  return new WetGlassEffect();
      default:
        console.warn(`[ThemeEffects] Unknown effect: "${name}"`);
        return null;
    }
  }

  _loop() {
    const { _ctx: ctx, _canvas: c } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    this._effects.forEach(e => e.update(ctx));
    this._frame = requestAnimationFrame(() => this._loop());
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
  }
}
