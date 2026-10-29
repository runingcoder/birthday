// Blindfold: one 3x3 that scrambles, memorises, solves with its stickers
// hidden, then shows itself. Below it, the 2019 multi-blind: ten cubes,
// 47:29 compressed, nine solved and one missed.
(() => {
  const B = window.BDAY, stage = document.getElementById("cube-stage");
  if (!stage || !window.THREE) return;
  const s = B.mount(stage, document.getElementById("cube"), { fov: 35 });
  if (!s) { stage.classList.add("no-gl"); return }
  const { scene, camera } = s;
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.85); key.position.set(5, 8, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0x8090ff, 0.3); fill.position.set(-6, -2, -4); scene.add(fill);

  const COLORS = { px: 0xd8443a, nx: 0xf08a2a, py: 0xeeece4, ny: 0xf3d23f, pz: 0x2fa86b, nz: 0x2f6fd6 };
  const mats = Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 })]));
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e2346, roughness: 0.6 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x090b16, roughness: 0.7 });
  const bodyGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96), stGeo = new THREE.PlaneGeometry(0.8, 0.8);
  const FACES = [["px", [0.485, 0, 0], [0, Math.PI / 2, 0]], ["nx", [-0.485, 0, 0], [0, -Math.PI / 2, 0]],
    ["py", [0, 0.485, 0], [-Math.PI / 2, 0, 0]], ["ny", [0, -0.485, 0], [Math.PI / 2, 0, 0]],
    ["pz", [0, 0, 0.485], [0, 0, 0]], ["nz", [0, 0, -0.485], [0, Math.PI, 0]]];

  function Cube() {
    const group = new THREE.Group(), cubies = [], stickers = [], pivot = new THREE.Group();
    group.add(pivot);
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if (!x && !y && !z) continue;
      const c = new THREE.Group();
      c.add(new THREE.Mesh(bodyGeo, bodyMat));
      FACES.forEach(([k, p, r]) => {
        const ax = k[1], sg = k[0] === "p" ? 1 : -1;
        if ({ x, y, z }[ax] !== sg) return;
        const st = new THREE.Mesh(stGeo, mats[k]);
        st.position.set(...p); st.rotation.set(...r); st.userData.mat = mats[k];
        c.add(st); stickers.push(st);
      });
      c.position.set(x, y, z); c.userData.home = c.position.clone();
      cubies.push(c); group.add(c);
    }
    let queue = [], cur = null;
    const begin = m => {
      pivot.rotation.set(0, 0, 0); pivot.updateMatrixWorld();
      m.sel = cubies.filter(c => Math.round(c.position[m.axis]) === m.layer);
      m.sel.forEach(c => pivot.attach(c));
      m.k = 0;
    };
    const end = m => {
      pivot.rotation[m.axis] = m.dir * Math.PI / 2; pivot.updateMatrixWorld();
      m.sel.forEach(c => {
        group.attach(c);
        c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z));
        c.quaternion.normalize();
      });
      pivot.rotation.set(0, 0, 0);
    };
    return {
      group,
      turn(m, dur) { queue.push({ ...m, dur }) },
      instant(m) { begin(m); end(m) },
      busy: () => !!cur || queue.length > 0,
      blind(on) { stickers.forEach(st => { st.material = on ? dark : st.userData.mat }) },
      reset() { queue = []; cur = null; cubies.forEach(c => { group.attach(c); c.position.copy(c.userData.home); c.quaternion.identity() }) },
      update(dt) {
        if (!cur && queue.length) { cur = queue.shift(); begin(cur) }
        if (!cur) return;
        cur.k = Math.min(1, cur.k + dt / cur.dur);
        pivot.rotation[cur.axis] = cur.dir * Math.PI / 2 * B.ease(cur.k);
        if (cur.k >= 1) { end(cur); cur = null }
      },
    };
  }
  const AXES = ["x", "y", "z"];
  const scramble = n => {
    const out = []; let prev = "";
    while (out.length < n) {
      const axis = AXES[Math.floor(Math.random() * 3)];
      if (axis === prev) continue;
      prev = axis;
      out.push({ axis, layer: Math.random() < 0.5 ? -1 : 1, dir: Math.random() < 0.5 ? -1 : 1 });
    }
    return out;
  };

  // The big cube
  const big = Cube();
  big.group.position.set(0, 1.35, 0);
  big.group.rotation.set(0.5, -0.7, 0);
  scene.add(big.group);
  const capK = stage.querySelector(".cap .k"), capT = stage.querySelector(".cap .t"), capD = stage.querySelector(".cap .d");
  const PB = 107.32; // 1:47.32
  const fmt = sec => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(2).padStart(5, "0")}`;
  let phase = "start", pt = 0, moves = [], timer = 0;
  const go = p => { phase = p; pt = 0 };

  // The multi-blind row
  const MISS = 6, row = [];
  for (let i = 0; i < 10; i++) {
    const c = Cube();
    c.group.scale.setScalar(0.27);
    scene.add(c.group);
    row.push({ c, at: 0, done: false, spin: -1 });
  }
  const mK = stage.querySelector(".mcap .k"), mT = stage.querySelector(".mcap .t");
  const missTag = B.tag(stage, "missed", "miss");
  let multi = -1;
  const cover = () => {
    row.forEach((r, i) => {
      r.c.reset(); scramble(18).forEach(m => r.c.instant(m)); r.c.blind(true);
      r.done = false; r.spin = -1; r.c.group.rotation.set(0.45, -0.6 + i * 0.07, 0);
    });
    const times = Array.from({ length: 10 }, () => 0.12 + Math.random() * 0.82).sort((x, y) => x - y);
    row.forEach((r, i) => { r.at = times[i] });
    mK.textContent = "Multi-blind · Nepali Nationals 2019";
    mT.textContent = "0:00 · 0/10";
  };
  cover();
  const runMulti = () => { cover(); multi = 0 };
  document.getElementById("multi-run").addEventListener("click", runMulti);

  s.resize = (w, h) => {
    const asp = w / h, two = asp < 1.15, t = Math.tan(17.5 * B.rad);
    row.forEach((r, i) => {
      const col = two ? i % 5 : i, line = two ? Math.floor(i / 5) : 0, n = two ? 5 : 10;
      r.c.group.position.set((col - (n - 1) / 2) * 1.05, -2.15 - line * 1.15, 0);
    });
    big.group.position.y = two ? 1.7 : 1.35;
    const halfW = two ? 3 : 5.6, halfH = two ? 4.2 : 3.3;
    camera.position.set(0, -0.3, Math.max(halfH / t, halfW / (t * asp)) + 1.5);
    camera.lookAt(0, -0.3, 0);
  };
  B.pointer(stage, { drag: (dx, dy) => { big.group.rotation.y += dx * 0.01; big.group.rotation.x += dy * 0.01 } });

  s.update = (dt, clock) => {
    pt += dt;
    if (!B.reduce) big.group.rotation.y += dt * 0.15;
    if (phase === "start" && s.seen) { moves = scramble(20); moves.forEach(m => big.turn(m, 0.11)); go("scramble") }
    else if (phase === "scramble") {
      capK.textContent = "3x3 blindfolded"; capT.textContent = "Scramble"; capD.textContent = "Twenty random turns.";
      if (!big.busy()) { go("memo"); timer = 0 }
    } else if (phase === "memo") {
      capT.textContent = "Memorise"; capD.textContent = "Every sticker, in your head.";
      if (pt > 2) { big.blind(true); go("solve"); moves.slice().reverse().forEach(m => big.turn({ ...m, dir: -m.dir }, 0.2)) }
    } else if (phase === "solve") {
      capT.textContent = "Blindfold on · solving"; capD.textContent = "No looking. Just memory.";
      if (!big.busy()) { big.blind(false); go("hold") }
    } else if (phase === "hold") {
      capT.textContent = "Blindfold off · solved"; capD.textContent = "Your record: 1:47.32 at Nepal Open 2018. Still #2 in Nepal.";
      if (pt > 3) { big.reset(); go("start") }
    }
    if (phase === "memo" || phase === "solve") timer += dt;
    const span = 2 + 20 * 0.2;
    capK.textContent = `3x3 blindfolded · ${fmt(phase === "hold" ? PB : Math.min(PB, timer / span * PB))}`;
    big.update(dt);

    // Multi-blind: 47:29 in 16 seconds; starts by itself the first time it's seen
    if (multi < 0 && s.seen && clock > 2 && !row.some(r => r.done) && !runMulti.ran) { runMulti.ran = true; runMulti() }
    if (multi >= 0) {
      multi += dt;
      const k = Math.min(1, multi / 16);
      const solved = row.filter((r, i) => r.done && i !== MISS).length;
      mT.textContent = `${fmt(2849 * k).replace(/\.\d+$/, "")} · ${solved}/10`;
      row.forEach((r, i) => {
        if (!r.done && k >= r.at) { r.done = true; r.spin = 0; if (i === MISS) r.c.blind(false) }
        if (r.spin >= 0 && i !== MISS) {
          r.spin += dt;
          const sk = Math.min(1, r.spin / 0.6);
          r.c.group.rotation.y = -0.6 + i * 0.07 + B.ease(sk) * Math.PI * 2;
          if (sk >= 0.5 && r.spin - dt < 0.3) { r.c.reset(); r.c.blind(false) }
          if (sk >= 1) r.spin = -1;
        }
      });
      if (k >= 1 && row.every(r => r.spin < 0)) { multi = -1; mT.textContent = "47:29 · 9/10 · still #1 in Nepal" }
    }
    row.forEach(r => r.c.update(dt));
    const m = row[MISS];
    missTag.place(m.c.group.getWorldPosition(new THREE.Vector3()), camera, s.w, s.h, m.done && m.spin < 0);
  };
  s.start();
})();
