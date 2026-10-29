// 27 laps: Earth's path since your birth, drawn as a spiral because the Sun
// drifts through the galaxy while Earth circles it. Real orbital position,
// real Moon phase, Banepa on the right side of day and night.
(() => {
  const B = window.BDAY, stage = document.getElementById("orbit-stage");
  if (!stage || !window.THREE) return;
  const s = B.mount(stage, document.getElementById("orbit"), { fov: 38 });
  if (!s) { stage.classList.add("no-gl"); return }
  const { scene, camera } = s, rad = B.rad;
  const NOW = Date.now(), R = 9, PITCH = 1.35;
  const yAt = t => (t - B.BIRTH) / B.YEAR * PITCH;
  const H = yAt(NOW);
  const lonE = t => (B.sunLon(t) + 180) * rad;
  const at = (t, v = new THREE.Vector3()) => v.set(R * Math.cos(lonE(t)), yAt(t), -R * Math.sin(lonE(t)));
  const root = new THREE.Group();
  root.position.y = -H / 2;
  scene.add(root);

  // The spiral, old laps in indigo warming to marigold
  const N = 27 * 160, pts = [], cols = [];
  const c0 = new THREE.Color(0x343b7d), c1 = new THREE.Color(0xf3a730), v = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    at(B.BIRTH + (NOW - B.BIRTH) * i / N, v);
    pts.push(v.x, v.y, v.z);
    const c = c0.clone().lerp(c1, Math.pow(i / N, 1.8));
    cols.push(c.r, c.g, c.b);
  }
  const hg = new THREE.BufferGeometry();
  hg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  hg.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  root.add(new THREE.Line(hg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));

  // The Sun's own path, straight up the middle
  const ag = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, H, 0)]);
  root.add(new THREE.Line(ag, new THREE.LineBasicMaterial({ color: 0x5a5f9a, transparent: true, opacity: 0.35 })));

  const sun = new THREE.Group();
  sun.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 20), new THREE.MeshBasicMaterial({ color: 0xffe3ad })));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: B.glowTexture([[0, "rgba(255,226,160,1)"], [0.3, "rgba(243,167,48,0.45)"], [1, "rgba(243,167,48,0)"]]),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.setScalar(9);
  sun.add(halo);
  const light = new THREE.PointLight(0xfff1d6, 2.4, 0, 0);
  sun.add(light);
  root.add(sun);
  scene.add(new THREE.AmbientLight(0x3c4680, 0.28));

  // Earth (not to scale), its axis, the Banepa pin, and the Moon
  const earth = new THREE.Group();
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 48, 32), new THREE.MeshStandardMaterial({ color: 0x4677e0, roughness: 0.75, emissive: 0x070b26 })));
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf3a730 }));
  earth.add(pin);
  const pole = new THREE.Vector3(0, Math.cos(B.obliquity), -Math.sin(B.obliquity));
  earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pole.clone().multiplyScalar(-1.25), pole.clone().multiplyScalar(1.25)]),
    new THREE.LineBasicMaterial({ color: 0x9ba0c4, transparent: true, opacity: 0.5 })));
  root.add(earth);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshStandardMaterial({ color: 0xd9d2bf, roughness: 1 }));
  root.add(moon);

  // Direction of a place on Earth, in scene space, at time t
  const surface = (lat, lon, t) => {
    const p = lat * rad, th = (lon + B.gmst(t)) * rad, e = B.obliquity;
    const x = Math.cos(p) * Math.cos(th), y = Math.cos(p) * Math.sin(th), z = Math.sin(p);
    return new THREE.Vector3(x, -y * Math.sin(e) + z * Math.cos(e), -(y * Math.cos(e) + z * Math.sin(e)));
  };

  function placeAll(t, spin) {
    at(t, earth.position);
    sun.position.y = yAt(t);
    const lm = (B.sunLon(t) + B.phase(t) * 360) * rad;
    moon.position.copy(earth.position).add(new THREE.Vector3(Math.cos(lm), 0, -Math.sin(lm)).multiplyScalar(1.9));
    pin.visible = spin;
    if (spin) pin.position.copy(surface(27.63, 85.52, t)).multiplyScalar(0.79);
  }

  // Beads: every 27 October, plus the year's milestones
  const day = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), 6, 15);
  const EVENTS = [
    ["1999-10-27", "Born", "A Wednesday, in the Kingdom of Nepal, a few nights after Kojagrat Purnima."],
    ["2008-05-28", "Nepal becomes a republic", "You are 8."],
    ["2016-01-16", "First WCA competition", "Nepal Open 2016, Kathmandu. You are 16."],
    ["2017-08-12", "4.13 on 2x2", "Cube Jatra 2017, in a round you averaged 9.10."],
    ["2017-12-24", "First national record", "3x3 blindfolded in 3:12.04 at Nepal Open 2017."],
    ["2018-08-25", "Another blindfold record", "2:11.73 at Cube Mahotsav 2018."],
    ["2018-11-23", "Two records in Dhulikhel", "1:47.32 blindfolded and 5/7 multi-blind at Nepal Open 2018."],
    ["2019-02-01", "Pulchowk Campus", "Electronics, Communication & Information Engineering begins."],
    ["2019-05-24", "9 of 10, blindfolded", "47:29 at Nepali Nationals 2019. Still Nepal's #1."],
    ["2020-02-21", "Last competition", "Blindfolded gold at Bhanu Bhakta Cube Open 2020."],
    ["2020-06-04", "First logged run", "The start of 1,976 km."],
    ["2021-01-15", "First job, at 21", "Junior Backend Developer at Axios Softworks, Banepa."],
    ["2021-11-05", "Belated birthday run", "About 27 km. Your longest."],
    ["2023-05-31", "Graduates from Pulchowk", "Four years of engineering, done."],
    ["2023-07-01", "Backend Engineer at Ayata", "WHO's health information system, AshaConnect, Medipuzzle."],
    ["2025-01-17", "Back on the road", "The first run after a 518-day break."],
    ["2025-07-01", "Senior Backend Engineer", "Altus Minds LLC, remote for Fremont. Age 25."],
    ["2025-10-10", "Birthday run", "7.9 km on your lunar birthday."],
    ["2026-01-07", "“2026 will be something.”", "A run title, on 7 January."],
  ].map(([iso, t, d]) => ({ t: day(iso), title: t, text: d }));
  const beads = [];
  const bdayMat = new THREE.MeshBasicMaterial({ color: 0xf3a730 }), evMat = new THREE.MeshBasicMaterial({ color: 0xece5d3 });
  const bg = new THREE.SphereGeometry(0.15, 12, 8), eg = new THREE.SphereGeometry(0.19, 12, 8);
  for (let y = 2000; y <= 2026; y++) {
    const t = Date.UTC(y, 9, 26, 18, 15), m = new THREE.Mesh(bg, bdayMat);
    at(t, m.position); root.add(m);
    beads.push({ mesh: m, t, title: `Turned ${y - 1999}`, text: `27 October ${y}. Lap ${y - 1999} complete.`, bday: true });
  }
  EVENTS.forEach(e => {
    const m = new THREE.Mesh(eg, evMat);
    at(e.t, m.position); root.add(m);
    beads.push({ mesh: m, ...e });
  });

  // Captions and labels
  const cap = stage.querySelector(".cap");
  const capK = cap.querySelector(".k"), capT = cap.querySelector(".t"), capD = cap.querySelector(".d");
  const fmtKm = t => Math.floor((t - B.BIRTH) / 1000 * 29.78).toLocaleString("en-US");
  const idle = () => {
    capK.textContent = "Lap 27 · today";
    capT.textContent = "You are here";
    capD.textContent = `${fmtKm(Date.now())} km around the Sun so far. The orange beads are your birthdays; tap any bead.`;
  };
  const show = b => {
    capK.textContent = B.fmtDate(b.t);
    capT.textContent = b.title;
    capD.textContent = b.text;
  };
  const tToday = B.tag(stage, "Today · Banepa", "gold"), tBorn = B.tag(stage, "Born · 1999");
  idle();

  // Camera: slow orbit, drag to turn
  let theta = 0.9, phi = 0.32, dist = 60, target = 0, rewind = -1, lastShown = null;
  const ptr = B.pointer(stage, {
    drag: (dx, dy) => { theta -= dx * 0.006; phi = Math.min(1.2, Math.max(-0.2, phi + dy * 0.004)) },
    tap: (x, y) => {
      if (rewind >= 0) return;
      const i = B.pick(beads.map(b => b.mesh.getWorldPosition(new THREE.Vector3())), camera, s.w, s.h, x, y);
      if (i >= 0) { show(beads[i]); lastShown = beads[i] }
      else { idle(); lastShown = null }
    },
  });
  s.resize = (w, h) => {
    const t = Math.tan(19 * rad);
    dist = Math.max(23 / t, 12.5 / (t * Math.min(1, w / h)));
  };

  const btn = document.getElementById("rewind");
  btn.addEventListener("click", () => { rewind = 0; btn.disabled = true });
  const REWIND = 15;

  s.update = (dt, clock) => {
    let t = NOW;
    if (rewind >= 0) {
      rewind += dt;
      const k = Math.min(1, rewind / REWIND);
      t = B.BIRTH + (NOW - B.BIRTH) * B.ease(k);
      hg.setDrawRange(0, Math.max(2, Math.round(N * (t - B.BIRTH) / (NOW - B.BIRTH))));
      const past = beads.filter(b => !b.bday && b.t <= t).pop();
      const age = Math.floor((t - B.BIRTH) / B.YEAR);
      capK.textContent = `${new Date(t).getUTCFullYear()} · lap ${Math.min(27, age + 1)} · age ${age}`;
      if (past) { capT.textContent = past.title; capD.textContent = past.text }
      else { capT.textContent = "Born"; capD.textContent = EVENTS[0].text }
      target = (yAt(t) - H / 2) * 0.7;
      if (k >= 1) { rewind = -1; btn.disabled = false; hg.setDrawRange(0, Infinity); idle() }
    } else {
      target += (0 - target) * Math.min(1, dt * 2);
    }
    placeAll(t, rewind < 0);
    if (!B.reduce && !ptr.down) theta += dt * 0.045;
    const cp = Math.cos(phi);
    camera.position.set(dist * cp * Math.sin(theta), target + dist * Math.sin(phi), dist * cp * Math.cos(theta));
    camera.lookAt(0, target, 0);
    const pulse = 1 + 0.25 * Math.sin(clock * 3);
    beads.forEach(b => b.mesh.scale.setScalar(b === lastShown ? 1.8 : b.bday && !B.reduce ? pulse * 0.9 : 1));
    tToday.place(earth.getWorldPosition(new THREE.Vector3()), camera, s.w, s.h, rewind < 0);
    tBorn.place(beads.find(b => b.title === "Born").mesh.getWorldPosition(new THREE.Vector3()), camera, s.w, s.h, rewind < 0);
  };
  s.start();
})();
