import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Procedural Shell Eco-marathon style prototype: teardrop shell, two steered front
// wheels, one driven rear wheel. Each part is its own group so it can be pulled
// out of the car as the visitor scrolls. Units are roughly metres; nose points +X.

const COLORS = {
  shellTop: '#ffffff',
  shellBottom: '#610721',
  canopy: '#1a1714',
  chassis: '#b9b2a8',
  tire: '#1f1b19',
  rim: '#d9d3ca',
  seat: '#3a3431',
  battery: '#4a4540',
  motor: '#8c1236',
  steering: '#2b2623',
  board: '#2f5d46',
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Half of a teardrop body of revolution around the X axis. `top` picks the upper half.
function shellHalf(top) {
  const profile = [
    [0, -1.5], [0.05, -1.45], [0.18, -1.2], [0.32, -0.8], [0.44, -0.3],
    [0.5, 0.3], [0.5, 0.8], [0.42, 1.15], [0.3, 1.35], [0.18, 1.45], [0, 1.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(profile, 48, top ? Math.PI : 0, Math.PI);
  geo.rotateZ(-Math.PI / 2); // lathe axis Y → X (nose at +X)
  geo.scale(1, 0.62, 0.78);
  return geo;
}

function mesh(geometry, color, opts = {}) {
  const m = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide, ...opts }),
  );
  m.castShadow = true;
  return m;
}

function wheel() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(0.18, 0.022, 12, 40), COLORS.tire, { roughness: 0.9 }));
  const disc = mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.012, 40), COLORS.rim, { metalness: 0.4, roughness: 0.3 });
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const hub = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 16), COLORS.steering);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

function buildCar() {
  const car = new THREE.Group();
  const parts = {};
  // Each part: group, resting position, exploded offset, and which phase moves it.
  const add = (key, object, rest, offset, phase = 'explode') => {
    const g = new THREE.Group();
    g.add(object);
    g.position.copy(rest);
    car.add(g);
    parts[key] = { group: g, rest: rest.clone(), offset, phase };
    return g;
  };

  const top = new THREE.Group();
  top.add(mesh(shellHalf(true), COLORS.shellTop, { roughness: 0.3 }));
  const canopy = mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), COLORS.canopy, {
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.85,
  });
  canopy.scale.set(0.42, 0.16, 0.2);
  canopy.position.set(0.3, 0.27, 0);
  top.add(canopy);
  add('shellTop', top, new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(0.1, 0.95, -1.1), 'lift');
  add('shellBottom', mesh(shellHalf(false), COLORS.shellBottom, { roughness: 0.35 }), new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(-0.2, -0.02, -2.1), 'drop');

  add('chassis', mesh(new THREE.BoxGeometry(1.7, 0.03, 0.36), COLORS.chassis, { metalness: 0.6, roughness: 0.35 }), new THREE.Vector3(0.1, 0.16, 0), new THREE.Vector3(0, 0, 0));

  const seat = new THREE.Group();
  const back = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.3), COLORS.seat, { roughness: 0.8 });
  back.position.set(-0.22, 0.1, 0);
  back.rotation.z = 0.5;
  seat.add(back, mesh(new THREE.BoxGeometry(0.5, 0.04, 0.3), COLORS.seat, { roughness: 0.8 }));
  add('seat', seat, new THREE.Vector3(0.05, 0.18, 0), new THREE.Vector3(0, 0.45, 0));

  const battery = mesh(new THREE.BoxGeometry(0.32, 0.12, 0.22), COLORS.battery);
  add('battery', battery, new THREE.Vector3(-0.5, 0.22, 0), new THREE.Vector3(-0.1, 0.75, 0));

  const motor = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 24), COLORS.motor, { metalness: 0.5, roughness: 0.35 });
  motor.rotation.x = Math.PI / 2;
  add('motor', motor, new THREE.Vector3(-0.95, 0.2, 0.1), new THREE.Vector3(-0.15, 0.45, 0.35));

  const steering = new THREE.Group();
  const wheelRing = mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 32), COLORS.steering);
  wheelRing.rotation.y = Math.PI / 2;
  const column = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), COLORS.steering);
  column.rotation.z = Math.PI / 2.6;
  column.position.set(0.12, -0.05, 0);
  steering.add(wheelRing, column);
  add('steering', steering, new THREE.Vector3(0.5, 0.36, 0), new THREE.Vector3(0.2, 0.6, 0));

  add('electronics', mesh(new THREE.BoxGeometry(0.18, 0.012, 0.13), COLORS.board, { roughness: 0.6 }), new THREE.Vector3(0.85, 0.2, 0), new THREE.Vector3(0.25, 0.85, 0));

  const wl = add('wheelL', wheel(), new THREE.Vector3(0.85, 0.2, 0.3), new THREE.Vector3(0, 0, 0.6));
  const wr = add('wheelR', wheel(), new THREE.Vector3(0.85, 0.2, -0.3), new THREE.Vector3(0, 0, -0.6));
  const rear = add('wheelRear', wheel(), new THREE.Vector3(-0.95, 0.2, 0), new THREE.Vector3(-0.6, 0, 0));

  return { car, parts, wheels: [wl, wr, rear] };
}

// Renders the car and drives it from `progressRef.current` (0 assembled → 1 reassembled).
// `labels` maps part keys to text shown next to each part in the exploded view.
export default function CarScene({ progressRef, labels = {} }) {
  const mountRef = useRef(null);
  const labelRefs = useRef({});

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    const target = new THREE.Vector3(0, 0.45, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a8, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.5, 5, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 15 });
    key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffe9ee, 0.6);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.14 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const { car, parts, wheels } = buildCar();
    scene.add(car);

    let distance = 6;
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      renderer.setSize(w, h, false);
      camera.aspect = w / h || 1;
      // Narrow frames need the camera further back to keep the whole car in view.
      distance = 4.7 / Math.min(1, camera.aspect / 1.15);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    // Only animate while the stage is on screen.
    let visible = false;
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(loop);
    });
    io.observe(mount);

    const world = new THREE.Vector3();
    let shown = progressRef.current ?? 0;
    const clock = new THREE.Clock();

    function loop() {
      frame = 0;
      if (!visible) return;
      const t = clock.getElapsedTime();
      shown += ((progressRef.current ?? 0) - shown) * 0.08;
      const p = shown;

      const back = 1 - smooth(0.78, 0.95, p);
      const amount = {
        lift: smooth(0.1, 0.3, p) * back,
        drop: smooth(0.28, 0.45, p) * back,
        explode: smooth(0.5, 0.66, p) * back,
      };
      for (const part of Object.values(parts)) {
        part.group.position.copy(part.rest).addScaledVector(part.offset, amount[part.phase]);
      }
      parts.shellTop.group.rotation.z = -0.25 * amount.lift;
      const rolling = smooth(0.85, 1, p);
      wheels.forEach((w) => (w.rotation.z = -t * 6 * rolling));

      car.rotation.y = -0.55 + p * 1.5 + Math.sin(t * 0.4) * 0.04;
      // Back the camera off while parts are spread out so they stay in frame.
      const d = distance * (1 + 0.28 * amount.explode);
      camera.position.set(Math.sin(0.62) * d, 1.7 + amount.lift * 0.4, Math.cos(0.62) * d);
      camera.lookAt(target.x, target.y + amount.explode * 0.25, target.z);
      renderer.render(scene, camera);

      // Pin HTML labels to their parts while exploded.
      const { clientWidth: w, clientHeight: h } = mount;
      for (const [k, el] of Object.entries(labelRefs.current)) {
        if (!el || !parts[k]) continue;
        parts[k].group.getWorldPosition(world).project(camera);
        const x = ((world.x + 1) / 2) * w;
        // Labels near the right edge point left so they are not clipped.
        const flip = x > w * 0.62;
        el.dataset.flip = flip ? '1' : '';
        el.style.transform = `translate(${x}px, ${((1 - world.y) / 2) * h}px)${flip ? ' translateX(calc(-100% - 20px))' : ''}`;
        el.style.opacity = String(smooth(0.6, 1, amount.explode));
      }
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      resizeObserver.disconnect();
      scene.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [progressRef]);

  return (
    <div ref={mountRef} className="car-scene">
      {Object.entries(labels).map(([k, text]) => (
        <span key={k} ref={(el) => (labelRefs.current[k] = el)} className="car-scene__label" aria-hidden="true">
          {text}
        </span>
      ))}
    </div>
  );
}
