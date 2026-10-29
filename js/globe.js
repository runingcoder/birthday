// Banepa to Fremont: a dotted globe lit by the real Sun right now, with the
// great-circle arc between your desk and your company.
(() => {
  const B = window.BDAY, stage = document.getElementById("globe-stage");
  if (!stage || !window.THREE || !window.LAND) return;
  const s = B.mount(stage, document.getElementById("globe"), { fov: 30 });
  if (!s) { stage.classList.add("no-gl"); return }
  const { scene, camera } = s, rad = B.rad;
  const bits = Uint8Array.from(atob(window.LAND), c => c.charCodeAt(0));
  const isLand = (lat, lon) => {
    const n = Math.min(179, Math.floor(90 - lat)) * 360 + Math.min(359, Math.floor(lon + 180));
    return (bits[n >> 3] >> (n & 7)) & 1;
  };
  const v3 = (lat, lon, r = 1) => new THREE.Vector3(
    r * Math.cos(lat * rad) * Math.cos(lon * rad), r * Math.sin(lat * rad), -r * Math.cos(lat * rad) * Math.sin(lon * rad));

  const tilt = new THREE.Group(), spin = new THREE.Group();
  tilt.add(spin); scene.add(tilt);

  // Land as an even spread of dots
  const N = 26000, pos = [];
  for (let k = 0; k < N; k++) {
    const y = 1 - 2 * (k + 0.5) / N, a = k * Math.PI * (3 - Math.sqrt(5));
    const lat = Math.asin(y) / rad, lon = ((a / rad) % 360 + 540) % 360 - 180;
    if (isLand(lat, lon)) { const p = v3(lat, lon); pos.push(p.x, p.y, p.z) }
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const U = { uSun: { value: new THREE.Vector3(1, 0, 0) }, uSize: { value: 9 }, uTime: { value: 0 } };
  spin.add(new THREE.Points(dg, new THREE.ShaderMaterial({
    uniforms: U, transparent: true,
    vertexShader: `
      uniform vec3 uSun; uniform float uSize; varying float vDay;
      void main() {
        vDay = smoothstep(-0.1, 0.12, dot(normalize(position), uSun));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vDay;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        gl_FragColor = vec4(mix(vec3(0.27, 0.31, 0.62), vec3(0.98, 0.71, 0.28), vDay), 1.0);
      }`,
  })));
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(0.985, 64, 48), new THREE.MeshBasicMaterial({ color: 0x0f1430 })));
  const atmo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: B.glowTexture([[0, "rgba(90,110,220,0)"], [0.62, "rgba(90,110,220,0)"], [0.7, "rgba(110,130,240,0.45)"], [1, "rgba(80,100,220,0)"]]),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  atmo.scale.setScalar(2.95);
  scene.add(atmo);

  // Pins and the arc
  const BAN = [27.63, 85.52], FRE = [37.55, -121.99];
  const a = v3(...BAN), b = v3(...FRE);
  const pinMat = new THREE.MeshBasicMaterial({ color: 0xf3a730 });
  const ringTex = B.glowTexture([[0, "rgba(243,167,48,0)"], [0.55, "rgba(243,167,48,0)"], [0.7, "rgba(243,167,48,0.9)"], [0.85, "rgba(243,167,48,0)"]]);
  const rings = [a, b].map(p => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), pinMat);
    m.position.copy(p).multiplyScalar(1.004); spin.add(m);
    const r = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    r.position.copy(m.position); spin.add(r);
    return r;
  });
  const om = Math.acos(a.dot(b)), slerp = t => a.clone().multiplyScalar(Math.sin((1 - t) * om)).add(b.clone().multiplyScalar(Math.sin(t * om))).divideScalar(Math.sin(om));
  const AP = [], AT = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160, p = slerp(t).normalize().multiplyScalar(1 + 0.3 * Math.sin(Math.PI * t));
    AP.push(p.x, p.y, p.z); AT.push(t);
  }
  const ag = new THREE.BufferGeometry();
  ag.setAttribute("position", new THREE.Float32BufferAttribute(AP, 3));
  ag.setAttribute("aT", new THREE.Float32BufferAttribute(AT, 1));
  spin.add(new THREE.Line(ag, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `attribute float aT; varying float vT; void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; varying float vT;
      void main() {
        float head = fract(uTime * 0.22);
        float p = exp(-pow((vT - head) * 14.0, 2.0));
        gl_FragColor = vec4(vec3(0.95, 0.65, 0.19) * (0.45 + p * 1.6) + vec3(1.0) * p * 0.5, 1.0);
      }`,
  })));
  const apex = slerp(0.5).normalize().multiplyScalar(1.3);

  // Face the arc's midpoint toward the camera, north roughly up
  const mid = slerp(0.5).normalize();
  const midLat = Math.asin(mid.y) / rad, midLon = Math.atan2(-mid.z, mid.x) / rad;
  tilt.rotation.x = midLat * rad * 0.8;
  const baseSpin = (-90 - midLon) * rad;
  let spinOff = 0, tiltOff = 0;

  const tagB = B.tag(stage, "", "gold"), tagF = B.tag(stage, "", "gold"), tagK = B.tag(stage, "12,220 km");
  const hm = tz => new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const ptr = B.pointer(stage, { drag: (dx, dy) => { spinOff += dx * 0.006; tiltOff = Math.max(-0.6, Math.min(0.6, tiltOff + dy * 0.004)) } });
  s.resize = (w, h) => {
    const t = Math.tan(15 * rad);
    camera.position.set(0, 0, Math.max(1.45 / t, 1.35 / (t * Math.min(1, w / h))));
    camera.lookAt(0, 0, 0);
    U.uSize.value = 11 * Math.min(window.devicePixelRatio || 1, 2);
  };
  const wp = new THREE.Vector3(), camDir = new THREE.Vector3();
  let lastSun = -1;
  s.update = (dt, clock) => {
    U.uTime.value = B.reduce ? 0.4 : clock;
    if (clock - lastSun > 1 || lastSun < 0) {
      lastSun = clock;
      const ss = B.subsolar(Date.now());
      U.uSun.value.copy(v3(ss.lat, ss.lon));
      const sunB = v3(...BAN).dot(U.uSun.value) > 0, sunF = v3(...FRE).dot(U.uSun.value) > 0;
      tagB.el.innerHTML = `Banepa ${hm("Asia/Kathmandu")} <small>${sunB ? "day" : "night"}</small>`;
      tagF.el.innerHTML = `Fremont ${hm("America/Los_Angeles")} <small>${sunF ? "day" : "night"}</small>`;
    }
    const sway = B.reduce ? 0 : Math.sin(clock * 0.12) * 0.35;
    spin.rotation.y = baseSpin + sway + spinOff;
    tilt.rotation.z = 0;
    tilt.rotation.x = midLat * rad * 0.8 + tiltOff;
    rings.forEach((r, i) => { const k = ((clock * 0.6 + i * 0.5) % 1); r.scale.setScalar(0.04 + k * 0.16); r.material.opacity = 1 - k });
    camera.getWorldDirection(camDir);
    [[tagB, a], [tagF, b]].forEach(([t, p]) => {
      spin.localToWorld(wp.copy(p));
      t.place(wp, camera, s.w, s.h, wp.clone().normalize().dot(camDir) < -0.05);
    });
    spin.localToWorld(wp.copy(apex));
    tagK.place(wp, camera, s.w, s.h, true);
  };
  s.start();
})();
