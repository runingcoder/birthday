// The light from your birth night: a shell 27 light-years out, among the real
// neighbouring stars at their true directions and distances.
(() => {
  const B = window.BDAY, stage = document.getElementById("stars-stage");
  if (!stage || !window.THREE) return;
  const s = B.mount(stage, document.getElementById("stars"), { fov: 40 });
  if (!s) { stage.classList.add("no-gl"); return }
  const { scene, camera } = s, rad = B.rad;
  // name, right ascension (hours), declination (deg), distance (ly), note
  const STARS = [
    ["Alpha Centauri", 14.660, -60.834, 4.37, ""],
    ["Sirius", 6.752, -16.716, 8.6, "around when Nepal became a republic"],
    ["Procyon", 7.655, 5.225, 11.46, ""],
    ["Altair", 19.846, 8.868, 16.73, "the year of your first cube competitions"],
    ["Vega", 18.616, 38.784, 25.04, ""],
    ["Fomalhaut", 22.961, -29.622, 25.13, ""],
    ["Pollux", 7.755, 28.026, 33.78, ""],
    ["Arcturus", 14.261, 19.182, 36.7, ""],
    ["Capella", 5.278, 45.998, 42.9, ""],
  ];
  const place = (ra, dec, d) => new THREE.Vector3(
    d * Math.cos(dec * rad) * Math.cos(ra * 15 * rad), d * Math.sin(dec * rad), -d * Math.cos(dec * rad) * Math.sin(ra * 15 * rad));

  // Background sky
  const bp = [];
  for (let i = 0; i < 2200; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 260 + Math.random() * 120;
    bp.push(r * Math.sqrt(1 - u * u) * Math.cos(a), r * u, r * Math.sqrt(1 - u * u) * Math.sin(a));
  }
  const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
  scene.add(new THREE.Points(bgeo, new THREE.PointsMaterial({ color: 0x9ba0c4, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.55 })));

  // The Sun
  const glow = B.glowTexture([[0, "rgba(255,240,210,1)"], [0.25, "rgba(243,167,48,0.5)"], [1, "rgba(243,167,48,0)"]]);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sun.scale.setScalar(5); scene.add(sun);

  // The expanding shell of light
  const U = { uColor: { value: new THREE.Color(0xf3a730) } };
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main() { float rim = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(uColor * (0.03 + rim * 0.55), 1.0); }`,
  }));
  scene.add(shell);
  const eq = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) =>
    new THREE.Vector3(Math.cos(i / 64 * Math.PI), 0, Math.sin(i / 64 * Math.PI)))), new THREE.LineBasicMaterial({ color: 0xf3a730, transparent: true, opacity: 0.35 }));
  scene.add(eq);

  // Stars, with a faint line back to the Sun so depth reads
  const starTex = B.glowTexture();
  const stars = STARS.map(([name, ra, dec, d, note]) => {
    const p = place(ra, dec, d);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.copy(p); scene.add(sp);
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), p]),
      new THREE.LineBasicMaterial({ color: 0x5a5f9a, transparent: true, opacity: 0.25 }));
    scene.add(ln);
    const when = B.BIRTH + d * B.YEAR;
    const t = B.tag(stage, "");
    return { name, d, note, sp, t, when, lit: null };
  });
  const yr = t => new Date(t).getUTCFullYear();
  const capK = stage.querySelector(".cap .k"), capT = stage.querySelector(".cap .t"), capD = stage.querySelector(".cap .d");
  const idle = r => {
    capK.textContent = "Birth light · today";
    capT.textContent = `${r.toFixed(2)} light-years out`;
    capD.textContent = "Lit stars have already been reached. Altair in 2016, your first cube competitions. Sirius around 2008, as Nepal became a republic.";
  };

  let theta = 0.4, phi = 0.35, dist = 120, grow = -1;
  const ptr = B.pointer(stage, { drag: (dx, dy) => { theta -= dx * 0.006; phi = Math.min(1.3, Math.max(-1.3, phi + dy * 0.004)) } });
  s.resize = (w, h) => { const t = Math.tan(20 * rad); dist = Math.max(46 / t, 46 / (t * Math.min(1, w / h))) * 0.95 };
  const btn = document.getElementById("light-run");
  btn.addEventListener("click", () => { grow = 0; btn.disabled = true });

  s.update = (dt, clock) => {
    let r = (Date.now() - B.BIRTH) / B.YEAR, t = Date.now();
    if (grow >= 0) {
      grow += dt;
      const k = Math.min(1, grow / 12);
      t = B.BIRTH + (Date.now() - B.BIRTH) * k;
      r = (t - B.BIRTH) / B.YEAR;
      const reached = stars.filter(st => st.when <= t).pop();
      capK.textContent = `${yr(t)} · age ${Math.floor(r)}`;
      capT.textContent = `${r.toFixed(1)} light-years out`;
      capD.textContent = reached ? `Just reached ${reached.name}${reached.note ? ", " + reached.note : ""}.` : "Leaving the solar system.";
      if (k >= 1) { grow = -1; btn.disabled = false }
    } else idle(r);
    shell.scale.setScalar(Math.max(0.01, r));
    eq.scale.setScalar(Math.max(0.01, r));
    stars.forEach(st => {
      const lit = st.when <= t;
      if (lit !== st.lit) {
        st.lit = lit;
        st.sp.material.color.set(lit ? 0xf3a730 : 0xdfe6ff);
        st.t.el.className = `tag ${lit ? "gold" : ""}`;
        st.t.el.innerHTML = `${st.name} <small>${lit ? "reached" : "arrives"} ${yr(st.when)}</small>`;
        st.pop = 0;
      }
      if (st.pop !== undefined) st.pop += dt;
      const pop = st.pop !== undefined && st.pop < 0.6 ? 1 + (1 - st.pop / 0.6) * 1.5 : 1;
      st.sp.scale.setScalar((lit ? 4.2 : 3) * pop);
      st.t.place(st.sp.position, camera, s.w, s.h, st.d > 12);
    });
    if (!B.reduce && !ptr.down) theta += dt * 0.04;
    const cp = Math.cos(phi);
    camera.position.set(dist * cp * Math.sin(theta), dist * Math.sin(phi), dist * cp * Math.cos(theta));
    camera.lookAt(0, 0, 0);
  };
  s.start();
})();
