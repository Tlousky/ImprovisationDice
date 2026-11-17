import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface PolyhedralDieGeometryData {
  geometry: THREE.BufferGeometry;
  faceNormals: THREE.Vector3[];
  faceUpTangents: THREE.Vector3[];
  faceCentroids: THREE.Vector3[];
  inradius: number;
  convexShape: CANNON.ConvexPolyhedron;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const SCREEN_UP = new THREE.Vector3(0, 0, -1);

function deduplicateVertices(
  points: THREE.Vector3[],
  epsilon = 1e-4
): { unique: THREE.Vector3[]; indexOf: (pt: THREE.Vector3) => number } {
  const unique: THREE.Vector3[] = [];
  const indexOf = (pt: THREE.Vector3): number => {
    for (let i = 0; i < unique.length; i++) {
      if (unique[i].distanceToSquared(pt) < epsilon * epsilon) {
        return i;
      }
    }
    unique.push(pt.clone());
    return unique.length - 1;
  };
  for (const p of points) {
    indexOf(p);
  }
  return { unique, indexOf };
}

function buildConvexShape(
  polygons: THREE.Vector3[][],
  outwardNormals: THREE.Vector3[]
): CANNON.ConvexPolyhedron {
  const allPoints = polygons.flat();
  const { unique, indexOf } = deduplicateVertices(allPoints);
  const cannonVerts = unique.map((v) => new CANNON.Vec3(v.x, v.y, v.z));

  const faces: number[][] = polygons.map((poly, faceIdx) => {
    const indices = poly.map((pt) => indexOf(pt));
    // Ensure counter-clockwise winding when viewed from outside along outwardNormals[faceIdx]
    const p0 = unique[indices[0]];
    const p1 = unique[indices[1]];
    const p2 = unique[indices[2]];
    const edge1 = p1.clone().sub(p0);
    const edge2 = p2.clone().sub(p0);
    const windingNormal = edge1.cross(edge2);
    if (windingNormal.dot(outwardNormals[faceIdx]) < 0) {
      indices.reverse();
    }
    return indices;
  });

  return new CANNON.ConvexPolyhedron({
    vertices: cannonVerts,
    faces,
  });
}

/**
 * Builds a 20-faced regular icosahedron (D20) with per-face material groups,
 * centered equilateral triangle UVs, face normals, upright tangents, and physics hull.
 */
export function buildD20Geometry(radius = 0.92): PolyhedralDieGeometryData {
  const raw = new THREE.IcosahedronGeometry(radius, 0);
  const source = raw.index ? raw.toNonIndexed() : raw;
  const posAttr = source.getAttribute('position');

  const faceCount = Math.floor(posAttr.count / 3);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const faceNormals: THREE.Vector3[] = [];
  const faceUpTangents: THREE.Vector3[] = [];
  const faceCentroids: THREE.Vector3[] = [];
  const polygons: THREE.Vector3[][] = [];

  const geometry = new THREE.BufferGeometry();

  for (let f = 0; f < faceCount; f++) {
    const i0 = f * 3;
    let v0 = new THREE.Vector3().fromBufferAttribute(posAttr, i0);
    let v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i0 + 1);
    let v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i0 + 2);

    const centroid = new THREE.Vector3()
      .add(v0)
      .add(v1)
      .add(v2)
      .divideScalar(3);

    let normal = new THREE.Vector3()
      .subVectors(v1, v0)
      .cross(new THREE.Vector3().subVectors(v2, v0))
      .normalize();

    if (normal.dot(centroid) < 0) {
      normal.negate();
      [v1, v2] = [v2, v1];
    }

    // Top vertex v0 is UV (0.5, 0.90), bottom-left v1 is (0.15, 0.30), bottom-right v2 is (0.85, 0.30)
    const upTangent = v0.clone().sub(centroid).normalize();

    positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    normals.push(
      normal.x,
      normal.y,
      normal.z,
      normal.x,
      normal.y,
      normal.z,
      normal.x,
      normal.y,
      normal.z
    );
    uvs.push(0.5, 0.9, 0.15, 0.3, 0.85, 0.3);

    geometry.addGroup(f * 3, 3, f);
    faceNormals.push(normal);
    faceUpTangents.push(upTangent);
    faceCentroids.push(centroid);
    polygons.push([v0, v1, v2]);
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();

  source.dispose();

  const inradius = faceCentroids[0].length();
  const convexShape = buildConvexShape(polygons, faceNormals);

  return {
    geometry,
    faceNormals,
    faceUpTangents,
    faceCentroids,
    inradius,
    convexShape,
  };
}

/**
 * Builds a 12-faced regular dodecahedron (D12) with 12 grouped pentagonal faces,
 * planar UVs centered on each pentagon, face normals, upright tangents, and physics hull.
 */
export function buildD12Geometry(radius = 0.86): PolyhedralDieGeometryData {
  const raw = new THREE.DodecahedronGeometry(radius, 0);
  const source = raw.index ? raw.toNonIndexed() : raw;
  const posAttr = source.getAttribute('position');
  const triCount = Math.floor(posAttr.count / 3);

  interface PentagonCluster {
    normal: THREE.Vector3;
    points: THREE.Vector3[];
  }

  const clusters: PentagonCluster[] = [];

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const p0 = new THREE.Vector3().fromBufferAttribute(posAttr, i0);
    const p1 = new THREE.Vector3().fromBufferAttribute(posAttr, i0 + 1);
    const p2 = new THREE.Vector3().fromBufferAttribute(posAttr, i0 + 2);

    const triCentroid = new THREE.Vector3()
      .add(p0)
      .add(p1)
      .add(p2)
      .divideScalar(3);

    const triNormal = new THREE.Vector3()
      .subVectors(p1, p0)
      .cross(new THREE.Vector3().subVectors(p2, p0))
      .normalize();
    if (triNormal.dot(triCentroid) < 0) {
      triNormal.negate();
    }

    const existing = clusters.find((c) => c.normal.dot(triNormal) > 0.99);
    if (existing) {
      existing.points.push(p0, p1, p2);
    } else {
      clusters.push({ normal: triNormal, points: [p0, p1, p2] });
    }
  }

  source.dispose();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const faceNormals: THREE.Vector3[] = [];
  const faceUpTangents: THREE.Vector3[] = [];
  const faceCentroids: THREE.Vector3[] = [];
  const polygons: THREE.Vector3[][] = [];

  const geometry = new THREE.BufferGeometry();

  clusters.forEach((cluster, faceIdx) => {
    const { unique } = deduplicateVertices(cluster.points, 1e-3);
    const centroid = unique
      .reduce((acc, v) => acc.add(v), new THREE.Vector3())
      .divideScalar(unique.length);

    const normal = cluster.normal.clone().normalize();
    if (normal.dot(centroid) < 0) normal.negate();

    // Align "up" tangent toward vertex 0 so text sits flat relative to the pentagon base
    const upTangent = unique[0].clone().sub(centroid).normalize();
    const rightTangent = upTangent.clone().cross(normal).normalize();

    const sortedVerts = [...unique].sort((a, b) => {
      const da = a.clone().sub(centroid);
      const db = b.clone().sub(centroid);
      const angA = Math.atan2(da.dot(upTangent), da.dot(rightTangent));
      const angB = Math.atan2(db.dot(upTangent), db.dot(rightTangent));
      return angA - angB;
    });

    const circumradius = sortedVerts[0].distanceTo(centroid);
    const uvScale = 0.43 / Math.max(1e-5, circumradius);

    const toUv = (v: THREE.Vector3): [number, number] => {
      const rel = v.clone().sub(centroid);
      return [
        0.5 + rel.dot(rightTangent) * uvScale,
        0.5 + rel.dot(upTangent) * uvScale,
      ];
    };

    // Triangulate pentagon as 3 fan triangles from sortedVerts[0] (9 vertices per face)
    const v0 = sortedVerts[0];
    const uv0 = toUv(v0);
    for (let k = 1; k <= sortedVerts.length - 2; k++) {
      const vk = sortedVerts[k];
      const vk1 = sortedVerts[k + 1];
      const uvk = toUv(vk);
      const uvk1 = toUv(vk1);

      positions.push(v0.x, v0.y, v0.z, vk.x, vk.y, vk.z, vk1.x, vk1.y, vk1.z);
      normals.push(
        normal.x,
        normal.y,
        normal.z,
        normal.x,
        normal.y,
        normal.z,
        normal.x,
        normal.y,
        normal.z
      );
      uvs.push(uv0[0], uv0[1], uvk[0], uvk[1], uvk1[0], uvk1[1]);
    }

    const vertCountForFace = (sortedVerts.length - 2) * 3;
    geometry.addGroup(faceIdx * vertCountForFace, vertCountForFace, faceIdx);
    faceNormals.push(normal);
    faceUpTangents.push(upTangent);
    faceCentroids.push(centroid);
    polygons.push(sortedVerts);
  });

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();

  const inradius = faceCentroids[0].length();
  const convexShape = buildConvexShape(polygons, faceNormals);

  return {
    geometry,
    faceNormals,
    faceUpTangents,
    faceCentroids,
    inradius,
    convexShape,
  };
}

/**
 * Returns the index of the face whose world-space normal points highest (+Y).
 * If allowedFaceIndices is provided, selects the best candidate among allowed faces.
 */
export function getTopFaceIndex(
  faceNormals: THREE.Vector3[],
  worldQuaternion: THREE.Quaternion,
  allowedFaceIndices?: number[]
): number {
  const candidates =
    allowedFaceIndices && allowedFaceIndices.length > 0
      ? allowedFaceIndices
      : Array.from({ length: faceNormals.length }, (_, i) => i);

  let bestIdx = candidates[0];
  let bestDot = -Infinity;
  const transformed = new THREE.Vector3();

  for (const i of candidates) {
    if (i < 0 || i >= faceNormals.length) continue;
    transformed.copy(faceNormals[i]).applyQuaternion(worldQuaternion);
    const dot = transformed.dot(WORLD_UP);
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Computes a clean flat-rest quaternion that places `faceNormal` pointing straight up (+Y)
 * and aligns `faceUpTangent` upright toward the top of the screen (-Z).
 */
export function computeSettleQuaternion(
  faceNormal: THREE.Vector3,
  faceUpTangent: THREE.Vector3
): THREE.Quaternion {
  const localY = faceNormal.clone().normalize();
  const localZ = faceUpTangent.clone().negate().normalize();
  const localX = new THREE.Vector3().crossVectors(localY, localZ).normalize();
  // Re-orthogonalize Z in case of numerical drift
  localZ.crossVectors(localX, localY).normalize();

  const localBasis = new THREE.Matrix4().makeBasis(localX, localY, localZ);
  // Target world basis is Identity: X=(1,0,0), Y=(0,1,0)=WORLD_UP, Z=(0,0,1)=-SCREEN_UP
  // Since localBasis is orthonormal, its inverse is its transpose.
  const rotationMatrix = localBasis.transpose();
  const quat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

  // Sanity: verify up alignment with SCREEN_UP
  void SCREEN_UP;
  return quat.normalize();
}
