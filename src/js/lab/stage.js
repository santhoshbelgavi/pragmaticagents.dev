// Shared 3D stage for every lab page: renderer, glow, lights, floor, orbit camera,
// HTML labels pinned to 3D points, and the frame loop. A lab page builds its own
// objects on top of this and passes an update function to start().
//
//   const st = createStage({ stageEl, canvas, labelEl, target: [0, 4, 0], halfWidth: 18, halfHeight: 10 });
//   const box = st.solid(new THREE.BoxGeometry(2, 2, 2));        // dark body with brass edges
//   const tag = st.addLabel("Title", "subtitle", new THREE.Vector3(0, 3, 0));
//   tag.set("New title", "new subtitle");
//   st.start((dt, elapsed) => { ...move things... });
//
// Colours: anything brighter than LOOK.bloom.threshold glows. Use MeshBasicMaterial with
// toneMapped: false and a colour multiplied above 1.0 for things that should emit light.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export { THREE };

export const LOOK = {
  bg: 0x100d0a, floor: 0x1b1712, grid: 0x3a3126,
  structure: 0x2a241c, edge: 0xc99a56,
  gold: 0xe2ad62, teal: 0x4fb8ad, steel: 0x8ea2b8, red: 0xff5a4a,
  bloom: { strength: 0.75, radius: 0.55, threshold: 0.82 },
};
// A colour bright enough to glow.
export const glow = (hex, k = 1.9) => new THREE.Color(hex).multiplyScalar(k);

export function createStage({
  stageEl, canvas, labelEl,
  target = [0, 4, 0],      // the point the camera looks at
  halfWidth = 18,          // half the scene's width, used to frame it on any screen shape
  halfHeight = 10,
  elevation = 17, azimuth = -24, // home camera angles in degrees
  bloom = LOOK.bloom,
  floor = true,
} = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LOOK.bg);
  scene.fog = new THREE.FogExp2(LOOK.bg, 0.011);

  const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 300);
  const controls = new OrbitControls(camera, canvas);
  const homeTarget = new THREE.Vector3(...target);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495; // stay above the floor
  controls.minDistance = 5;
  controls.maxDistance = 110;
  controls.autoRotateSpeed = 0.55;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), bloom.strength, bloom.radius, bloom.threshold));
  composer.addPass(new OutputPass());

  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1a1410, 0.9));
  const key = new THREE.DirectionalLight(0xffe2b8, 1.6);
  key.position.set(-10, 22, 14);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fa4d6, 0.7);
  rim.position.set(18, 8, -16);
  scene.add(rim);

  if (floor) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshStandardMaterial({ color: LOOK.floor, roughness: 0.95 }));
    f.rotation.x = -Math.PI / 2;
    scene.add(f);
    const g = new THREE.GridHelper(160, 80, LOOK.grid, LOOK.grid);
    g.position.y = 0.01; g.material.transparent = true; g.material.opacity = 0.45;
    scene.add(g);
  }

  // ----- helpers for building things -----
  function solid(geometry, opts = {}) {
    const mat = new THREE.MeshStandardMaterial({ color: LOOK.structure, roughness: 0.6, metalness: 0.25, transparent: true, ...opts });
    const mesh = new THREE.Mesh(geometry, mat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), new THREE.LineBasicMaterial({ color: LOOK.edge, transparent: true, opacity: 0.7 }));
    mesh.add(edges);
    scene.add(mesh);
    return { mesh, mat, edgeMat: edges.material };
  }

  const labels = [];
  function addLabel(text, sub, pos, className = "") {
    const el = document.createElement("div");
    el.className = "wf-label " + className;
    const strong = document.createElement("strong"), span = document.createElement("span");
    el.append(strong, span);
    labelEl.appendChild(el);
    const label = { el, pos, set(t, s) { strong.textContent = t; span.textContent = s || ""; span.hidden = !s; } };
    label.set(text, sub);
    labels.push(label);
    return label;
  }
  const v = new THREE.Vector3();
  function placeLabels() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    for (const l of labels) {
      v.copy(l.pos).project(camera);
      l.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      l.el.style.visibility = v.z > 1 || v.z < -1 ? "hidden" : "";
    }
  }

  // ----- camera -----
  function homePosition() {
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(halfWidth / (tanV * camera.aspect), halfHeight / tanV) * 1.04;
    const el = THREE.MathUtils.degToRad(elevation), az = THREE.MathUtils.degToRad(azimuth);
    return new THREE.Vector3(
      homeTarget.x + dist * Math.cos(el) * Math.sin(az),
      homeTarget.y + dist * Math.sin(el),
      homeTarget.z + dist * Math.cos(el) * Math.cos(az));
  }
  let fly = null, userMoved = false;
  const orbitListeners = [];
  function setOrbit(on) { controls.autoRotate = on; orbitListeners.forEach((cb) => cb(on)); }
  function flyTo({ pos, target: t }) {
    fly = { k: 0, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), pos, target: t };
    userMoved = true;
  }
  function flyHome() { flyTo({ pos: homePosition(), target: homeTarget.clone() }); userMoved = false; }
  controls.addEventListener("start", () => { userMoved = true; fly = null; setOrbit(false); });

  function resize() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 52 : 40;
    camera.updateProjectionMatrix();
    if (!userMoved && !fly) camera.position.copy(homePosition());
  }
  new ResizeObserver(resize).observe(stageEl);
  resize();

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotate = !reducedMotion;

  function start(update) {
    let last = performance.now(), elapsed = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; elapsed += dt;
      if (update) update(dt, elapsed);
      if (fly) {
        fly.k = Math.min(1, fly.k + dt / 1.2);
        const e = fly.k * fly.k * (3 - 2 * fly.k);
        camera.position.lerpVectors(fly.fromPos, fly.pos, e);
        controls.target.lerpVectors(fly.fromTarget, fly.target, e);
        if (fly.k >= 1) fly = null;
      }
      controls.update();
      composer.render();
      placeLabels();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  return {
    scene, camera, controls, renderer, solid, addLabel, flyTo, flyHome, setOrbit,
    isOrbiting: () => controls.autoRotate,
    onOrbitChange: (cb) => orbitListeners.push(cb),
    reducedMotion, start,
  };
}
