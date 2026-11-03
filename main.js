import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ===== 발표자 정보: 여기만 바꾸면 됩니다 =====
const AUTHOR = '이름 · 학번';
// ===========================================

document.getElementById('author').textContent = AUTHOR;

const STEP_NAMES = ['아이디어', '데이터', '로직', '구조 · AI 검토', '재료 · 조인트 · 생산'];
const TYPES = {
  'F1_리브':       { label: '리브',       mat: '집성목 100×200',        color: '#b07a46', explode: 0.0 },
  'F2_도리':       { label: '도리',       mat: '집성목 90×90',          color: '#c49662', explode: 1.6 },
  'F3_가새':       { label: '가새',       mat: '집성목 60×80',          color: '#8c5c34', explode: 1.0 },
  'F4_토대레일':   { label: '토대 레일',  mat: 'ㄷ형강 150×75',         color: '#46484c', explode: -0.6 },
  'F5_타이로드':   { label: '타이로드',   mat: '강봉 M24',              color: '#46484c', explode: -0.9 },
  'J1_노드철물':   { label: '노드 철물',  mat: '강판 14t + M16 볼트 4', color: '#46484c', explode: 0.7 },
  'J2_스크류앵커': { label: '스크류 앵커', mat: '강관 Ø76 L1.2m',       color: '#46484c', explode: -1.6 },
  'P1_막힌패널':   { label: '막힌 패널',  mat: '합판 18t',              color: '#debe8c', explode: 3.0 },
  'P2_루버패널':   { label: '루버 패널',  mat: '목재 루버 6날',          color: '#be8750', explode: 3.4 },
  'P3_격자패널':   { label: '격자 패널',  mat: '목재 격자 30t',          color: '#e8d0a5', explode: 3.8 },
};

// Rhino(Z-up) -> three(Y-up), glTF 내보내기와 같은 변환
const R2T = (p) => new THREE.Vector3(p[0], p[2], -p[1]);

// ---------- 기본 장면 ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#efece6');
scene.fog = new THREE.Fog('#efece6', 45, 90);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
camera.position.set(-17, 9, 19);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.6, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 4;
controls.maxDistance = 70;
controls.autoRotateSpeed = 0.6;

scene.add(new THREE.HemisphereLight('#ffffff', '#b9b1a3', 1.4));
const sun = new THREE.DirectionalLight('#fff4e2', 2.4);
sun.position.set(-12, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
sun.shadow.bias = -0.0004;
scene.add(sun);

const groundMat = new THREE.MeshStandardMaterial({ color: '#dcd8cf', roughness: 1, transparent: true, opacity: 1 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(120, 120, '#cfc9be', '#e2ddd4');
grid.position.y = 0.002;
scene.add(grid);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 왼쪽 패널(넓은 화면) 또는 아래 패널(좁은 화면)을 피해 모델을 보이는 쪽 가운데로
  if (w > 760) camera.setViewOffset(w, h, -210, 0, w, h); else camera.setViewOffset(w, h, 0, h * 0.24, w, h);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- 불러오기 ----------
const loader = new GLTFLoader();
const load = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));

const models = {};        // after, before, data
const groups = { after: {}, before: {} };   // type -> [{obj, bay}]
let process = null, counts = { after: {}, before: {} }, vmaxText = '299';

function prepModel(root, key) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const m = o.material;
    m.side = THREE.DoubleSide;
    m.roughness = 0.85; m.metalness = 0.0;
    const [type, bay] = (o.name || '').split('|');
    if (TYPES[type]) {
      if (type.startsWith('J') || type.startsWith('F4') || type.startsWith('F5')) { m.metalness = 0.5; m.roughness = 0.45; }
      o.userData = { type, bay: parseInt(bay || '0', 10), base: o.position.clone() };
      (groups[key][type] ||= []).push(o);
      o.material = m.clone();
      o.userData.baseColor = o.material.color.clone();
    }
  });
}

Promise.all([
  load('models/pavilion_after.glb'),
  load('models/pavilion_before.glb'),
  load('models/data_shade.glb'),
  fetch('models/process.json').then((r) => r.json()),
  fetch('models/counts_after.json').then((r) => r.json()),
  fetch('models/counts_before.json').then((r) => r.json()),
  fetch('models/report_after.txt').then((r) => r.text()),
]).then(([a, b, d, proc, ca, cb, rep]) => {
  models.after = a.scene; models.before = b.scene; models.data = d.scene;
  prepModel(models.after, 'after');
  prepModel(models.before, 'before');
  models.data.traverse((o) => {
    if (!o.isMesh) return;
    // Rhino가 쓴 정점 색은 sRGB 값 그대로라서 선형 공간으로 바꿔 준다
    const col = o.geometry.attributes.color;
    if (col) {
      const c = new THREE.Color();
      for (let i = 0; i < col.count; i++) {
        c.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.SRGBColorSpace);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    }
    o.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
  });
  scene.add(models.after, models.before, models.data);
  process = proc; counts.after = ca; counts.before = cb;
  const m = rep.match(/그늘 일사 최대 (\d+)/); if (m) vmaxText = m[1];
  buildOverlays();
  buildCounts();
  document.getElementById('loading').remove();
  go(1);
}).catch((e) => {
  document.getElementById('loading').textContent = '모델을 불러오지 못했어요: ' + e.message + ' (npx serve로 열었는지 확인)';
  console.error(e);
});

// ---------- 동선 · 해 경로 · 라벨 ----------
const overlay = new THREE.Group(); scene.add(overlay);
const dataLines = new THREE.Group(); scene.add(dataLines);
let doorPts = [], entrancePts = [];

function line(points, color, width = 1, dashed = false) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.4, gapSize: 0.25 })
                     : new THREE.LineBasicMaterial({ color, linewidth: width });
  const l = new THREE.Line(g, mat);
  if (dashed) l.computeLineDistances();
  return l;
}

function segX(a, b, c, d) {   // 2D 교차 (x,y)
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? [a[0] + t * r[0], a[1] + t * r[1], 0] : null;
}

function sunArc(doy, R = 14) {
  const phi = THREE.MathUtils.degToRad(51.5);
  const dec = THREE.MathUtils.degToRad(23.45 * Math.sin(THREE.MathUtils.degToRad(360 / 365 * (284 + doy))));
  const pts = [];
  for (let t = 3; t <= 21; t += 0.25) {
    const ha = THREE.MathUtils.degToRad(15 * (t - 12));
    const su = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha);
    if (su < 0) continue;
    const se = -Math.cos(dec) * Math.sin(ha);
    const sn = Math.cos(phi) * Math.sin(dec) - Math.sin(phi) * Math.cos(dec) * Math.cos(ha);
    pts.push(R2T([se * R, sn * R, su * R]));
  }
  return pts;
}

function buildOverlays() {
  const route = process.route.map(R2T).map((v) => v.setY(0.03));
  const routeLine = line(route, '#222222');
  overlay.add(routeLine);
  process.cross.forEach((c) => overlay.add(line(c.map(R2T).map((v) => v.setY(0.03)), '#e0533d', 1, true)));
  // 문 위치 = 교차 동선과 주 동선의 교점
  for (const c of process.cross) {
    for (let i = 0; i < process.route.length - 1; i++)
      for (let j = 0; j < c.length - 1; j++) {
        const p = segX(process.route[i], process.route[i + 1], c[j], c[j + 1]);
        if (p) doorPts.push(R2T(p).setY(1.2));
      }
  }
  entrancePts = [R2T(process.route[0]).setY(1.4), R2T(process.route[process.route.length - 1]).setY(1.4)];
  // 해 경로 (6/21, 8/1, 9/21)
  [[172, '#f2a43a'], [213, '#f2b35e'], [264, '#f5c98a']].forEach(([d, c]) => dataLines.add(line(sunArc(d), c)));
  const ring = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; ring.push(new THREE.Vector3(Math.cos(a) * 14, 0.02, Math.sin(a) * 14)); }
  dataLines.add(line(ring, '#c9c2b6'));
  document.getElementById('vmax').textContent = vmaxText;
}

// HTML 라벨
const tips = [];
function tip(text, pos, cls = '') {
  const el = document.createElement('div');
  el.className = 'tip ' + cls; el.textContent = text; document.body.appendChild(el);
  tips.push({ el, pos }); return el;
}
function clearTips() { tips.splice(0).forEach((t) => t.el.remove()); }
function updateTips() {
  const w = innerWidth, h = innerHeight;
  for (const t of tips) {
    const v = t.pos.clone().project(camera);
    const hidden = v.z > 1;
    t.el.style.display = hidden ? 'none' : 'block';
    t.el.style.left = ((v.x + 1) / 2 * w) + 'px';
    t.el.style.top = ((1 - v.y) / 2 * h) + 'px';
  }
}
function groupCenter(key, type, bay = null) {
  const box = new THREE.Box3();
  (groups[key][type] || []).forEach((o) => { if (bay === null || o.userData.bay === bay) box.expandByObject(o); });
  return box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
}

// ---------- 보이기 도우미 ----------
function showOnly(...keys) {
  ['after', 'before', 'data'].forEach((k) => { if (models[k]) models[k].visible = keys.includes(k); });
}
function resetAfter() {
  Object.values(groups.after).flat().forEach((o) => {
    o.visible = true; o.position.copy(o.userData.base); o.material.color.copy(o.userData.baseColor);
    o.material.emissive?.set('#000000'); o.scale.set(1, 1, 1);
  });
}

// ---------- 3단계: 형성 과정 재생 ----------
const chainGroup = new THREE.Group(); scene.add(chainGroup);
let chainLine = null, chainDots = null;
let play = { on: false, t: 0 };
const PHASES = [0, 1.5, 4.5, 8.0, 10.5, 12.5, 16.5];   // 단계 시작 시각(초)

function buildChain() {
  chainGroup.clear();
  const pts = process.chain;
  const geo = new THREE.BufferGeometry().setFromPoints(pts.map(() => new THREE.Vector3()));
  chainLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#2a7de1' }));
  chainDots = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#2a7de1', size: 0.18 }));
  chainGroup.add(chainLine, chainDots);
}
function setChain(k) {   // k: 0 매달림 -> 1 뒤집힌 아치
  const pts = process.chain;
  const zmin = Math.min(...pts.map((p) => p[2]));
  const W = 4.0, H = 4.0;
  const pos = chainLine.geometry.attributes.position;
  pts.forEach((p, i) => {
    const s = p[2] / zmin;                        // 0 끝 ~ 1 가운데
    const yHang = H - s * H * 0.9 + 0.9;          // 위에 매달린 사슬
    const yArch = s * H;                          // 뒤집힌 아치
    const y = THREE.MathUtils.lerp(yHang, yArch, k);
    pos.setXYZ(i, 0, y, -p[0] * W);
  });
  pos.needsUpdate = true;
}

function setProcess(t) {
  const phase = PHASES.findIndex((s, i) => t >= s && t < (PHASES[i + 1] ?? 1e9));
  document.querySelectorAll('#rules li').forEach((li) => li.classList.toggle('on', +li.dataset.phase === Math.min(phase, 5)));
  const nb = 17;
  const prog = (a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  // 사슬
  chainGroup.visible = t >= PHASES[1] && t < PHASES[3];
  if (chainGroup.visible) setChain(THREE.MathUtils.smoothstep(prog(PHASES[1] + 0.8, PHASES[2]), 0, 1));
  const show = (type, a, b) => {
    const k = prog(a, b);
    (groups.after[type] || []).forEach((o) => {
      const on = o.userData.bay < k * nb + 0.001 && k > 0;
      o.visible = on;
      o.position.copy(o.userData.base);
      if (on && k < 1) { const local = THREE.MathUtils.clamp(k * nb - o.userData.bay, 0, 1); o.position.y += (1 - local) * 2.5; }
    });
  };
  show('J2_스크류앵커', PHASES[2], PHASES[2] + 2);
  show('F1_리브', PHASES[2], PHASES[3]);
  show('F2_도리', PHASES[3], PHASES[4]);
  show('J1_노드철물', PHASES[3], PHASES[4]);
  show('F3_가새', PHASES[4], PHASES[5]);
  show('F4_토대레일', PHASES[4], PHASES[5]);
  show('F5_타이로드', PHASES[4], PHASES[5]);
  show('P1_막힌패널', PHASES[5], PHASES[5] + 1.5);
  show('P2_루버패널', PHASES[5] + 1.3, PHASES[5] + 2.8);
  show('P3_격자패널', PHASES[5] + 2.6, PHASES[6]);
}
document.getElementById('play').onclick = () => {
  if (play.t >= PHASES[6]) play.t = 0;
  play.on = !play.on;
  document.getElementById('play').textContent = play.on ? '❚❚ 멈춤' : '▶ 재생';
};
document.getElementById('replay').onclick = () => { play.t = 0; play.on = true; document.getElementById('play').textContent = '❚❚ 멈춤'; };
document.querySelectorAll('#rules li').forEach((li) => li.onclick = () => {
  play.on = false; play.t = PHASES[+li.dataset.phase] + (li.dataset.phase === '1' ? 2.5 : 0.01);
  if (li.dataset.phase === '5') play.t = PHASES[6];
  document.getElementById('play').textContent = '▶ 재생';
  setProcess(play.t);
});

// ---------- 4단계: 전 / 후 ----------
let compare = 'after';
function setCompare(v) {
  compare = v;
  document.querySelectorAll('.seg .btn').forEach((b) => b.classList.toggle('dark', b.dataset.v === v));
  showOnly(v);
  clearTips();
  resetAfter();
  if (v === 'after') {
    ['F3_가새', 'F5_타이로드'].forEach((t) => groups.after[t]?.forEach((o) => o.material.color.set('#3fbf74')));
    tip('사슬 아치 (Kangaroo)', groupCenter('after', 'F1_리브', 8).setY(4.4), 'g');
    tip('타이로드 +17', groupCenter('after', 'F5_타이로드', 2).setY(0.4), 'g');
    tip('가새 20 → 80', groupCenter('after', 'F3_가새', 6), 'g');
  } else {
    tip('① 다리 휨', groupCenter('before', 'F1_리브', 8).setY(2.2));
    tip('② 발이 벌어지는 추력', groupCenter('before', 'F4_토대레일', 13).setY(0.3));
    if (doorPts[0]) tip('③ 문 칸 흔들림', doorPts[0].clone().setY(2.0));
  }
}
document.querySelectorAll('.seg .btn').forEach((b) => b.onclick = () => setCompare(b.dataset.v));

// ---------- 5단계: 분해 · 조인트 · 개수 ----------
const explodeInput = document.getElementById('explode');
explodeInput.oninput = () => applyExplode(+explodeInput.value);
function applyExplode(k) {
  Object.entries(groups.after).forEach(([type, list]) => list.forEach((o) => {
    o.position.copy(o.userData.base); o.position.y += TYPES[type].explode * k * 1.6;
  }));
  groundMat.opacity = k > 0.02 ? 0.35 : 1;
}

function buildCounts() {
  const t = document.getElementById('counts');
  let html = '<tr><th>부재</th><th>재료</th><th>개수</th></tr>';
  let sum = 0;
  for (const [k, v] of Object.entries(TYPES)) {
    const n = counts.after[k] ?? 0; sum += n;
    html += `<tr><td><i class="swatch" style="background:${v.color}"></i>${k.split('_')[0]} ${v.label}</td><td>${v.mat}</td><td>${n}</td></tr>`;
  }
  html += `<tr class="sum"><td>합계</td><td>블록 10종</td><td>${sum}</td></tr>`;
  t.innerHTML = html;
}

// 조인트 확대 뷰
const jCanvas = document.getElementById('jointview');
const jRenderer = new THREE.WebGLRenderer({ canvas: jCanvas, antialias: true, alpha: true });
jRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
jRenderer.outputColorSpace = THREE.SRGBColorSpace;
const jScene = new THREE.Scene();
jScene.add(new THREE.HemisphereLight('#ffffff', '#a59c8f', 1.6));
const jl = new THREE.DirectionalLight('#ffffff', 2); jl.position.set(2, 3, 2); jScene.add(jl);
const jl2 = new THREE.DirectionalLight('#ffffff', 2.4); jl2.position.set(-1.5, -3, 1); jScene.add(jl2);
jScene.add(new THREE.AmbientLight('#ffffff', 0.8));
const jCam = new THREE.PerspectiveCamera(32, 2, 0.01, 20);
let jointRoot = null;
load('models/joint.glb').then((g) => {
  jointRoot = new THREE.Group();
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material.side = THREE.DoubleSide;
    const steel = o.name.startsWith('J1');
    o.material.metalness = steel ? 0.3 : 0.0;   // 환경맵이 없어서 금속값이 높으면 검게 보임
    o.material.roughness = steel ? 0.5 : 0.8;
  });
  jointRoot.add(g.scene);
  jScene.add(jointRoot);
});

// ---------- 단계 전환 ----------
let step = 1;
const dots = document.getElementById('dots');
STEP_NAMES.forEach((_, i) => { const d = document.createElement('i'); d.onclick = () => go(i + 1); dots.appendChild(d); });
document.getElementById('prev').onclick = () => go(Math.max(1, step - 1));
document.getElementById('next').onclick = () => go(Math.min(5, step + 1));
addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(Math.min(5, step + 1)); if (e.key === 'ArrowLeft') go(Math.max(1, step - 1)); });

// 단계별 카메라 시점 (three 좌표: +z = 남쪽)
const VIEWS = {
  1: { pos: [-17, 8, 19], tgt: [0, 1.6, 0] },
  2: { pos: [-6, 17, 24], tgt: [0, 1.2, 0] },
  3: { pos: [-15, 10, 18], tgt: [0, 1.6, 0] },
  4: { pos: [-15, 7, 17], tgt: [0, 1.8, 0] },
  5: { pos: [-19, 9, 21], tgt: [0, 2.2, 0] },
};
let camAnim = null;
function flyTo(n) {
  const v = VIEWS[n]; const k = innerWidth > 760 ? 1 : 1.45;
  camAnim = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(),
    p1: new THREE.Vector3(...v.pos).multiplyScalar(k), t1: new THREE.Vector3(...v.tgt) };
}

function go(n) {
  if (!models.after) return;
  step = n;
  flyTo(n);
  document.querySelectorAll('.step').forEach((s) => s.classList.toggle('on', +s.dataset.step === n));
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i === n - 1));
  document.getElementById('stepname').textContent = `${n} / 5 · ${STEP_NAMES[n - 1]}`;
  document.getElementById('panel').scrollTop = 0;
  clearTips(); resetAfter(); applyExplode(0); explodeInput.value = 0;
  chainGroup.visible = false; play.on = false; document.getElementById('play').textContent = '▶ 재생';
  overlay.visible = n <= 3; dataLines.visible = n === 2;
  controls.autoRotate = n === 1;
  if (n === 1) {
    showOnly('after');
    entrancePts.forEach((p) => tip('입구', p));
    doorPts.forEach((p) => tip('문 · 교차 동선', p));
  } else if (n === 2) {
    showOnly('data');
  } else if (n === 3) {
    showOnly('after');
    if (!chainLine) buildChain();
    play.t = 0; play.on = true; document.getElementById('play').textContent = '❚❚ 멈춤';
  } else if (n === 4) {
    setCompare('after');
  } else if (n === 5) {
    showOnly('after');
  }
}

// ---------- 루프 ----------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (step === 3 && models.after) {
    if (play.on) { play.t += dt; if (play.t >= PHASES[6]) { play.t = PHASES[6]; play.on = false; document.getElementById('play').textContent = '▶ 재생'; } }
    setProcess(play.t);
  }
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt / 1.2);
    const e = THREE.MathUtils.smootherstep(camAnim.t, 0, 1);
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e);
    controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
    if (camAnim.t >= 1) camAnim = null;
  }
  controls.update();
  renderer.render(scene, camera);
  updateTips();
  if (step === 5 && jointRoot) {
    const r = jCanvas.getBoundingClientRect();
    if (r.width > 0) {
      jRenderer.setSize(r.width, r.height, false);
      jCam.aspect = r.width / r.height; jCam.updateProjectionMatrix();
      const a = clock.elapsedTime * 0.4;
      // 강판과 볼트는 리브 안쪽 면(아래)에 있으므로 아래에서 올려다본다
      jCam.position.set(Math.cos(a) * 1.3, -1.0, Math.sin(a) * 1.3);
      jCam.lookAt(0, -0.12, 0);
      jRenderer.render(jScene, jCam);
    }
  }
});
