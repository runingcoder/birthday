// 5.72 m, side on: run-up, take-off at 20°, flight, landing, with a ghost of
// the 8.95 m world record. Flight follows projectile physics for your mark.
(() => {
  const B = window.BDAY, stage = document.getElementById("jump-stage");
  if (!stage || !window.THREE) return;
  const s = B.mount(stage, document.getElementById("jump"), { fov: 30 });
  if (!s) { stage.classList.add("no-gl"); return }
  const { scene, camera } = s, g = 9.81, th = 20 * B.rad;

  // Track, board, pit and tape (1 unit = 1 m; the board's front edge is x = 0)
  const box = (w, h, d, c, x, y = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c }));
    m.position.set(x, y, 0); scene.add(m); return m;
  };
  box(40, 0.04, 1.3, 0x1a2048, -20, -0.02);
  box(0.2, 0.05, 1.3, 0xece5d3, -0.1, 0);
  box(10, 0.06, 2.6, 0x4a3f2c, 5, -0.03);
  for (let m = 1; m <= 9; m++) box(0.02, 0.07, 2.7, 0x9ba0c4, m, 0);
  box(0.035, 0.09, 2.8, 0xf3a730, 5.72, 0.01);
  box(0.035, 0.09, 2.8, 0x9ba0c4, 8.95, 0.01);

  // Two jumpers as glowing orbs (centre of mass), with trails
  const glow = (col) => new THREE.Sprite(new THREE.SpriteMaterial({ map: B.glowTexture(col), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const make = (col, dot, size) => {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), new THREE.MeshBasicMaterial({ color: dot })));
    const gl = glow(col); gl.scale.setScalar(size * 7); grp.add(gl);
    scene.add(grp);
    const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(90 * 3), 3));
    const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: dot, transparent: true, opacity: 0.6 }));
    scene.add(trail);
    return { grp, trail, hist: [] };
  };
  const you = make([[0, "rgba(255,230,170,1)"], [0.3, "rgba(243,167,48,0.5)"], [1, "rgba(243,167,48,0)"]], 0xf3a730, 0.16);
  const ghost = make([[0, "rgba(220,228,255,0.6)"], [1, "rgba(150,170,255,0)"]], 0x8d93c4, 0.1);
  ghost.grp.position.z = -0.6; you.grp.position.z = 0.25;

  // Flight model: take-off 0.3 m past the board at 1.15 m, touchdown at 0.55 m, then 0.5 m to the mark
  const solve = mark => {
    const flight = mark - 0.8; let lo = 1, hi = 15;
    for (let k = 0; k < 50; k++) {
      const v = (lo + hi) / 2, t = flight / (v * Math.cos(th));
      if (1.15 + v * Math.sin(th) * t - g * t * t / 2 < 0.55) lo = v; else hi = v;
    }
    const v = (lo + hi) / 2;
    return { v, air: flight / (v * Math.cos(th)), mark };
  };
  const J = [solve(5.72), solve(8.95)];
  const RUN = 2.4, SLOW = 3;
  const posAt = (j, t) => {
    // run-up: accelerate to take-off speed over the last 14 m
    if (t < RUN) {
      const k = t / RUN, x = -14 + 14.3 * (k * (2 - k) * 0.35 + k * 0.65);
      return [x, 1.05 + Math.abs(Math.sin(t * 9)) * 0.05, false];
    }
    const ft = (t - RUN) / SLOW;
    if (ft < j.air) {
      const x = 0.3 + j.v * Math.cos(th) * ft, y = 1.15 + j.v * Math.sin(th) * ft - g * ft * ft / 2;
      return [x, y, false];
    }
    const lt = Math.min(1, (ft - j.air) / 0.35);
    const x0 = 0.3 + j.v * Math.cos(th) * j.air;
    return [x0 + (j.mark - x0) * B.ease(lt), 0.55 - 0.35 * lt, true];
  };

  // Sand burst at your landing
  const P = 70, sp = new Float32Array(P * 3), vel = [];
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const sand = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xc9a86a, size: 0.06, transparent: true, opacity: 0 }));
  scene.add(sand);
  let burst = -1;
  const boom = () => {
    burst = 0;
    for (let i = 0; i < P; i++) {
      sp.set([5.6 + Math.random() * 0.2, 0.05, (Math.random() - 0.5) * 0.6], i * 3);
      vel[i] = [Math.random() * 1.6 + 0.3, Math.random() * 2.2 + 0.6, (Math.random() - 0.5) * 1.2];
    }
  };

  const tags = { tape: B.tag(stage, "5.72 m · you", "gold"), wr: B.tag(stage, "8.95 m · world record") };
  const cap = stage.querySelector(".cap .d");
  let t = -0.6, landed = false;
  document.getElementById("jump-run").addEventListener("click", () => { t = -0.3; landed = false; you.hist = []; ghost.hist = [] });

  s.resize = (w, h) => {
    const tn = Math.tan(15 * B.rad), halfW = 7, z = Math.max(1.9 / tn, halfW / (tn * w / h));
    camera.position.set(3.4, 1.5, z); camera.lookAt(3.4, 0.75, 0);
  };
  const v = new THREE.Vector3();
  s.update = (dt) => {
    if (!s.seen) return;
    t += B.reduce ? 0 : dt;
    if (B.reduce && t < RUN + SLOW * J[0].air + 1) t = RUN + SLOW * J[0].air + 1;
    [[you, J[0]], [ghost, J[1]]].forEach(([o, j]) => {
      const [x, y] = posAt(j, Math.max(0, t));
      o.grp.position.x = x; o.grp.position.y = y;
      if (t > 0) { o.hist.push(x, y, o.grp.position.z); if (o.hist.length > 270) o.hist.splice(0, 3) }
      const arr = o.trail.geometry.attributes.position.array;
      arr.fill(0); arr.set(o.hist.slice(-270));
      for (let i = o.hist.length; i < 270; i += 3) arr.set(o.hist.slice(-3), i);
      o.trail.geometry.attributes.position.needsUpdate = true;
    });
    const ft = (t - RUN) / SLOW;
    if (!landed && ft >= J[0].air) { landed = true; boom() }
    if (t < RUN) cap.textContent = "Run-up. The ghost behind is Mike Powell's 8.95 m.";
    else if (ft < J[0].air) cap.textContent = `In the air, slowed ${SLOW}×. Real flight: ${J[0].air.toFixed(2)} s.`;
    else cap.textContent = `5.72 m. Take-off about ${J[0].v.toFixed(1)} m/s (${(J[0].v * 3.6).toFixed(0)} km/h) at 20°, centre of mass peaking near 1.5 m.`;
    if (burst >= 0) {
      burst += dt;
      for (let i = 0; i < P; i++) {
        vel[i][1] -= g * dt * 0.5;
        sp[i * 3] += vel[i][0] * dt; sp[i * 3 + 1] = Math.max(0.02, sp[i * 3 + 1] + vel[i][1] * dt); sp[i * 3 + 2] += vel[i][2] * dt;
      }
      sgeo.attributes.position.needsUpdate = true;
      sand.material.opacity = Math.max(0, 1 - burst / 1.4);
      if (burst > 1.4) burst = -1;
    }
    if (t > RUN + SLOW * J[1].air + 3.5) { t = -0.6; landed = false; you.hist = []; ghost.hist = [] }
    tags.tape.place(v.set(5.72, 0.05, 1.35), camera, s.w, s.h, true);
    tags.wr.place(v.set(8.95, 0.05, -1.35), camera, s.w, s.h, true);
  };
  s.start();
})();
