/* ============================================================
   WEB SWING — a Spider-Man style 3D skyline flyer
   Hold click/space to shoot a web, steer with the mouse or A/D,
   pump with W/S (or mouse up/down). Trim the web with the wheel.
   ============================================================ */
import * as THREE from 'three';

/* ---------------- utils ---------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const pick  = a => a[(Math.random() * a.length) | 0];
const $ = id => document.getElementById(id);

/* ---------------- dom ---------------- */
const canvas   = $('game');
const hud      = $('hud');
const elScore  = $('score');
const elDist   = $('dist');
const elSpeed  = $('speed');
const elHearts = $('hearts');
const reticle  = $('reticle');
const flash    = $('flash');
const toastEl  = $('toast');
const menu     = $('menu');
const over     = $('gameover');
const pausedOv = $('paused');
const errOv    = $('loadError');
const bestMenu = $('bestMenu');

/* ---------------- renderer ---------------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  errOv.classList.remove('hidden');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 5000);
camera.position.set(0, 96, 26);
scene.fog = new THREE.Fog(0x252c4a, 240, 1900);

/* ---------------- lights ---------------- */
scene.add(new THREE.AmbientLight(0x8fa0cc, 0.95));
const sun = new THREE.DirectionalLight(0xffd9b0, 0.55);
sun.position.set(-0.4, 1, 0.5);
scene.add(sun);

/* ---------------- textures ---------------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const litPalette = ['#ffd9a3', '#fff3d6', '#cfe4ff', '#9fd4f2', '#fff', '#ff9ec4', '#8affe0'];
function facadeTexture(brightness) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgb(${(30 * brightness) | 0},${(38 * brightness) | 0},${(58 * brightness) | 0})`);
    g.addColorStop(1, `rgb(${(13 * brightness) | 0},${(17 * brightness) | 0},${(28 * brightness) | 0})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const cols = 9, rows = 18, gx = 8, sx = 26, sy = 20;
    const cw = (w - sx * 2 - gx * (cols - 1)) / cols;
    const ch = (h - sy * 2 - 6 * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = sx + c * (cw + gx), y = sy + r * (ch + 6);
        if (Math.random() < 0.12) { ctx.fillStyle = '#161d2c'; ctx.fillRect(x, y, cw, ch); continue; }
        ctx.fillStyle = Math.random() < 0.25 ? pick(['#5a6b8f', '#3d4a68']) : pick(litPalette);
        ctx.globalAlpha = rand(0.55, 1);
        ctx.fillRect(x, y, cw, ch);
        ctx.globalAlpha = 1;
      }
    }
  });
}

function roofTexture(helipad) {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0d1320';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a2334';
    ctx.fillRect(0, 0, w, 6); ctx.fillRect(0, h - 6, w, 6);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = pick(['#2a3448', '#1f2939', '#232d40']);
      ctx.fillRect(rand(20, 180), rand(20, 180), rand(24, 60), rand(18, 44));
    }
    if (helipad) {
      ctx.strokeStyle = '#41507a'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(128, 128, 62, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#41507a';
      ctx.beginPath(); ctx.arc(128, 128, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ff5a6a';
    ctx.beginPath(); ctx.arc(30, 30, 4, 0, Math.PI * 2); ctx.fill();
  });
}

function glowTexture(inner, outer) {
  return canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

const spideyTex = canvasTex(64, 64, (ctx) => {
  ctx.strokeStyle = '#14161c';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  for (const [a2] of [[0.9], [1.25], [1.55], [1.9], [-0.9], [-1.25], [-1.55], [-1.9]]) {
    const s = a2 > 0 ? 1 : -1;
    const a = Math.abs(a2);
    const bend = a * 0.55;
    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.quadraticCurveTo(32 + Math.cos(bend) * 16 * s, 32 - 12, 32 + Math.cos(a) * 27 * s, 32 + Math.sin(a) * 15 - 11);
    ctx.stroke();
  }
  ctx.fillStyle = '#14161c';
  ctx.beginPath(); ctx.ellipse(32, 33, 5.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(32, 23, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
});

const sideTexA = facadeTexture(1);
const sideTexB = facadeTexture(0.8);
const sideTexC = facadeTexture(1.12);
const roofTexA = roofTexture(true);
const roofTexB = roofTexture(false);
const glowGoldMap = glowTexture('rgba(255,240,200,1)', 'rgba(255,190,60,.8)');
const glowRedMap  = glowTexture('rgba(255,190,190,1)', 'rgba(230,40,60,.85)');

/* ---------------- sky dome & stars ---------------- */
{
  scene.background = canvasTex(2, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#080d22');
    g.addColorStop(0.45, '#14264d');
    g.addColorStop(0.72, '#5b3f6e');
    g.addColorStop(0.86, '#c2565f');
    g.addColorStop(1.0, '#e8885a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });

  const sunDir = new THREE.Vector3(0.25, 0.1, -1).normalize();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2400, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uSun: { value: sunDir } },
      vertexShader: `
        varying vec3 vDir;
        void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 uSun;
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(vec3(0.90,0.52,0.36), vec3(0.33,0.23,0.42), smoothstep(0.0,0.22,h));
          col = mix(col, vec3(0.10,0.16,0.34), smoothstep(0.18,0.65,h));
          float sun  = pow(max(dot(d, uSun), 0.0), 90.0);
          float halo = pow(max(dot(d, uSun), 0.0), 6.0);
          col += vec3(1.0,0.75,0.5) * sun * 0.9;
          col += vec3(0.9,0.55,0.35) * halo * 0.22;
          gl_FragColor = vec4(col, 1.0);
        }`
    })
  );
  dome.frustumCulled = false;
  scene.add(dome);

  const nStars = 340;
  const starPos = new Float32Array(nStars * 3);
  for (let i = 0; i < nStars; i++) {
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(rand(0.18, 0.98));
    starPos[i * 3]     = Math.sin(p) * Math.cos(t) * 2200;
    starPos[i * 3 + 1] = Math.cos(p) * 2200;
    starPos[i * 3 + 2] = Math.sin(p) * Math.sin(t) * 2200;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcfdcff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false
  }));
  stars.frustumCulled = false;
  scene.add(stars);
}

/* ---------------- ground ---------------- */
{
  const g = new THREE.Mesh(
    new THREE.CircleGeometry(4200, 40),
    new THREE.MeshLambertMaterial({ color: 0x0c1119 })
  );
  g.rotation.x = -Math.PI / 2;
  scene.add(g);
}

/* ---------------- hero ---------------- */
const hero = (() => {
  const group = new THREE.Group();
  const redMat  = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.55, metalness: 0.1 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1a4f9e, roughness: 0.6, metalness: 0.05 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.35 });
  const mats = [redMat, blueMat, whiteMat];

  const limb = (r, len, mat) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
    m.position.y = -(len / 2 + r * 0.6);
    return m;
  };

  const armL = new THREE.Group(); armL.position.set(-0.27, 0.16, 0);
  const armR = new THREE.Group(); armR.position.set( 0.27, 0.16, 0);
  armL.add(limb(0.075, 0.34, redMat));
  armR.add(limb(0.075, 0.34, redMat));
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), redMat);
  handR.position.y = -0.55; armR.add(handR);
  const handL = handR.clone(); armL.add(handL);
  group.add(armL, armR);

  const legL = new THREE.Group(); legL.position.set(-0.14, -0.2, 0);
  const legR = new THREE.Group(); legR.position.set( 0.14, -0.2, 0);
  legL.add(limb(0.09, 0.44, blueMat));
  legR.add(limb(0.09, 0.44, blueMat));
  group.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 14), redMat);
  torso.position.y = 0.08;
  group.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.26, 0.1, 14), blueMat);
  belt.position.y = -0.12;
  group.add(belt);

  const emblem = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshStandardMaterial({ map: spideyTex, transparent: true, alphaTest: 0.35, roughness: 0.8 })
  );
  emblem.position.set(0, 0.22, 0.245);
  emblem.rotation.x = -0.25;
  group.add(emblem);
  mats.push(emblem.material);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 16), redMat);
  head.position.set(0, 0.68, 0.02);
  group.add(head);
  const eyeGeo = new THREE.SphereGeometry(0.085, 12, 10);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, whiteMat);
    eye.position.set(0.095 * s, 0.74, 0.17);
    eye.scale.set(1, 1.35, 0.65);
    eye.rotation.z = 0.35 * s;
    group.add(eye);
  }

  group.scale.setScalar(1.35);
  scene.add(group);
  return { group, mats, armL, armR, legL, legR, handR };
})();

/* ---------------- web line & anchor ---------------- */
const webLine = (() => {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe8f1ff, transparent: true, opacity: 0.95 }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);
  return line;
})();

const anchorObj = new THREE.Group();
{
  const dot = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,255,255,1)', 'rgba(160,200,255,.85)'),
    transparent: true, depthWrite: false, opacity: 0.9
  }));
  glow.scale.setScalar(10);
  anchorObj.add(dot, glow);
}
anchorObj.visible = false;
scene.add(anchorObj);

/* ---------------- particles ---------------- */
const particles = (() => {
  const list = [];
  const geos = new THREE.SphereGeometry(0.55, 6, 6);
  const baseMats = [
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    new THREE.MeshBasicMaterial({ color: 0xffd27a }),
    new THREE.MeshBasicMaterial({ color: 0xff5a6a }),
  ];
  for (let i = 0; i < 42; i++) {
    const m = new THREE.Mesh(geos, baseMats[i % 3].clone());
    m.visible = false;
    scene.add(m);
    list.push({ m, v: new THREE.Vector3(), life: 0, max: 1 });
  }
  function burst(pos, n, speed) {
    let spawned = 0;
    for (const p of list) {
      if (spawned >= n) break;
      if (p.life > 0) continue;
      p.life = p.max = rand(0.35, 0.8);
      p.m.position.copy(pos);
      p.m.visible = true;
      p.v.set(rand(-1, 1), rand(-0.2, 1.2), rand(-1, 1)).normalize().multiplyScalar(rand(speed * 0.4, speed));
      p.m.scale.setScalar(rand(0.5, 1.6));
      p.m.material.opacity = 1;
      spawned++;
    }
  }
  function update(dt) {
    for (const p of list) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.m.position.addScaledVector(p.v, dt);
      p.v.y -= 14 * dt;
      p.m.material.opacity = p.life / p.max;
    }
  }
  return { burst, update };
})();

/* ---------------- buildings ---------------- */
const buildings = [];
const rayTargets = [];
const laneX = [-180, 0, 180];
const lastLaneZ = [100, 140, 180];
const lastLaneD = [0, 0, 0];
let spawnHead = 0;
let antennaBlink = 0;

function buildingMaterials() {
  const side = pick([sideTexA, sideTexB, sideTexC]);
  const roof = pick([roofTexA, roofTexB]);
  const mats = [];
  for (let i = 0; i < 6; i++) {
    if (i === 2) mats.push(new THREE.MeshLambertMaterial({ map: roof, emissive: 0xffffff, emissiveMap: roof, emissiveIntensity: 0.25 }));
    else if (i === 3) mats.push(new THREE.MeshLambertMaterial({ color: 0x0c1119 }));
    else mats.push(new THREE.MeshLambertMaterial({ map: side, emissive: 0xffffff, emissiveMap: side, emissiveIntensity: 0.8 }));
  }
  return mats;
}

function addBuilding(x, h, w, d, z, far) {
  const geo = new THREE.BoxGeometry(w, h, d);
  let mesh;
  if (far) {
    mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x0a0f1a }));
  } else {
    mesh = new THREE.Mesh(geo, buildingMaterials());
  }
  mesh.position.set(x, h / 2, z);
  scene.add(mesh);
  const b = {
    mesh, geometry: geo, isFar: !!far,
    x, z, h, w, d,
    minX: x - w / 2, maxX: x + w / 2,
    minY: 0, maxY: h,
    minZ: z - d / 2, maxZ: z + d / 2,
    counted: false, antenna: null, tip: null,
  };
  buildings.push(b);
  if (!far) {
    rayTargets.push(mesh);
    if (Math.random() < 0.38) {
      const aH = rand(8, 22);
      b.antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 1.1, aH, 6),
        new THREE.MeshLambertMaterial({ color: 0x2a3448 })
      );
      b.antenna.position.set(x + rand(-w / 6, w / 6), h + aH / 2, z + rand(-d / 6, d / 6));
      scene.add(b.antenna);
      b.tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowRedMap, transparent: true, depthWrite: false }));
      b.tip.position.set(b.antenna.position.x, h + aH + 1, b.antenna.position.z);
      b.tip.scale.setScalar(6);
      scene.add(b.tip);
    }
  }
  return b;
}

function disposeBuilding(b, splice) {
  scene.remove(b.mesh);
  b.geometry.dispose();
  (Array.isArray(b.mesh.material) ? b.mesh.material : [b.mesh.material]).forEach(m => m.dispose());
  if (b.antenna) { scene.remove(b.antenna); b.antenna.geometry.dispose(); }
  if (b.tip) scene.remove(b.tip);
  const ri = splice ? rayTargets.indexOf(b.mesh) : -1;
  if (splice && ri >= 0) rayTargets.splice(ri, 1);
}

function clearBuildings() {
  for (const b of buildings) disposeBuilding(b, true);
  buildings.length = 0;
  rayTargets.length = 0;
}

function spawnAhead() {
  const pz = G.pos.z;
  let guard = 0;
  while (spawnHead < pz + 1500 && guard++ < 400) {
    /* slice z-step > max building depth, so a point in z is inside at most
       one slice -> at most 2 of 3 lanes are ever covered -> always a corridor */
    const z = spawnHead + rand(115, 195);
    const diff = clamp((pz - -30) * 0.02, 0, 110);
    const maxD = 84;

    const usedInSlice = buildings.filter(b => !b.isFar && Math.abs(b.z - z) < 60).map(b => b.lane);
    const freeLn = [0, 1, 2].filter(li =>
      z - maxD / 2 >= lastLaneZ[li] + lastLaneD[li] / 2 + 50
    );
    const room = Math.max(0, 2 - usedInSlice.length);
    let made = 0;

    if (freeLn.length > 0 && room > 0) {
      const lane = pick(freeLn);
      const b = addBuilding(laneX[lane] + rand(-10, 10), rand(55, 55 + diff), rand(36, 78), rand(40, 84), z, false);
      b.lane = lane;
      lastLaneZ[lane] = z; lastLaneD[lane] = b.d;
      made++;
      /* occasionally a second block beside it: makes a proper alley */
      if (made < room) {
        const lane2 = pick(freeLn.filter(l => l !== lane));
        if (lane2 !== undefined) {
          const b2 = addBuilding(laneX[lane2] + rand(-10, 10), rand(55, 55 + diff), rand(36, 70), rand(40, 76), z + rand(-12, 12), false);
          b2.lane = lane2;
          lastLaneZ[lane2] = z; lastLaneD[lane2] = b2.d;
          made++;
        }
      }
    }
    spawnHead = z;

    /* distant silhouette blocks for skyline depth (no collision, no aiming) */
    if (Math.random() < 0.35) {
      addBuilding(
        pick([-560, -640, 640, 720]) + rand(-60, 60),
        rand(60, 190),
        rand(44, 90),
        rand(44, 90),
        z + rand(60, 900),
        true
      );
    }
  }
  for (let i = buildings.length - 1; i >= 0; i--) {
    if (buildings[i].maxZ < pz - 280) {
      disposeBuilding(buildings[i], true);
      buildings.splice(i, 1);
    }
  }
}

/* ---------------- collectible orbs ---------------- */
const orb = (() => {
  const grp = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffe082 }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowGoldMap, transparent: true, depthWrite: false }));
  halo.scale.setScalar(14);
  grp.add(core, halo);
  grp.visible = false;
  scene.add(grp);
  let respawn = 6;
  return {
    grp,
    reset() { grp.visible = false; respawn = rand(5, 9); },
    update(t, dt) {
      core.rotation.y += dt * 2.2;
      core.scale.setScalar(1 + Math.sin(t * 5) * 0.12);
      if (grp.visible) return;
      respawn -= dt;
      if (respawn <= 0 && G.mode === 'PLAY') {
        grp.position.set(
          clamp(G.pos.x + rand(-140, 140), -260, 260),
          clamp(G.pos.y + rand(10, 45), 45, 160),
          G.pos.z + rand(160, 300)
        );
        grp.visible = true;
      }
    },
    checkPickup(pos) {
      if (!grp.visible || grp.position.distanceToSquared(pos) >= 40) return false;
      grp.visible = false;
      respawn = rand(7, 12);
      return true;
    }
  };
})();

/* ---------------- audio ---------------- */
const audio = (() => {
  let ctx = null, master = null, whooshG = null, whooshF = null, noiseBuf = null;
  let muted = false;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      whooshF = ctx.createBiquadFilter();
      whooshF.type = 'bandpass'; whooshF.frequency.value = 700; whooshF.Q.value = 0.8;
      whooshG = ctx.createGain(); whooshG.gain.value = 0;
      src.connect(whooshF); whooshF.connect(whooshG); whooshG.connect(master);
      src.start();
    } catch (e) { /* audio unavailable — game still works */ }
  }
  function env(gainVal, dur, type = 'sine', f0 = 220, f1 = null, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = f0;
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(gainVal, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function burst(dur, fType, fFreq, gainVal) {
    if (!ctx || muted) return;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = fType; f.frequency.value = fFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(); s.stop(ctx.currentTime + dur + 0.05);
  }
  return {
    ensure,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.85;
      return muted;
    },
    whoosh(speed) {
      if (!whooshG || muted) return;
      whooshG.gain.setTargetAtTime(Math.min(0.3, speed / 340), ctx.currentTime, 0.12);
      whooshF.frequency.setTargetAtTime(420 + speed * 3, ctx.currentTime, 0.2);
    },
    shoot()  { env(0.16, 0.09, 'square', 190, 90); burst(0.06, 'highpass', 1800, 0.22); },
    snap()   { burst(0.18, 'highpass', 900, 0.5); },
    hit()    { env(0.5, 0.35, 'sine', 80, 45); burst(0.3, 'lowpass', 420, 0.6); },
    orb()    { env(0.22, 0.16, 'sine', 620, 1320); env(0.14, 0.22, 'sine', 930, 1860, 0.07); },
    milestone() { env(0.2, 0.14, 'triangle', 523); env(0.2, 0.24, 'triangle', 784, null, 0.12); },
  };
})();

/* ---------------- game state ---------------- */
const G = {
  mode: 'MENU',
  pos: new THREE.Vector3(0, 95, -30),
  vel: new THREE.Vector3(0, 4, -34),
  dist: 0, score: 0, lives: 3,
  best: Number(localStorage.getItem('webswing-best') || 0),
  webbed: false,
  anchor: new THREE.Vector3(),
  webLen: 40,
  hand: new THREE.Vector3(),
  steer: 0, pump: 0,
  invuln: 0, deadT: 0, shake: 0,
  combo: 0,
  nextMilestone: 250,
  milestones: [
    [250, 'WARMING UP!', 100],
    [500, 'SWING STATE!', 150],
    [1000, 'WEB SLINGING!', 250],
    [2500, 'SPIDER SENSE!', 400],
    [5000, 'CITY LEGEND!', 700],
    [10000, 'THE CROONER!', 1200],
  ],
  menuHome: new THREE.Vector3(0, 120, 350),
  prevZ: -30,
  _buildingsCount: () => buildings.length,
};
bestMenu.textContent = G.best.toLocaleString();

/* small debug/test handle (console + automation) */
window.__ws = G;
window.__wsDebug = {
  status: () => ({
    mode: G.mode, dist: G.dist, score: G.score, lives: G.lives,
    webbed: G.webbed, pos: G.pos.toArray(), vel: G.vel.length(),
    buildings: buildings.length,
  }),
  /* aim at an anchor: sets the virtual cursor to the exact spot the camera
     ray to (x,y,z) passes through — identical to moving a real mouse there */
  aimAtWorld: (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    input.mouseX = clamp(v.x, -1, 1);
    input.mouseY = clamp(v.y, -1, 1);
    const sx = (input.mouseX * 0.5 + 0.5) * innerWidth;
    const sy = (-input.mouseY * 0.5 + 0.5) * innerHeight;
    setReticle(sx, sy);
  },
  hold: (ms) => new Promise(res => { input.webHeld = true; setTimeout(() => { input.webHeld = false; res(); }, ms); }),
  release: () => { input.webHeld = false; },
};

const input = {
  mouseX: 0, mouseY: 0,
  keySteer: 0, keyPump: 0,
  webHeld: false,
};

/* ---------------- ui helpers ---------------- */
function renderHearts() {
  elHearts.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const h = document.createElement('div');
    h.className = 'heart' + (i >= G.lives ? ' lost' : '');
    elHearts.appendChild(h);
  }
}

let toastTimer = 0;
function toast(main, sub, ms = 2200) {
  toastEl.innerHTML = main + (sub ? `<span class="sub">${sub}</span>` : '');
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function toastMute(m) { toast(m ? 'SOUND OFF' : 'SOUND ON', null, 900); }

function flashHit() {
  flash.style.transition = 'none';
  flash.style.opacity = '1';
  requestAnimationFrame(() => {
    flash.style.transition = 'opacity .55s ease';
    flash.style.opacity = '0';
  });
}

function addScore(points, label) {
  G.score += points;
  if (label) toast('+' + Math.round(points), label, 1400);
}

function checkMilestones() {
  const m = G.milestones.find(x => x[0] === G.nextMilestone);
  if (m && G.dist >= m[0]) {
    addScore(m[2], m[1]);
    audio.milestone();
    const next = G.milestones.find(x => x[0] > m[0]);
    G.nextMilestone = next ? next[0] : Infinity;
  }
}

/* ---------------- game flow ---------------- */
let paused = false;
let overShown = false;

function startGame() {
  clearBuildings();
  lastLaneZ[0] = lastLaneZ[2] = -1e9;
  lastLaneD[0] = lastLaneD[2] = 0;
  lastLaneZ[1] = -30; lastLaneD[1] = 64;
  spawnHead = 40;

  G.mode = 'PLAY';
  /* start on top of the runway tower, first target straight ahead */
  G.pos.set(0, 84, -30);
  G.vel.set(0, 2, -12);
  G.prevZ = -30;
  G.dist = 0; G.score = 0; G.lives = 3;
  G.webbed = false;
  G.invuln = 0; G.deadT = 0; G.combo = 0;
  G.nextMilestone = 250;
  G.shake = 0; G.steer = 0; G.pump = 0;
  hero.group.rotation.set(0, 0, 0);
  hero.group.position.copy(G.pos);
  orb.reset();

  /* runway tower under the hero + guaranteed first target in the middle lane */
  const runway = addBuilding(0, 80, 64, 64, -30, false);
  runway.counted = true;
  runway.lane = 1;
  const first = addBuilding(0, rand(58, 78), rand(42, 58), rand(46, 62), 62, false);
  first.counted = true;
  first.lane = 1;
  lastLaneZ[1] = 62; lastLaneD[1] = first.d;
  spawnAhead();
  renderHearts();

  /* settle the chase camera on the first frame */
  G.camPos.copy(G.pos).add(new THREE.Vector3(0, 4, 20));
  G.look.copy(G.pos).add(new THREE.Vector3(0, 2, -30));

  hud.classList.remove('hidden');
  menu.classList.add('hidden');
  over.classList.add('hidden');
  pausedOv.classList.add('hidden');
  paused = false;
  overShown = false;
  toastEl.classList.remove('show');
  toast('GO! HOLD CLICK & SWING', 'mouse to steer · W / S to pump · wheel trims the web', 3200);
}

function togglePause() {
  if (G.mode !== 'PLAY') return;
  paused = !paused;
  pausedOv.classList.toggle('hidden', !paused);
}

function cutWeb(burstFx) {
  if (!G.webbed) return;
  G.webbed = false;
  webLine.visible = false;
  anchorObj.visible = false;
  if (burstFx) {
    audio.snap();
    particles.burst(G.hand, 8, 10);
  }
}

function shootWeb(point, dist) {
  G.webbed = true;
  G.anchor.copy(point);
  G.webLen = clamp(dist, 26, 150);
  anchorObj.position.copy(point);
  anchorObj.visible = true;
  webLine.visible = true;
  /* slingshot: the shot pulls you slightly toward the anchor */
  const dir = new THREE.Vector3().subVectors(point, G.pos).normalize();
  G.vel.addScaledVector(dir, Math.min(18, G.vel.length() * 0.1) + 2);
  audio.shoot();
}

function showGameOver() {
  const finalScore = Math.round(G.score);
  if (finalScore > G.best) {
    G.best = finalScore;
    localStorage.setItem('webswing-best', String(G.best));
  }
  $('finalDist').textContent = Math.round(G.dist) + 'm';
  $('finalScore').textContent = finalScore.toLocaleString();
  $('bestOver').textContent = G.best.toLocaleString();
  bestMenu.textContent = G.best.toLocaleString();
  over.classList.remove('hidden');
  toastEl.classList.remove('show');
}

function hitBuilding(b) {
  const n = new THREE.Vector3(G.pos.x - b.x, 0, G.pos.z - b.z);
  if (n.lengthSq() < 0.001) n.set(0, 0, 1);
  n.normalize();
  if (G.invuln > 0) {
    G.pos.x = (G.pos.x - b.x) > 0 ? b.maxX + 2.4 : b.minX - 2.4;
    G.pos.z = (G.pos.z - b.z) > 0 ? b.maxZ + 2.4 : b.minZ - 2.4;
    G.vel.addScaledVector(n, 20);
    G.vel.y = Math.max(G.vel.y, 10);
    return;
  }
  G.lives -= 1;
  G.combo = 0;
  G.invuln = 2.2;
  G.shake = 0.7;
  flashHit();
  audio.hit();
  particles.burst(G.pos, 26, 26);
  G.vel.addScaledVector(n, 26);
  G.vel.y = Math.max(G.vel.y, 16);
  G.vel.z *= 0.65;
  if (G.mode === 'PLAY') toast(G.lives > 0 ? 'OUCH! WATCH THE WALLS' : 'THE WEB SNAPPED', null, 1400);
  if (G.lives <= 0) {
    G.mode = 'DEAD';
    G.deadT = 0;
    cutWeb(false);
  }
}

/* ---------------- aiming ---------------- */
const ray = new THREE.Raycaster();
ray.far = 400;
let aimTarget = null;

function updateAim() {
  aimTarget = null;
  if (rayTargets.length === 0) return;
  ray.setFromCamera(new THREE.Vector2(input.mouseX, input.mouseY), camera);
  const hits = ray.intersectObjects(rayTargets, false);
  if (hits.length === 0) return;
  const h = hits[0];
  const dist = h.distance;
  if (dist < 8 || dist > 150) return;
  aimTarget = { point: h.point.clone().addScaledVector(h.face.normal, 1.2), dist };
}

/* ---------------- physics ---------------- */
const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

function physics(dt) {
  const p = G.pos, v = G.vel;
  const GRAV = 26;

  G.steer = lerp(G.steer, clamp(input.mouseX * 0.95 + clamp(input.keySteer, -1, 1), -1.15, 1.15), 1 - Math.exp(-10 * dt));
  G.pump  = lerp(G.pump,  clamp(input.mouseY * 0.55 + clamp(input.keyPump, -1, 1), -1.1, 1.1), 1 - Math.exp(-8 * dt));

  if (G.webbed) {
    const n = tmpA.subVectors(p, G.anchor);           // anchor -> player
    let dNow = n.length();
    if (dNow < 1e-4) dNow = 1e-4;
    n.multiplyScalar(1 / dNow);

    /* rope constraint */
    if (dNow > G.webLen) {
      p.copy(G.anchor).addScaledVector(n, G.webLen);
      const vn = v.dot(n);
      if (vn > 0) v.addScaledVector(n, -vn);
    }

    /* pump: mouse up / W reels toward the anchor (higher); down ducks */
    v.addScaledVector(n, G.pump * 21 * dt);

    /* steer along the swing plane: push toward the cursor side.
       R = F x up is the player's right for horizontal forward F (y-up, RH). */
    const F = tmpB.set(v.x, 0, v.z);
    if (F.lengthSq() < 0.01) F.set(0, 0, -1); else F.normalize();
    const R = new THREE.Vector3(-F.z, 0, F.x);
    v.addScaledVector(R, G.steer * 32 * dt);

    /* mild swing damping so it stays readable */
    const vR = v.dot(R);
    v.addScaledVector(R, -vR * 0.55 * dt);
    v.addScaledVector(F, -v.dot(F) * 0.05 * dt);
  } else {
    /* free-fall air steering */
    const F = tmpB.set(v.x, 0, v.z);
    if (F.lengthSq() < 0.01) F.set(0, 0, -1); else F.normalize();
    const R = new THREE.Vector3(-F.z, 0, F.x);
    v.addScaledVector(R, G.steer * 11 * dt);
  }

  v.y -= GRAV * dt;
  v.clampLength(0, 95);
  p.addScaledVector(v, dt);

  /* ground: touching down ends the run */
  if (p.y < 1.6) {
    p.y = 1.6;
    v.y = Math.max(v.y, 0);
    v.x *= 0.9; v.z *= 0.9;
    if (G.mode === 'PLAY') hitGroundOut();
  }

  /* buildings */
  const r = 2.0;
  for (const b of buildings) {
    if (b.isFar) continue;
    if (p.x < b.minX - r || p.x > b.maxX + r) continue;
    if (p.z < b.minZ - r || p.z > b.maxZ + r) continue;
    if (p.y >= b.maxY + 0.6) continue;
    if (p.y < b.minY) continue;
    const onRoof = p.y > b.maxY - 1.8;
    if (onRoof && v.y <= 0) {
      p.y = b.maxY + 2.0;
      v.y = 6;
      if (G.mode === 'PLAY') addScore(20 + b.h * 0.12, 'ROOFTOP SPLASH');
    } else if (G.mode === 'PLAY') {
      hitBuilding(b);
    }
  }

  /* orbs */
  if (orb.checkPickup(p) && G.mode === 'PLAY') {
    G.combo++;
    addScore(50, 'COMBO ×' + G.combo);
    audio.orb();
    particles.burst(orb.grp.position, 14, 14);
  }

  /* distance, score passing */
  if (G.mode === 'PLAY') {
    const dz = p.z - G.prevZ;
    if (dz > 0) {
      G.dist += dz;
      G.score += dz * 0.25;
      checkMilestones();
    }
    for (const b of buildings) {
      if (!b.counted && p.z > b.maxZ + 8) {
        b.counted = true;
        G.score += 10 + b.h * 0.1;
      }
    }
  }
  G.prevZ = p.z;

  if (G.invuln > 0) G.invuln -= dt;

  /* web visual + hand */
  hero.handR.getWorldPosition(G.hand);
  if (G.webbed) {
    const arr = webLine.geometry.attributes.position;
    arr.setXYZ(0, G.hand.x, G.hand.y, G.hand.z);
    arr.setXYZ(1, G.anchor.x, G.anchor.y, G.anchor.z);
    arr.needsUpdate = true;
  }
}

function hitGroundOut() {
  G.mode = 'DEAD';
  G.deadT = 0;
  cutWeb(false);
  G.shake = 1;
  flashHit();
  audio.hit();
  particles.burst(G.pos, 26, 26);
}

/* spawn ahead, called continuously */
let lastSpawnFrame = -1;
function maybeSpawn() {
  if (performance.now() === lastSpawnFrame) return;
  lastSpawnFrame = performance.now();
  spawnAhead();
}

/* ---------------- hero pose ---------------- */
function updateHeroPose(dt, t) {
  const p = G.pos, v = G.vel;
  const speed = v.length();

  hero.group.position.copy(p);

  /* tilt */
  let tilt = clamp(v.y * 0.004, -0.4, 0.55);
  if (G.webbed) tilt = clamp(tilt + 0.32, -0.45, 0.8);
  hero.group.rotation.x = lerp(hero.group.rotation.x, G.mode === 'DEAD' ? 1.3 : -tilt, 1 - Math.exp(-8 * dt));

  /* bank */
  const fwdZ = v.z !== 0 ? Math.sign(v.z) : -1;
  const bank = clamp(v.x * 0.004 * fwdZ, -0.55, 0.55);
  hero.group.rotation.z = lerp(
    hero.group.rotation.z,
    G.mode === 'DEAD' ? G.deadT * 7 : bank,
    1 - Math.exp(-6 * dt)
  );
  if (G.mode === 'DEAD') hero.group.rotation.y += dt * 4;

  /* legs: running cycle when airborne, tucked when swinging */
  const airborne = G.mode === 'PLAY' && !G.webbed;
  const amp = airborne ? clamp(speed * 0.05, 0.25, 0.9) : 0.1;
  const ph = t * (7 + (airborne ? clamp(speed * 0.12, 0, 5) : 0));
  hero.legR.rotation.z = lerp(hero.legR.rotation.z, 0.14 + Math.sin(ph) * amp * (airborne ? 1 : -0.6), 1 - Math.exp(-14 * dt));
  hero.legL.rotation.z = lerp(hero.legL.rotation.z, -0.14 - Math.sin(ph) * amp * (airborne ? 1 : -0.6), 1 - Math.exp(-14 * dt));
  hero.legR.rotation.x = lerp(hero.legR.rotation.x, (G.webbed ? 0.7 : Math.max(0, Math.cos(ph)) * amp * 0.6), 1 - Math.exp(-14 * dt));
  hero.legL.rotation.x = lerp(hero.legL.rotation.x, (G.webbed ? 0.7 : Math.max(0, -Math.cos(ph)) * amp * 0.6), 1 - Math.exp(-14 * dt));

  /* arms: relaxed / swinging / shooting */
  const w = G.webbed ? 1 : 0;
  hero.armR.rotation.z = lerp(hero.armR.rotation.z, -1.05 - w * 1.7 + Math.sin(t * 2.1) * 0.04, 1 - Math.exp(-12 * dt));
  hero.armR.rotation.x = lerp(hero.armR.rotation.x, 0.12 - w * 0.55, 1 - Math.exp(-12 * dt));
  hero.armL.rotation.z = lerp(hero.armL.rotation.z, 1.0 + w * 1.1 + Math.sin(t * 2.4) * 0.05, 1 - Math.exp(-12 * dt));
  hero.armL.rotation.x = lerp(hero.armL.rotation.x, -0.08 - w * 0.35, 1 - Math.exp(-12 * dt));

  /* invuln flash */
  const f = G.invuln > 0 ? (Math.sin(t * 30) > 0 ? 1 : 0.25) : 1;
  for (const m of hero.mats) {
    m.transparent = f < 1;
    m.opacity = f;
  }
}

/* ---------------- camera ---------------- */
function updateCamera(dt) {
  const p = G.pos, v = G.vel;
  const speed = v.length();

  const fwd = tmpA.set(v.x, 0, v.z);
  if (fwd.lengthSq() < 0.01) fwd.set(0, 0, -1); else fwd.normalize();

  const side = Math.abs(input.mouseX) > 0.15 ? Math.sign(input.mouseX) : v.x * 0.02;
  const back = 10 + speed * 0.02;
  const targetPos = tmpB.set(p.x, p.y + 2.2, p.z).addScaledVector(fwd, -back * 0.92);
  targetPos.x += side * 2.6;

  const lookTarget = new THREE.Vector3(
    p.x + v.x * 0.32 + side * 6,
    p.y + 2.6 + v.y * 0.18,
    p.z + v.z * 0.32 - 8
  );

  const k = 1 - Math.exp(-9 * dt);
  G.camPos.lerp(targetPos, k);
  G.look.lerp(lookTarget, 1 - Math.exp(-6 * dt));

  /* never park the camera inside a wall: nudge it into the nearest free lane */
  for (const lane of [0, 1, 2]) {
    const lx = laneX[lane];
    let blocked = false;
    for (const b of buildings) {
      if (b.isFar) continue;
      if (Math.abs(b.z - G.camPos.z) < b.d / 2 + 2 &&
          Math.abs(lx - b.x) < b.w / 2 + 6 && G.camPos.y < b.maxY + 3) { blocked = true; break; }
    }
    if (!blocked) {
      G.camPos.x = lerp(G.camPos.x, lx, 1 - Math.exp(-4 * dt));
      break;
    }
  }

  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt * 1.5);
    const s = G.shake * G.shake * 1.8;
    camera.position.x += rand(-s, s);
    camera.position.y += rand(-s, s);
    camera.position.z += rand(-s, s);
  }
  camera.position.copy(G.camPos);
  camera.lookAt(G.look);

  camera.fov = lerp(camera.fov, 68 + Math.min(24, speed * 0.15), 1 - Math.exp(-5 * dt));
  camera.updateProjectionMatrix();
}

/* ---------------- input ---------------- */
function setReticle(x, y) {
  reticle.style.left = x + 'px';
  reticle.style.top = y + 'px';
}
setReticle(innerWidth / 2, innerHeight / 2);

addEventListener('mousemove', (e) => {
  input.mouseX = (e.clientX / innerWidth) * 2 - 1;
  input.mouseY = -((e.clientY / innerHeight) * 2 - 1);
  setReticle(e.clientX, e.clientY);
});
addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  audio.ensure();
  if (G.mode === 'PLAY' && !paused) input.webHeld = true;
});
addEventListener('mouseup', () => { input.webHeld = false; });
addEventListener('wheel', (e) => {
  if (!G.webbed) return;
  e.preventDefault();
  G.webLen = clamp(G.webLen + (e.deltaY > 0 ? 6 : -6), 26, 150);
}, { passive: false });
addEventListener('touchstart', (e) => {
  audio.ensure();
  const t = e.touches[0];
  input.mouseX = (t.clientX / innerWidth) * 2 - 1;
  input.mouseY = -((t.clientY / innerHeight) * 2 - 1);
  setReticle(t.clientX, t.clientY);
  if (G.mode === 'PLAY' && !paused) input.webHeld = true;
}, { passive: true });
addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  input.mouseX = (t.clientX / innerWidth) * 2 - 1;
  input.mouseY = -((t.clientY / innerHeight) * 2 - 1);
  setReticle(t.clientX, t.clientY);
}, { passive: true });
addEventListener('touchend', () => { input.webHeld = false; });
addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  audio.ensure();
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (G.mode === 'PLAY' && !paused) input.webHeld = true;
      break;
    case 'KeyA': input.keySteer = clamp(input.keySteer - 1, -1, 1); break;
    case 'KeyD': input.keySteer = clamp(input.keySteer + 1, -1, 1); break;
    case 'KeyW': case 'ArrowUp': input.keyPump = clamp(input.keyPump + 1, -1, 1); break;
    case 'KeyS': case 'ArrowDown': input.keyPump = clamp(input.keyPump - 1, -1, 1); break;
    case 'KeyR': cutWeb(true); break;
    case 'KeyP': togglePause(); break;
    case 'KeyM': toastMute(audio.toggleMute()); break;
    case 'Enter': if (G.mode === 'MENU' || (G.mode === 'DEAD' && overShown)) startGame(); break;
  }
});
addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'Space': input.webHeld = false; break;
    case 'KeyA': input.keySteer = clamp(input.keySteer + 1, -1, 1); break;
    case 'KeyD': input.keySteer = clamp(input.keySteer - 1, -1, 1); break;
    case 'KeyW': case 'ArrowUp': input.keyPump = clamp(input.keyPump - 1, -1, 1); break;
    case 'KeyS': case 'ArrowDown': input.keyPump = clamp(input.keyPump + 1, -1, 1); break;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.mode === 'PLAY' && !paused) togglePause();
});

menu.addEventListener('click', () => { audio.ensure(); startGame(); });
over.addEventListener('click', () => { audio.ensure(); startGame(); });

/* ---------------- main loop ---------------- */
const clock = new THREE.Clock();
let tGlobal = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.033);
  tGlobal += dt;

  if (!paused) {
    if (G.mode === 'PLAY') {
      if (input.webHeld && !G.webbed) {
        updateAim();
        if (aimTarget) shootWeb(aimTarget.point, aimTarget.dist);
      }
      if (!input.webHeld && G.webbed) cutWeb(true);

      physics(dt);
      updateAim();
      reticle.classList.toggle('hot', !G.webbed && !!aimTarget);
      maybeSpawn();
      audio.whoosh(G.vel.length());
    } else if (G.mode === 'DEAD') {
      G.deadT += dt;
      G.vel.y -= 60 * dt;
      G.pos.addScaledVector(G.vel, dt);
      if (G.deadT > 1.15 && !overShown) {
        overShown = true;
        showGameOver();
      }
      audio.whoosh(0);
      reticle.classList.remove('hot');
    }

    updateHeroPose(dt, tGlobal);
    orb.update(tGlobal, dt);
    particles.update(dt);
  }

  /* camera per mode */
  if (G.mode === 'MENU') {
    const a = tGlobal * 0.15;
    const c = G.menuHome;
    camera.position.set(
      c.x + Math.sin(a) * 12,
      c.y + 62,
      c.z + 34 + Math.cos(a) * 10
    );
    camera.lookAt(c.x, c.y - 6, c.z - 4);
  } else {
    updateCamera(dt);
  }

  /* antenna blink */
  antennaBlink += dt;
  for (const b of buildings) {
    if (b.tip) b.tip.material.opacity = Math.sin(antennaBlink * 2.6 + b.x * 0.13) > 0.2 ? 0.95 : 0.25;
  }

  updateHUD();
  renderer.render(scene, camera);
  window.__webswingBooted = true;
}

function updateHUD() {
  elScore.textContent = Math.round(G.score).toLocaleString();
  elDist.textContent = Math.round(G.dist) + 'm';
  elSpeed.textContent = Math.round(G.vel.length() * 3.6);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.setSize(innerWidth, innerHeight);

/* initial skyline (menu backdrop + first-run start tower) */
{
  lastLaneZ[0] = lastLaneZ[2] = -1e9;
  lastLaneD[0] = lastLaneD[2] = 0;
  lastLaneZ[1] = 420; lastLaneD[1] = 100;
  spawnHead = 0;
  spawnAhead();
  const tower = addBuilding(0, 112, 56, 62, 420, false);
  tower.lane = 1;
  G.menuHome.set(tower.x, tower.maxY + 6, tower.z);
  G.pos.copy(G.menuHome);
  G.vel.set(0, 0, 0);
}
G.camPos = new THREE.Vector3(G.menuHome.x + 40, G.menuHome.y + 20, G.menuHome.z + 40);
G.look = new THREE.Vector3();
G.camPos.copy(G.menuHome).add(new THREE.Vector3(45, 22, 45));

renderHearts();
renderer.setAnimationLoop(frame);
