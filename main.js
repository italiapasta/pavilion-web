import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ===== 발표자 정보: 여기만 바꾸면 됩니다 =====
const AUTHOR = '손병재 · C535185';
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
  'P1_막힌패널':   { label: '여닫이 패널', mat: '합판 18t + 위 경첩 + 가스 스프링', color: '#debe8c', explode: 3.0 },
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

const hemi = new THREE.HemisphereLight('#ffffff', '#b9b1a3', 1.4);
scene.add(hemi);
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

const walk = { on: false, path: null, len: 0, s: 0, auto: true, free: false, speed: 1.1, yaw: 0, pitch: -0.04,
  pos: null, head: 0, eye: 1.6, jy: 0, vy: 0, drag: null, keys: {}, bob: 0, hudT: 0, panels: [], all: [], samples: [] };

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 왼쪽 패널(넓은 화면) 또는 아래 패널(좁은 화면)을 피해 모델을 보이는 쪽 가운데로
  if (walk.on) camera.clearViewOffset();
  else if (w > 760) camera.setViewOffset(w, h, -210, 0, w, h); else camera.setViewOffset(w, h, 0, h * 0.24, w, h);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- 불러오기 ----------
const loader = new GLTFLoader();
// 모델 파일은 models/ 폴더 안이나 맨 위 어느 쪽에 있어도 찾는다
const CANDIDATES = (f) => ['models/' + f, f];
const load = async (f) => {
  for (const p of CANDIDATES(f)) { try { return await loader.loadAsync(p); } catch (e) {} }
  throw new Error(f + ' 파일을 찾지 못했어요');
};
const getRes = async (f) => {
  for (const p of CANDIDATES(f)) { try { const r = await fetch(p); if (r.ok) return r; } catch (e) {} }
  throw new Error(f + ' 파일을 찾지 못했어요');
};
const getJSON = async (f) => (await getRes(f)).json();
const getText = async (f) => (await getRes(f)).text();

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
  load('pavilion_after.glb'),
  load('pavilion_before.glb'),
  load('data_shade.glb'),
  getJSON('process.json'),
  getJSON('counts_after.json'),
  getJSON('counts_before.json'),
  getText('report_after.txt'),
  getJSON('flaps.json').catch(() => null),
]).then(([a, b, d, proc, ca, cb, rep, fl]) => {
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
  flapData = fl; buildFlaps();
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
load('joint.glb').then((g) => {
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
addEventListener('keydown', (e) => { if (walk.on) return; if (e.key === 'ArrowRight') go(Math.min(5, step + 1)); if (e.key === 'ArrowLeft') go(Math.max(1, step - 1)); });

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
  flapMode = n === 1 ? 'demo' : 'closed';
  sun.position.copy(SUN_HOME);
  document.getElementById('daybox').style.display = n === 1 && flaps.length ? '' : 'none';
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
  if (walk.on) walkFrame(dt); else controls.update();
  updateFlaps(dt);
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
    renderFlapView(dt);
  }
  if (walk.on) updatePeople(dt);
});

// ---------- 걷기: 사람 눈높이로, 켄싱턴 가든스 잔디밭 위에서 ----------
const EYE = 1.6;
const $ = (id) => document.getElementById(id);
const ray = new THREE.Raycaster();
const UP = new THREE.Vector3(0, 1, 0);
const PLACE = {
  P1: ['막힌 패널 아래', '해가 가장 강한 자리 — 깊은 그늘', '#debe8c'],
  P2: ['루버 패널 아래', '날개 사이로 걸러진 빛', '#be8750'],
  P3: ['격자 패널 아래', '바닥에 떨어지는 빛 무늬', '#e8d0a5'],
};
// 보통 화면과 걷기 화면의 빛 설정
const LOOK = {
  normal: { hemi: 1.4, sun: 2.4, exp: 1.05, bg: '#efece6', fogNear: 45, fogFar: 90 },
  walk:   { hemi: 0.22, sun: 3.6, exp: 1.0, bg: '#bcd3e6', fogNear: 35, fogFar: 120 },
};
const SUN_HOME = sun.position.clone();

// ---- 주변: 잔디 · 어두운 바닥 · 나무 ----
const site = new THREE.Group(); site.visible = false; scene.add(site);
function grassTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#5f8a3c'; g.fillRect(0, 0, 512, 512);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26000; i++) {   // 풀잎 한 올씩
    const x = rnd() * 512, y = rnd() * 512, l = 2 + rnd() * 5;
    const k = rnd();
    g.strokeStyle = k < 0.33 ? '#4e7a2f' : k < 0.66 ? '#6f9a45' : '#86ad55';
    g.globalAlpha = 0.55; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 2, y - l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 70);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function buildSite() {
  const grass = new THREE.Mesh(new THREE.CircleGeometry(140, 96),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; site.add(grass);

  // 터널 아래 검은 바닥 (주 동선을 따라 폭 5.4m 띠)
  const r = process.route.map(R2T);
  const a = r[0], b = r[r.length - 1];
  const da = a.clone().sub(r[1]).normalize(), db = b.clone().sub(r[r.length - 2]).normalize();
  const strip = new THREE.CatmullRomCurve3([a.clone().addScaledVector(da, 0.8), ...r, b.clone().addScaledVector(db, 0.8)]);
  const N = 120, half = 2.7, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = strip.getPointAt(u), t = strip.getTangentAt(u);
    const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
    pos.push(p.x + n.x * half, 0.012, p.z + n.z * half, p.x - n.x * half, 0.012, p.z - n.z * half);
    if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals();
  const floor = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#1b1a19', roughness: 0.95, side: THREE.DoubleSide }));
  floor.receiveShadow = true; site.add(floor);

  // 공원 나무 (단순한 형태, 동선과 교차 동선은 피해서)
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const trunkM = new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 1 });
  const leafM = [new THREE.MeshStandardMaterial({ color: '#3f6b2e', roughness: 1, flatShading: true }),
                 new THREE.MeshStandardMaterial({ color: '#4d7a34', roughness: 1, flatShading: true })];
  const trunkG = new THREE.CylinderGeometry(0.22, 0.32, 1, 7), leafG = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 46; i++) {
    const ang = rnd() * Math.PI * 2, rad = 24 + rnd() * 70;
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    if (Math.abs(z) < 6 && Math.abs(x) < 40) continue;
    const h = 3 + rnd() * 3, crown = 2.4 + rnd() * 2.4;
    const tr = new THREE.Mesh(trunkG, trunkM); tr.scale.set(1, h, 1); tr.position.set(x, h / 2, z);
    const lf = new THREE.Mesh(leafG, leafM[i % 2]); lf.scale.set(crown, crown * 0.85, crown); lf.position.set(x, h + crown * 0.6, z);
    site.add(tr, lf);
  }
}
function applyLook(k) {
  const L = LOOK[k];
  hemi.intensity = L.hemi; sun.intensity = L.sun; renderer.toneMappingExposure = L.exp;
  scene.background.set(L.bg); scene.fog.color.set(L.bg); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  hemi.groundColor.set(k === 'walk' ? '#3a4a2a' : '#b9b1a3');
  ground.visible = grid.visible = k !== 'walk';
  site.visible = k === 'walk';
  // 걷기 화면은 그림자를 더 선명하게
  const size = k === 'walk' ? 4096 : 2048, ext = k === 'walk' ? 13 : 16;
  if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext });
  sun.shadow.camera.updateProjectionMatrix();
}

function buildWalkPath() {
  const r = process.route.map(R2T).map((v) => v.setY(0));
  const a = r[0], b = r[r.length - 1];
  const da = a.clone().sub(r[1]).normalize(), db = b.clone().sub(r[r.length - 2]).normalize();
  // 멀리서 닫힌 벽을 보며 다가가고, 반대편으로 빠져나간다
  const pts = [a.clone().addScaledVector(da, 9), a.clone().addScaledVector(da, 4), ...r,
               b.clone().addScaledVector(db, 4), b.clone().addScaledVector(db, 9)];
  walk.path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  walk.len = walk.path.getLength();
  walk.inA = 9 / walk.len; walk.inB = 1 - 9 / walk.len;
  for (let i = 0; i <= 300; i++) walk.samples.push(walk.path.getPointAt(i / 300));
  Object.entries(groups.after).forEach(([t, list]) => list.forEach((o) => {
    walk.all.push(o); if (t.startsWith('P')) walk.panels.push(o);
  }));
  buildSite();
  buildPeople();
}
function nearestU(p) {
  let best = 0, d = 1e9;
  walk.samples.forEach((q, i) => { const e = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (e < d) { d = e; best = i; } });
  return { u: best / 300, d: Math.sqrt(d) };
}

function sunAt(hour, doy = 213) {   // 런던, 8월 1일 (분석 기간 6~9월 가운데)
  const phi = THREE.MathUtils.degToRad(51.5);
  const dec = THREE.MathUtils.degToRad(23.45 * Math.sin(THREE.MathUtils.degToRad(360 / 365 * (284 + doy))));
  const ha = THREE.MathUtils.degToRad(15 * (hour - 12));
  const su = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha);
  const se = -Math.cos(dec) * Math.sin(ha);
  const sn = Math.cos(phi) * Math.sin(dec) - Math.sin(phi) * Math.cos(dec) * Math.cos(ha);
  return R2T([se, sn, Math.max(su, 0.03)]).normalize();
}
function setSun(hour) {
  sunHour = hour;
  sun.position.copy(sunAt(hour)).multiplyScalar(30);
  const h = Math.floor(hour), m = Math.round((hour - h) * 60);
  $('wsunt').textContent = `${h}:${String(m).padStart(2, '0')}`;
}

function enterWalk() {
  if (!models.after) return;
  if (!walk.path) buildWalkPath();
  walk.on = true; document.body.classList.add('walking');
  clearTips(); resetAfter(); applyExplode(0); explodeInput.value = 0;
  chainGroup.visible = false; play.on = false;
  showOnly('after'); overlay.visible = false; dataLines.visible = false;
  controls.enabled = false; controls.autoRotate = false; camAnim = null;
  walk.s = 0; walk.auto = true; walk.free = false; walk.eye = EYE; walk.jy = 0; walk.vy = 0; walk.yaw = 0; walk.pitch = -0.04;
  camera.fov = 64; camera.near = 0.05;
  applyLook('walk');
  flapMode = 'manual';
  flaps.forEach((f) => { f.open = false; });
  setSun(+$('wsun').value);
  resize(); syncWalkUI();
}
function exitWalk() {
  walk.on = false; document.body.classList.remove('walking');
  walk.keys = {};
  controls.enabled = true; camera.fov = 38; camera.near = 0.1;
  applyLook('normal');
  sun.position.copy(SUN_HOME);
  resize();
  go(step);
}
function syncWalkUI() {
  $('wplay').textContent = walk.auto ? '❚❚' : '▶';
  $('wmode').textContent = walk.free ? '자유 걷기 · WASD' : walk.auto ? '자동 걷기 · 동선 따라' : '멈춤';
}
function backToPath() {   // 자유 걷기에서 자동 걷기로 돌아갈 때 가장 가까운 동선 위치부터
  if (walk.free) { const n = nearestU(walk.pos); walk.s = n.u * walk.len; walk.yaw = 0; walk.free = false; }
}

const blurThen = (f) => (e) => { e.currentTarget.blur(); f(e); };
$('walkbtn').onclick = blurThen(enterWalk);
$('walkbtn2').onclick = blurThen(enterWalk);
$('wexit').onclick = exitWalk;
$('wplay').onclick = blurThen(() => {
  backToPath();
  if (walk.s >= walk.len - 0.01) walk.s = 0;
  walk.auto = !walk.auto; syncWalkUI();
});
$('wprog').oninput = (e) => { walk.free = false; walk.yaw = 0; walk.s = +e.target.value * walk.len; walk.auto = false; syncWalkUI(); };
$('wprog').onchange = (e) => e.target.blur();
$('wsun').oninput = (e) => { dayPlay = false; $('wday').textContent = '하루 재생'; setSun(+e.target.value); };
$('wday').onclick = blurThen(() => { dayPlay = !dayPlay; $('wday').textContent = dayPlay ? '❚❚ 멈춤' : '하루 재생'; });
$('wsun').onchange = (e) => e.target.blur();

const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'sl', KeyD: 'sr', ArrowLeft: 'l', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run', KeyC: 'crouch' };
addEventListener('keydown', (e) => {
  if (!walk.on) return;
  const k = KEYMAP[e.code];
  if (k) {
    walk.keys[k] = true; e.preventDefault();
    if (!walk.free && ['f', 'b', 'sl', 'sr'].includes(k)) {   // WASD를 누르면 그 자리에서 자유 걷기로
      walk.free = true; walk.auto = false;
      walk.pos = camera.position.clone().setY(0); walk.head = walk.curHead; walk.yaw = 0;
      syncWalkUI();
    }
  }
  if (e.code === 'KeyJ' && !e.repeat && walk.jy === 0) walk.vy = 3.3;   // 점프: 약 0.55m
  if (e.code === 'KeyE' && !e.repeat && aimed) aimed.open = !aimed.open;
  if (e.code === 'Space') { $('wplay').click(); e.preventDefault(); }
  if (e.code === 'Escape') exitWalk();
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) walk.keys[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { walk.keys = {}; });

canvas.addEventListener('pointerdown', (e) => {
  if (!walk.on) return;
  walk.drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (!walk.on || !walk.drag) return;
  const dx = (e.clientX - walk.drag.x) * 0.0045;
  if (walk.free) walk.head -= dx; else walk.yaw -= dx;
  walk.pitch = THREE.MathUtils.clamp(walk.pitch - (e.clientY - walk.drag.y) * 0.0035, -1.1, 1.2);
  walk.drag = { x: e.clientX, y: e.clientY };
});
const endDrag = () => { walk.drag = null; canvas.style.cursor = ''; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('dblclick', () => { if (walk.on) { walk.yaw = 0; walk.pitch = -0.04; } });

// 부재에 부딪히면 멈춘다 (무릎 · 가슴 높이 두 곳에서 확인)
const _o = new THREE.Vector3();
function blocked(from, dir, dist) {
  for (const y of [0.6, 1.4]) {
    ray.set(_o.set(from.x, y, from.z), dir); ray.far = dist + 0.3;
    if (ray.intersectObjects(walk.all, false).length) return true;
  }
  return false;
}

const _dir = new THREE.Vector3(), _mv = new THREE.Vector3(), _ax = new THREE.Vector3();
function walkFrame(dt) {
  if (dayPlay) {   // 하루 재생: 1초에 약 1시간
    let h = sunHour + dt * 1.0; if (h > 20) h = 6;
    $('wsun').value = h; setSun(h);
  }
  const k = walk.keys;
  let moving = false, h;
  if (walk.free) {
    walk.head += ((k.l ? 1 : 0) - (k.r ? 1 : 0)) * 1.8 * dt;
    const fw = (k.f ? 1 : 0) - (k.b ? 1 : 0), st = (k.sr ? 1 : 0) - (k.sl ? 1 : 0);
    h = walk.head;
    if (fw || st) {
      // 앞 = (sin h, cos h), 오른쪽 = (-cos h, sin h)
      _mv.set(Math.sin(h) * fw - Math.cos(h) * st, 0, Math.cos(h) * fw + Math.sin(h) * st).normalize();
      const d = (k.crouch ? 0.7 : k.run ? 3.0 : 1.4) * dt;
      // 막히면 축 방향으로 미끄러지듯
      if (!blocked(walk.pos, _mv, d)) { walk.pos.addScaledVector(_mv, d); moving = true; }
      else for (const ax of [[_mv.x, 0], [0, _mv.z]]) {
        _ax.set(ax[0], 0, ax[1]); if (_ax.lengthSq() < 1e-4) continue; _ax.normalize();
        if (!blocked(walk.pos, _ax, d)) { walk.pos.addScaledVector(_ax, d * 0.7); moving = true; break; }
      }
      if (walk.pos.length() > 90) walk.pos.setLength(90);
    }
    camera.position.set(walk.pos.x, 0, walk.pos.z);
  } else {
    walk.yaw += ((k.l ? 1 : 0) - (k.r ? 1 : 0)) * 1.6 * dt;
    if (walk.auto) { walk.s += walk.speed * dt; moving = true; }
    if (walk.s >= walk.len) { walk.s = walk.len; if (walk.auto) { walk.auto = false; syncWalkUI(); } moving = false; }
    if (walk.s < 0) walk.s = 0;
    const u = walk.s / walk.len;
    const p = walk.path.getPointAt(u), t = walk.path.getTangentAt(u);
    camera.position.set(p.x, 0, p.z);
    h = Math.atan2(t.x, t.z) + walk.yaw;
  }
  walk.curHead = h;
  // 웅크리기(C): 눈높이 1.6m → 1.0m, 점프(J): 중력 9.8 m/s²
  walk.eye += ((k.crouch ? 1.0 : EYE) - walk.eye) * Math.min(1, dt * 10);
  if (walk.jy > 0 || walk.vy > 0) {
    walk.vy -= 9.8 * dt; walk.jy += walk.vy * dt;
    if (walk.jy <= 0) { walk.jy = 0; walk.vy = 0; }
  }
  if (moving && walk.jy === 0) walk.bob += dt * (k.run && walk.free ? 11 : 7.5);
  camera.position.y = walk.eye + walk.jy + Math.sin(walk.bob) * 0.022;
  _dir.set(Math.sin(h) * Math.cos(walk.pitch), Math.sin(walk.pitch), Math.cos(h) * Math.cos(walk.pitch));
  camera.lookAt(camera.position.clone().add(_dir));

  walk.hudT -= dt;
  if (walk.hudT <= 0) {
    walk.hudT = 0.12;
    aimFlap();
    const n = walk.free ? nearestU(camera.position) : { u: walk.s / walk.len, d: 0 };
    if (!walk.free) { $('wprog').value = n.u.toFixed(3); $('wdist').textContent = walk.s.toFixed(1) + ' m'; }
    else $('wdist').textContent = '자유';
    ray.set(camera.position, UP); ray.far = Infinity;
    const hitP = ray.intersectObjects(walk.panels, false)[0];
    const hitAny = ray.intersectObjects(walk.all, false)[0];
    let place;
    const inside = n.u > walk.inA && n.u < walk.inB && n.d < 2.6;
    const nearEnd = Math.min(Math.abs(n.u - walk.inA), Math.abs(walk.inB - n.u)) * walk.len < 1.4;
    if (hitP && hitP.object.userData.flap) {
      const f = hitP.object.userData.flap;
      place = f.open ? ['여닫이 패널 아래 · 열림', '누군가 열어 둔 패널 — 바람과 하늘이 들어옴', '#debe8c']
                     : ['여닫이 패널 아래 · 닫힘', '그늘이 가장 필요한 자리 — 바라보고 E 키로 직접 열기', '#debe8c'];
    } else if (hitP) place = PLACE[hitP.object.userData.type.slice(0, 2)];
    else if (inside && nearEnd) place = ['입구', '벽이 아래에서 벌어져 길이 되는 자리', '#c8c2b8'];
    else if (inside) place = ['열린 칸', '패널 없이 하늘이 보이는 자리', '#9fc6e8'];
    else if (hitAny) place = ['벽 아래', '리브 사이로 빠져나가는 중', '#c8c2b8'];
    else place = walk.free ? ['잔디밭', '켄싱턴 가든스 — 멀리서는 닫힌 벽 하나', '#6f9a45']
               : n.u < 0.5 ? ['다가가는 중', '멀리서는 닫힌 벽 하나', '#6f9a45'] : ['빠져나온 뒤', '뒤돌아보면 다시 닫힌 벽', '#6f9a45'];
    $('whwhere').textContent = place[0];
    $('whwhere').style.setProperty('--c', place[2]);
    $('whnote').textContent = place[1];
  }
}

// ---------- 안에 있는 사람이 직접 여닫는 패널 (P1) ----------
// 그늘 일사가 가장 큰 칸은 평소에 닫혀 그늘을 만들고, 안에 있는 사람이 손잡이를 밀어(높은 칸은 줄을 당겨)
// 위 경첩을 축으로 바깥으로 연다. 가스 스프링이 원하는 각도(최대 55°)에서 붙잡아 준다.
const flaps = [];
let flapData = null, flapMode = 'closed', sunHour = 14, dayPlay = false, aimed = null;
const demo = { t: 0 };
const FLAP_MAX = THREE.MathUtils.degToRad(55);
const AIM_COLOR = new THREE.Color('#6a4a1a'), NO_EMIT = new THREE.Color('#000000');
function buildFlaps() {
  if (!flapData) return;
  (groups.after['P1_막힌패널'] || []).forEach((o) => {
    const f = flapData[o.name]; if (!f) return;
    const a = new THREE.Vector3(...f.a), b = new THREE.Vector3(...f.b);
    const pivot = new THREE.Group();
    pivot.position.copy(a).add(b).multiplyScalar(0.5);
    o.parent.add(pivot); pivot.updateMatrixWorld(true); pivot.attach(o);
    o.userData.base = o.position.clone();
    const axis = b.clone().sub(a).normalize();
    const n = new THREE.Vector3(...f.n).normalize();
    const c = new THREE.Vector3(...f.c).sub(pivot.position);
    const sign = c.clone().applyAxisAngle(axis, 0.2).sub(c).dot(n) > 0 ? 1 : -1;   // 아래 끝이 바깥으로 나가는 쪽
    const flap = { pivot, axis, sign, n, mesh: o, angle: 0, open: false };
    o.userData.flap = flap;
    flaps.push(flap);
  });
}
function updateFlaps(dt) {
  if (!flaps.length) return;
  let open = flaps.filter((f) => f.open).length;
  if (flapMode === 'demo') {   // 1단계: 안에 있는 사람들이 여기저기 패널을 여닫는 모습
    demo.t -= dt;
    if (demo.t <= 0) {
      demo.t = 0.7 + Math.random() * 0.8;
      const want = open < 14 ? false : open > 20 ? true : Math.random() < 0.5;   // 열린 것을 닫을지
      const pool = flaps.filter((f) => f.open === want);
      if (pool.length) { const f = pool[Math.floor(Math.random() * pool.length)]; f.open = !f.open; }
    }
  }
  open = 0;
  for (const f of flaps) {
    const target = flapMode !== 'closed' && f.open ? FLAP_MAX : 0;
    f.angle += THREE.MathUtils.clamp(target - f.angle, -dt * 1.2, dt * 1.2);
    f.pivot.quaternion.setFromAxisAngle(f.axis, f.sign * f.angle);
    if (f.open && flapMode !== 'closed') open++;
    f.mesh.material.emissive?.copy(f === aimed ? AIM_COLOR : NO_EMIT);
  }
  if (flapMode === 'demo') {
    document.getElementById('dayinfo').textContent = `안에 있는 사람들이 여닫는 중 · ${flaps.length}장 중 ${open}장 열림 · 패널을 클릭해 직접 열어 보세요`;
  }
}
// 걷기: 화면 가운데로 바라본 패널 (3.5m 안, 앞을 가리는 부재가 없을 때)
const _fw = new THREE.Vector3();
function aimFlap() {
  camera.getWorldDirection(_fw);
  ray.set(camera.position, _fw); ray.far = 3.5;
  const hit = ray.intersectObjects(walk.all, false)[0];
  ray.far = Infinity;
  aimed = hit && hit.object.userData.flap ? hit.object.userData.flap : null;
  $('waim').textContent = aimed ? (aimed.open ? 'E · 클릭 — 패널 닫기' : 'E · 클릭 — 패널 열기') : '';
}
// 클릭(끌지 않고 누름)으로 열고 닫기: 걷기에서는 바라본 패널, 1단계에서는 마우스 아래 패널
const _ndc = new THREE.Vector2();
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) { downAt = null; return; }
  downAt = null;
  if (walk.on) { aimFlap(); if (aimed) aimed.open = !aimed.open; return; }
  if (flapMode !== 'demo' || !flaps.length) return;
  _ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(_ndc, camera); ray.far = Infinity;
  const hit = ray.intersectObjects(flaps.map((f) => f.mesh), false)[0];
  if (hit) { const f = hit.object.userData.flap; f.open = !f.open; demo.t = 3; }   // 누른 뒤 잠시 시연을 쉰다
});

// ---------- 5단계: 여닫이 패널 상세 (분해 · 열고 닫기) ----------
// 바깥 = +z, 안 = -z. 패널은 위 경첩(y=0)을 축으로 아래 끝이 바깥으로 들린다.
const fCanvas = document.getElementById('flapview');
const fRenderer = new THREE.WebGLRenderer({ canvas: fCanvas, antialias: true, alpha: true });
fRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
fRenderer.outputColorSpace = THREE.SRGBColorSpace;
const fScene = new THREE.Scene();
fScene.add(new THREE.HemisphereLight('#ffffff', '#a59c8f', 1.5));
const fl1 = new THREE.DirectionalLight('#ffffff', 2.2); fl1.position.set(-2, 3, -3); fScene.add(fl1);
const fl2 = new THREE.DirectionalLight('#ffffff', 1.2); fl2.position.set(2, 1, 3); fScene.add(fl2);
const fCam = new THREE.PerspectiveCamera(30, 2, 0.05, 30);
const FM = (c, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: metal ? 0.45 : 0.8, metalness: metal });
const fParts = [];   // { obj, base, dir }
function fPart(obj, dir) { obj.userData.base = obj.position.clone(); fParts.push({ obj, dir: new THREE.Vector3(...dir) }); fScene.add(obj); return obj; }
const W = 1.1, Hh = 0.95;
// 리브 두 개 (양옆), 도리 (위)
const ribM = FM('#b07a46');
[-1, 1].forEach((sx) => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.2), ribM); r.position.set(sx * (W / 2 + 0.06), -0.55, -0.12); fPart(r, [sx * 0.35, 0, 0]); });
const pur = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.09, 0.09), FM('#c49662')); pur.position.set(0, 0.05, -0.05); fPart(pur, [0, 0.35, 0]);
// 경첩 두 개
const hingeM = FM('#5a5c60', 0.4);
[-0.35, 0.35].forEach((x) => {
  const g = new THREE.Group();
  const leaf1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.006), hingeM); leaf1.position.set(0, 0.03, 0.006);
  const leaf2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.006), hingeM); leaf2.position.set(0, -0.03, 0.006);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 8), hingeM); pin.rotation.z = Math.PI / 2; pin.position.z = 0.012;
  g.add(leaf1, leaf2, pin); g.position.set(x, 0, 0.0); fPart(g, [0, 0.15, 0.25]);
});
// 패널 (경첩 축에 매단 피벗) + 안쪽 손잡이
const fPivot = new THREE.Group(); fPart(fPivot, [0, 0, 0.45]);
const panel = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, 0.018), FM('#debe8c')); panel.position.set(0, -Hh / 2, 0.009); fPivot.add(panel);
const handle = new THREE.Group();
const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 10), FM('#3a3c40', 0.5)); hb.rotation.z = Math.PI / 2; hb.position.z = -0.05;
[-0.1, 0.1].forEach((x) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.05), FM('#3a3c40', 0.5)); leg.position.set(x, 0, -0.025); handle.add(leg); });
handle.add(hb); handle.position.set(0, -Hh + 0.12, 0); fPivot.add(handle);
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 12), FM('#3a3c40', 0.5)); ring.position.set(-0.4, -Hh + 0.06, -0.01); fPivot.add(ring);
// 가스 스프링: 리브(안쪽) A → 패널 B
const gasBody = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 10), FM('#222428', 0.6)); fScene.add(gasBody);
const gasRod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 8), FM('#c9ccd0', 0.8)); fScene.add(gasRod);
const gasA0 = new THREE.Vector3(W / 2 - 0.02, -0.15, -0.2), gasB0 = new THREE.Vector3(W / 2 - 0.06, -0.55, -0.01);   // B는 패널(피벗) 좌표
const gasDir = new THREE.Vector3(0, 0, -0.35);
// 줄과 클리트 (높은 칸): 패널 고리 → 리브 아래 클리트
const ropeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: '#7a5a2a' })); fScene.add(rope);
const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.03), FM('#3a3c40', 0.5)); cleat.position.set(-(W / 2 + 0.06), -1.2, -0.24); fPart(cleat, [-0.35, 0, -0.2]);
const flapEx = document.getElementById('flapex');
const fState = { t: 0 };
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _M = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
function placeBar(mesh, a, b) {
  _M.subVectors(b, a); const L = _M.length();
  mesh.position.copy(a).addScaledVector(_M, 0.5); mesh.scale.set(1, Math.max(L, 0.001), 1);
  mesh.quaternion.setFromUnitVectors(_Y, _M.normalize());
}
function renderFlapView(dt) {
  const r = fCanvas.getBoundingClientRect(); if (r.width <= 0) return;
  fRenderer.setSize(r.width, r.height, false); fCam.aspect = r.width / r.height; fCam.updateProjectionMatrix();
  fState.t += dt;
  const k = +flapEx.value;
  fParts.forEach((p) => p.obj.position.copy(p.obj.userData.base).addScaledVector(p.dir, k));
  const ang = THREE.MathUtils.degToRad(55) * (0.5 - 0.5 * Math.cos(fState.t * 0.9));   // 천천히 열고 닫기
  fPivot.rotation.x = -ang;
  fPivot.updateMatrixWorld(true);
  _A.copy(gasA0).addScaledVector(gasDir, k);
  _B.copy(gasB0).applyMatrix4(fPivot.matrixWorld);
  const mid = _A.clone().lerp(_B, 0.55);
  placeBar(gasBody, _A, mid); placeBar(gasRod, mid.clone().lerp(_A, 0.1), _B);
  const ringW = ring.getWorldPosition(new THREE.Vector3());
  const cl = cleat.position.clone().add(new THREE.Vector3(0, 0.04, 0));
  const pos = ropeGeo.attributes.position; pos.setXYZ(0, ringW.x, ringW.y, ringW.z); pos.setXYZ(1, cl.x, cl.y, cl.z); pos.needsUpdate = true;
  const a = fState.t * 0.25;
  fCam.position.set(-2.0 + Math.sin(a) * 0.6, 0.35, -3.4);   // 안쪽에서 비스듬히
  fCam.lookAt(0, -0.5, 0.15);
  fRenderer.render(fScene, fCam);
}

// ---------- 걷기: 주변 사람들 ----------
const people = [];
function personMesh(seed) {
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const shirts = ['#3d5a80', '#c8553d', '#2a9d8f', '#e9c46a', '#6d597a', '#f4f1de', '#264653', '#b5838d'];
  const pants = ['#2b2d42', '#4a4e69', '#6b705c', '#22223b', '#8d99ae'];
  const skin = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'][Math.floor(rnd() * 5)];
  const h = 1.58 + rnd() * 0.26, sc = h / 1.75;
  const g = new THREE.Group();
  const shirt = FM(shirts[Math.floor(rnd() * shirts.length)]), pant = FM(pants[Math.floor(rnd() * pants.length)]), sk = FM(skin);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 8), shirt); torso.position.y = 1.2; torso.scale.set(1, 1, 0.7);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), sk); head.position.y = 1.62;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), FM(['#2b1d14', '#5a3825', '#1a1a1a', '#a67b5b'][Math.floor(rnd() * 4)])); hair.position.y = 1.635;
  const limb = (r, l, m, y, x) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 3, 6), m); mesh.position.y = -l / 2 - r; piv.add(mesh); g.add(piv); return piv; };
  const legL = limb(0.065, 0.72, pant, 0.88, -0.09), legR = limb(0.065, 0.72, pant, 0.88, 0.09);
  const armL = limb(0.045, 0.5, shirt, 1.42, -0.22), armR = limb(0.045, 0.5, shirt, 1.42, 0.22);
  g.add(torso, head, hair);
  g.scale.setScalar(sc);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, legL, legR, armL, armR, phase: rnd() * 6.28 };
}
function buildPeople() {
  const paths = [walk.path];
  process.cross.forEach((c) => paths.push(new THREE.CatmullRomCurve3(c.map(R2T).map((v) => v.setY(0)))));
  let seed = 3;
  // 동선을 따라 걷는 사람 (주 동선 7명, 옆길마다 3명)
  paths.forEach((path, pi) => {
    const n = pi === 0 ? 7 : 3, L = path.getLength();
    for (let i = 0; i < n; i++) {
      const p = personMesh(seed++);
      p.path = path; p.L = L; p.u = (i + 0.3) / n; p.dirn = i % 2 ? 1 : -1;
      p.speed = (0.9 + (i % 3) * 0.18) / L; p.side = (i % 2 ? 0.55 : -0.55) * (pi === 0 ? 1 : 0.6);
      p.walking = true; site.add(p.g); people.push(p);
    }
  });
  // 잔디에 서 있는 사람들 (두세 명씩 모여서)
  [[-14, 6], [12, -7], [-6, -9], [16, 8]].forEach(([x, z], gi) => {
    for (let j = 0; j < 2 + (gi % 2); j++) {
      const p = personMesh(seed++);
      const ang = j / 3 * Math.PI * 2;
      p.g.position.set(x + Math.cos(ang) * 0.7, 0, z + Math.sin(ang) * 0.7);
      p.g.rotation.y = Math.atan2(x - p.g.position.x, z - p.g.position.z);   // 서로 마주 본다
      p.walking = false; site.add(p.g); people.push(p);
    }
  });
}
const _pp = new THREE.Vector3(), _pt = new THREE.Vector3();
function updatePeople(dt) {
  for (const p of people) {
    p.phase += dt * (p.walking ? 6 : 1.2);
    if (p.walking) {
      p.u += p.speed * dt * p.dirn;
      if (p.u > 1) { p.u = 1; p.dirn = -1; } if (p.u < 0) { p.u = 0; p.dirn = 1; }
      p.path.getPointAt(p.u, _pp); p.path.getTangentAt(p.u, _pt);
      if (p.dirn < 0) _pt.negate();
      const nx = -_pt.z, nz = _pt.x;   // 진행 방향 오른쪽으로 비켜 걷기
      p.g.position.set(_pp.x + nx * p.side * p.dirn, Math.abs(Math.sin(p.phase)) * 0.03, _pp.z + nz * p.side * p.dirn);
      p.g.rotation.y = Math.atan2(_pt.x, _pt.z);
      const sw = Math.sin(p.phase) * 0.5;
      p.legL.rotation.x = sw; p.legR.rotation.x = -sw; p.armL.rotation.x = -sw * 0.8; p.armR.rotation.x = sw * 0.8;
    } else {
      p.armL.rotation.x = Math.sin(p.phase) * 0.15; p.armR.rotation.x = 0.1;
      p.g.position.y = Math.sin(p.phase * 0.5) * 0.005;
    }
  }
}
