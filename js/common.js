// Shared helpers for the page's Three.js scenes: dates, sky maths, and a
// mount() that only renders while a scene is on screen.
window.BDAY = (() => {
  const DAY = 864e5, YEAR = 365.25 * DAY;
  const BIRTH = Date.UTC(1999, 9, 26, 18, 15); // 27 Oct 1999 00:00 NPT
  const J2000 = Date.UTC(2000, 0, 1, 12);
  const rad = Math.PI / 180;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const obliquity = 23.439 * rad;

  // Sun's apparent ecliptic longitude in degrees (low precision, ~0.01°)
  const sunLon = t => {
    const d = (t - J2000) / DAY;
    const L = 280.46 + 0.9856474 * d, g = (357.528 + 0.9856003 * d) * rad;
    return ((L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360 + 360) % 360;
  };
  const gmst = t => ((280.46061837 + 360.98564736629 * (t - J2000) / DAY) % 360 + 360) % 360;

  // Moon phase as 0..1 (0 new, 0.5 full), from Meeus' low-precision phase angle
  const phase = t => {
    const T = (t - J2000) / DAY / 36525;
    const D = ((297.8501921 + 445267.1114034 * T) % 360 + 360) % 360;
    const M = (357.5291092 + 35999.0502909 * T) * rad;
    const Mp = (134.9633964 + 477198.8675055 * T) * rad;
    const i = 180 - D - 6.289 * Math.sin(Mp) + 2.1 * Math.sin(M) - 1.274 * Math.sin(2 * D * rad - Mp)
      - 0.658 * Math.sin(2 * D * rad) - 0.214 * Math.sin(2 * Mp) - 0.11 * Math.sin(D * rad);
    const E = 180 - Math.abs(((i + 180) % 360 + 360) % 360 - 180);
    return D < 180 ? E / 360 : 1 - E / 360;
  };

  // Point on Earth where the Sun is overhead
  const subsolar = t => {
    const lam = sunLon(t) * rad;
    const dec = Math.asin(Math.sin(obliquity) * Math.sin(lam));
    const ra = Math.atan2(Math.cos(obliquity) * Math.sin(lam), Math.cos(lam)) / rad;
    return { lat: dec / rad, lon: ((ra - gmst(t)) % 360 + 540) % 360 - 180 };
  };

  const glowTexture = (stops = [[0, "rgba(255,255,255,1)"], [0.25, "rgba(190,205,255,0.55)"], [1, "rgba(120,140,255,0)"]]) => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  };

  // Browsers allow only a few live WebGL contexts (fewer on phones), so each
  // scene creates its renderer when it nears the screen and frees it after.
  const canWebGL = (() => {
    try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")) } catch (e) { return false }
  })();
  function mount(stage, canvas, { fov = 40, near = 0.1, far = 2000 } = {}) {
    if (!window.THREE || !canWebGL) return null;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(fov, 1, near, far);
    const s = { renderer: null, scene, camera, w: 1, h: 1, update: null, resize: null, clock: 0, seen: false };
    let cv = canvas, visible = false, raf = 0, last = 0;
    const resize = () => {
      if (!s.renderer) return;
      s.w = stage.clientWidth; s.h = stage.clientHeight;
      s.renderer.setSize(s.w, s.h, false);
      camera.aspect = s.w / s.h; camera.updateProjectionMatrix();
      s.resize && s.resize(s.w, s.h);
    };
    const make = () => {
      if (s.renderer) return;
      const fresh = cv.cloneNode(); cv.replaceWith(fresh); cv = fresh;
      try { s.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }) } catch (e) { stage.classList.add("no-gl"); return }
      s.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      resize();
      s.update && s.update(0, s.clock);
      s.renderer.render(scene, camera);
    };
    const drop = () => {
      if (!s.renderer) return;
      cancelAnimationFrame(raf); raf = 0;
      s.renderer.dispose(); s.renderer.forceContextLoss(); s.renderer = null;
    };
    const frame = ms => {
      raf = 0;
      if (!s.renderer || !visible) return;
      const dt = Math.min(0.05, (ms - last) / 1000); last = ms; s.clock += dt;
      s.update && s.update(dt, s.clock);
      s.renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    s.start = () => {
      addEventListener("resize", resize);
      new IntersectionObserver(([e]) => { e.isIntersecting ? make() : drop() }, { rootMargin: "300px 0px" }).observe(stage);
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) s.seen = true;
        if (visible && !raf) { make(); last = performance.now(); raf = requestAnimationFrame(frame) }
      }).observe(stage);
    };
    return s;
  }

  // Drag to turn, tap to pick. Vertical page scrolling still works on touch.
  function pointer(el, { drag, tap } = {}) {
    let down = false, moved = 0, lx = 0, ly = 0;
    el.addEventListener("pointerdown", e => {
      if (e.target.closest("button")) return;
      down = true; moved = 0; lx = e.clientX; ly = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", e => {
      if (!down) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      moved += Math.abs(dx) + Math.abs(dy); lx = e.clientX; ly = e.clientY;
      drag && drag(dx, dy);
    });
    el.addEventListener("pointerup", e => {
      if (!down) return;
      down = false;
      if (moved < 8 && tap) {
        const r = el.getBoundingClientRect();
        tap(e.clientX - r.left, e.clientY - r.top);
      }
    });
    el.addEventListener("pointercancel", () => { down = false });
    return { get down() { return down } };
  }

  // HTML label that follows a 3D point
  function tag(stage, html, cls = "") {
    const el = document.createElement("div");
    el.className = `tag ${cls}`; el.innerHTML = html;
    stage.appendChild(el);
    const v = new THREE.Vector3();
    return {
      el,
      place(world, camera, w, h, show = true) {
        v.copy(world).project(camera);
        const ok = show && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        el.style.opacity = ok ? 1 : 0;
        if (ok) el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -150%)`;
      },
    };
  }

  // Screen-space nearest pick: returns the index of the closest point within maxPx
  function pick(points, camera, w, h, px, py, maxPx = 28) {
    const v = new THREE.Vector3();
    let best = -1, bd = maxPx * maxPx;
    points.forEach((p, i) => {
      v.copy(p).project(camera);
      if (v.z > 1) return;
      const dx = (v.x + 1) / 2 * w - px, dy = (1 - v.y) / 2 * h - py, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i }
    });
    return best;
  }

  const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const fmtDate = (t, opts = { day: "numeric", month: "short", year: "numeric" }) =>
    new Date(t).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", ...opts });

  return { DAY, YEAR, BIRTH, rad, reduce, obliquity, sunLon, gmst, phase, subsolar, glowTexture, mount, pointer, tag, pick, ease, fmtDate };
})();
