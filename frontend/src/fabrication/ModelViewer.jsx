import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Interactive preview of a part: orbit with the mouse/finger, scroll to zoom.
export default function ModelViewer({ geometry, color = '#b3264a', bbox, label }) {
  const mountRef = useRef(null);
  const materialRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !geometry) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100000);

    // Centre the part on the grid, Z-up like a slicer.
    const geo = geometry.clone();
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    geo.translate(-center.x, -box.min.y, -center.z);
    const radius = Math.max(size.x, size.y, size.z) || 1;

    const material = new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.55 });
    materialRef.current = material;
    scene.add(new THREE.Mesh(geo, material));

    // Feature edges keep dark filaments readable against the dark stage.
    const edgesGeo = new THREE.EdgesGeometry(geo, 30);
    const edges = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 }));
    scene.add(edges);

    const grid = new THREE.GridHelper(radius * 3, 30, 0x6e6e73, 0x3a3a3c);
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    scene.add(grid);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444448, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(radius, radius * 2, radius * 1.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd6e0, 1.2);
    rim.position.set(-radius * 1.5, radius, -radius);
    scene.add(rim);

    camera.position.set(radius * 1.9, radius * 1.5, radius * 2.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, size.y / 2, 0);
    controls.enableDamping = true;
    controls.update();

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      renderer.setSize(w, h, false);
      camera.aspect = w / h || 1;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geo.dispose();
      edgesGeo.dispose();
      edges.material.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [geometry]);

  // Colour changes update the material without rebuilding the scene.
  useEffect(() => {
    materialRef.current?.color.set(color);
  }, [color]);

  return (
    <div className="viewer">
      <div ref={mountRef} className="viewer__canvas" />
      {bbox && (
        <div className="viewer__hud">
          <span className="axis axis--x">X {bbox.x} mm</span>
          <span className="axis axis--y">Y {bbox.y} mm</span>
          <span className="axis axis--z">Z {bbox.z} mm</span>
        </div>
      )}
      {label && <div className="viewer__label">{label}</div>}
    </div>
  );
}
