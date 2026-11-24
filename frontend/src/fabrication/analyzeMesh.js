// Reads an STL / OBJ / 3MF file in the browser and measures it: bounding box, volume,
// triangle count and whether the mesh is closed. Units are assumed to be millimetres.
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PREVIEWABLE = ['stl', 'obj', '3mf'];
const WATERTIGHT_CHECK_LIMIT = 400_000; // triangles; above this the check is skipped

function collectGeometry(object) {
  object.updateMatrixWorld(true);
  const parts = [];
  object.traverse((child) => {
    if (!child.isMesh) return;
    const g = child.geometry.clone().applyMatrix4(child.matrixWorld);
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  for (const g of parts) for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
  return parts.length === 1 ? parts[0] : mergeGeometries(parts);
}

export async function loadGeometry(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const buffer = await file.arrayBuffer();
  let geometry;
  if (ext === 'stl') geometry = new STLLoader().parse(buffer);
  else if (ext === 'obj') geometry = collectGeometry(new OBJLoader().parse(new TextDecoder().decode(buffer)));
  else if (ext === '3mf') geometry = collectGeometry(new ThreeMFLoader().parse(buffer));
  else return null;
  if (geometry.index) geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();
  return geometry;
}

// Every edge of a closed surface is shared by exactly two triangles.
function isWatertight(pos, triangleCount) {
  if (triangleCount > WATERTIGHT_CHECK_LIMIT) return null;
  const key = (i) => `${Math.round(pos[i] * 1e3)},${Math.round(pos[i + 1] * 1e3)},${Math.round(pos[i + 2] * 1e3)}`;
  const edges = new Map();
  for (let t = 0; t < triangleCount; t++) {
    const v = [key(t * 9), key(t * 9 + 3), key(t * 9 + 6)];
    for (let e = 0; e < 3; e++) {
      const a = v[e];
      const b = v[(e + 1) % 3];
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  for (const count of edges.values()) if (count !== 2) return false;
  return true;
}

export function measure(geometry) {
  const pos = geometry.attributes.position.array;
  const triangles = pos.length / 9;
  // Sum of signed tetrahedron volumes against the origin (divergence theorem).
  let volume = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [pos[i], pos[i + 1], pos[i + 2], pos[i + 3], pos[i + 4], pos[i + 5], pos[i + 6], pos[i + 7], pos[i + 8]];
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const r = (n) => Math.round(n * 100) / 100;
  return {
    bbox: { x: r(size.x), y: r(size.y), z: r(size.z) },
    volume_cm3: Math.round((Math.abs(volume) / 1000) * 1000) / 1000,
    triangles,
    watertight: isWatertight(pos, triangles) ?? false,
  };
}
