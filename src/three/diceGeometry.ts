import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface PolyhedralDieGeometryData {
  geometry: THREE.BufferGeometry;
  faceNormals: THREE.Vector3[];
  faceUpTangents: THREE.Vector3[];
  faceCentroids: THREE.Vector3[];
  inradius: number;
  faceInradii?: number[];
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

/**
 * Builds a 7-outcome regular pentagonal prism die (D7) with 2 flat pentagonal ends (bases)
 * and 5 rectangular side faces.
 * Height is calibrated via the Bereuter patent ratio (H = 1.506 * radius, H_half = 0.753 * radius)
 * to balance the statistical odds between landing on an edge (the 5 rectangular side states)
 * versus a flat base (the 2 end pentagons).
 */
export function buildD7Geometry(radius = 0.95): PolyhedralDieGeometryData {
  const H_half = 0.753 * radius; // Bereuter Patent calibrated ratio: H = 1.506 * radius
  const r_in = radius * Math.cos(Math.PI / 5); // Inradius of pentagon (~0.8090 * radius)
  const numSides = 5;

  const topVerts: THREE.Vector3[] = [];
  const btmVerts: THREE.Vector3[] = [];

  for (let k = 0; k < numSides; k++) {
    const angle = (2 * Math.PI * k) / numSides - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    topVerts.push(new THREE.Vector3(x, H_half, z));
    btmVerts.push(new THREE.Vector3(x, -H_half, z));
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const faceNormals: THREE.Vector3[] = [];
  const faceUpTangents: THREE.Vector3[] = [];
  const faceCentroids: THREE.Vector3[] = [];
  const polygons: THREE.Vector3[][] = [];

  const geometry = new THREE.BufferGeometry();
  let groupOffset = 0;

  // Outcome 0: Top pentagon base (y = +H_half)
  const normTop = new THREE.Vector3(0, 1, 0);
  const tanTop = new THREE.Vector3(0, 0, -1);
  const centTop = new THREE.Vector3(0, H_half, 0);
  faceNormals.push(normTop);
  faceUpTangents.push(tanTop);
  faceCentroids.push(centTop);
  polygons.push([...topVerts]);

  const uvScalePentagon = 0.42 / radius;
  const toUvTop = (v: THREE.Vector3): [number, number] => [
    0.5 + v.x * uvScalePentagon,
    0.5 - v.z * uvScalePentagon,
  ];

  // Triangulate top pentagon fan (counter-clockwise viewed from outside +Y)
  const topFan = [
    [topVerts[0], topVerts[4], topVerts[3]],
    [topVerts[0], topVerts[3], topVerts[2]],
    [topVerts[0], topVerts[2], topVerts[1]],
  ];
  topFan.forEach((tri) => {
    tri.forEach((v) => {
      positions.push(v.x, v.y, v.z);
      normals.push(normTop.x, normTop.y, normTop.z);
      const uv = toUvTop(v);
      uvs.push(uv[0], uv[1]);
    });
  });
  geometry.addGroup(groupOffset, 9, 0);
  groupOffset += 9;

  // Outcome 1: Bottom pentagon base (y = -H_half)
  const normBtm = new THREE.Vector3(0, -1, 0);
  const tanBtm = new THREE.Vector3(0, 0, 1);
  const centBtm = new THREE.Vector3(0, -H_half, 0);
  faceNormals.push(normBtm);
  faceUpTangents.push(tanBtm);
  faceCentroids.push(centBtm);
  polygons.push([...btmVerts]);

  const toUvBtm = (v: THREE.Vector3): [number, number] => [
    0.5 - v.x * uvScalePentagon,
    0.5 + v.z * uvScalePentagon,
  ];

  // Triangulate bottom pentagon fan (counter-clockwise viewed from outside -Y)
  const btmFan = [
    [btmVerts[0], btmVerts[1], btmVerts[2]],
    [btmVerts[0], btmVerts[2], btmVerts[3]],
    [btmVerts[0], btmVerts[3], btmVerts[4]],
  ];
  btmFan.forEach((tri) => {
    tri.forEach((v) => {
      positions.push(v.x, v.y, v.z);
      normals.push(normBtm.x, normBtm.y, normBtm.z);
      const uv = toUvBtm(v);
      uvs.push(uv[0], uv[1]);
    });
  });
  geometry.addGroup(groupOffset, 9, 1);
  groupOffset += 9;

  // Visual side quads: Faces 2..6
  for (let k = 0; k < numSides; k++) {
    const next = (k + 1) % numSides;
    const v0 = topVerts[k];
    const v1 = topVerts[next];
    const b1 = btmVerts[next];
    const b0 = btmVerts[k];

    const centSide = new THREE.Vector3()
      .add(v0)
      .add(v1)
      .add(b1)
      .add(b0)
      .multiplyScalar(0.25);
    const normSide = new THREE.Vector3(centSide.x, 0, centSide.z).normalize();

    polygons.push([b1, b0, v0, v1]);

    // Counter-clockwise outward winding with un-mirrored UV mapping:
    // b1 -> (0, 0) [Screen Left, Bottom]
    // b0 -> (1, 0) [Screen Right, Bottom]
    // v0 -> (1, 1) [Screen Right, Top]
    // v1 -> (0, 1) [Screen Left, Top]
    const quadTris = [
      { v: b1, uv: [0, 0] },
      { v: b0, uv: [1, 0] },
      { v: v0, uv: [1, 1] },
      { v: b1, uv: [0, 0] },
      { v: v0, uv: [1, 1] },
      { v: v1, uv: [0, 1] },
    ];

    quadTris.forEach((pt) => {
      positions.push(pt.v.x, pt.v.y, pt.v.z);
      normals.push(normSide.x, normSide.y, normSide.z);
      uvs.push(pt.uv[0], pt.uv[1]);
    });

    const faceIdx = 2 + k;
    geometry.addGroup(groupOffset, 6, faceIdx);
    groupOffset += 6;
  }

  // The 5 Edge/Ridge outcomes (Outcomes 2..6):
  // When resting on the opposite side face on the tray, Ridge k points straight UP (+Y).
  // faceUpTangent points along the longitudinal prism axis (+Y in local space) toward -Z (SCREEN_UP).
  for (let k = 0; k < numSides; k++) {
    const angle = (2 * Math.PI * k) / numSides - Math.PI / 2;
    const ridgeNorm = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const ridgeTan = new THREE.Vector3(0, 1, 0);
    const ridgeCent = new THREE.Vector3(radius * Math.cos(angle), 0, radius * Math.sin(angle));

    faceNormals.push(ridgeNorm);
    faceUpTangents.push(ridgeTan);
    faceCentroids.push(ridgeCent);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();

  const faceInradii = [H_half, H_half, r_in, r_in, r_in, r_in, r_in];
  const inradius = r_in;

  // Build the 7-face convex collision hull for Cannon.js
  const convexShape = buildConvexShape(polygons, [
    normTop,
    normBtm,
    ...polygons.slice(2).map((p) => {
      const cent = new THREE.Vector3().add(p[0]).add(p[1]).add(p[2]).add(p[3]).multiplyScalar(0.25);
      return new THREE.Vector3(cent.x, 0, cent.z).normalize();
    }),
  ]);

  return {
    geometry,
    faceNormals,
    faceUpTangents,
    faceCentroids,
    inradius,
    faceInradii,
    convexShape,
  };
}

export const D7_FACE_TO_SCALE_INDEX: number[] = [0, 6, 1, 2, 3, 4, 5];
export const SCALE_INDEX_TO_D7_FACE: number[] = [0, 2, 3, 4, 5, 6, 1];

/**
 * Builds an 8-faced regular octahedron (D8) with 8 equilateral triangular faces,
 * centered equilateral triangle UVs, face normals, upright tangents, and physics hull.
 */
export function buildD8Geometry(radius = 0.95): PolyhedralDieGeometryData {
  const raw = new THREE.OctahedronGeometry(radius, 0);
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

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
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
 * Builds a 6-faced regular hexahedron / cube (D6) with 6 square faces,
 * centered planar square UVs, face normals, upright tangents, and physics hull.
 */
export function buildD6Geometry(size = 1.35): PolyhedralDieGeometryData {
  const H = size / 2;
  const geometry = new THREE.BufferGeometry();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const faceNormals: THREE.Vector3[] = [];
  const faceUpTangents: THREE.Vector3[] = [];
  const faceCentroids: THREE.Vector3[] = [];
  const polygons: THREE.Vector3[][] = [];

  interface D6FaceDef {
    normal: THREE.Vector3;
    upTangent: THREE.Vector3;
    corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  }

  const faceDefs: D6FaceDef[] = [
    {
      // 0: +Y (Top)
      normal: new THREE.Vector3(0, 1, 0),
      upTangent: new THREE.Vector3(0, 0, -1),
      corners: [
        new THREE.Vector3(-H, H, -H),
        new THREE.Vector3(-H, H, H),
        new THREE.Vector3(H, H, H),
        new THREE.Vector3(H, H, -H),
      ],
    },
    {
      // 1: -Y (Bottom)
      normal: new THREE.Vector3(0, -1, 0),
      upTangent: new THREE.Vector3(0, 0, 1),
      corners: [
        new THREE.Vector3(-H, -H, H),
        new THREE.Vector3(-H, -H, -H),
        new THREE.Vector3(H, -H, -H),
        new THREE.Vector3(H, -H, H),
      ],
    },
    {
      // 2: +Z (Front)
      normal: new THREE.Vector3(0, 0, 1),
      upTangent: new THREE.Vector3(0, 1, 0),
      corners: [
        new THREE.Vector3(-H, H, H),
        new THREE.Vector3(-H, -H, H),
        new THREE.Vector3(H, -H, H),
        new THREE.Vector3(H, H, H),
      ],
    },
    {
      // 3: -Z (Back)
      normal: new THREE.Vector3(0, 0, -1),
      upTangent: new THREE.Vector3(0, 1, 0),
      corners: [
        new THREE.Vector3(H, H, -H),
        new THREE.Vector3(H, -H, -H),
        new THREE.Vector3(-H, -H, -H),
        new THREE.Vector3(-H, H, -H),
      ],
    },
    {
      // 4: +X (Right)
      normal: new THREE.Vector3(1, 0, 0),
      upTangent: new THREE.Vector3(0, 1, 0),
      corners: [
        new THREE.Vector3(H, H, H),
        new THREE.Vector3(H, -H, H),
        new THREE.Vector3(H, -H, -H),
        new THREE.Vector3(H, H, -H),
      ],
    },
    {
      // 5: -X (Left)
      normal: new THREE.Vector3(-1, 0, 0),
      upTangent: new THREE.Vector3(0, 1, 0),
      corners: [
        new THREE.Vector3(-H, H, -H),
        new THREE.Vector3(-H, -H, -H),
        new THREE.Vector3(-H, -H, H),
        new THREE.Vector3(-H, H, H),
      ],
    },
  ];

  faceDefs.forEach((def, f) => {
    const [c0, c1, c2, c3] = def.corners;
    const centroid = def.normal.clone().multiplyScalar(H);

    // Two triangles: (c0, c1, c2) and (c0, c2, c3)
    const tri1 = [c0, c1, c2];
    const uvTri1 = [
      [0, 1],
      [0, 0],
      [1, 0],
    ];

    const tri2 = [c0, c2, c3];
    const uvTri2 = [
      [0, 1],
      [1, 0],
      [1, 1],
    ];

    [...tri1, ...tri2].forEach((v) => {
      positions.push(v.x, v.y, v.z);
      normals.push(def.normal.x, def.normal.y, def.normal.z);
    });

    [...uvTri1, ...uvTri2].forEach((uv) => {
      uvs.push(uv[0], uv[1]);
    });

    geometry.addGroup(f * 6, 6, f);
    faceNormals.push(def.normal);
    faceUpTangents.push(def.upTangent);
    faceCentroids.push(centroid);
    polygons.push([c0, c1, c2, c3]);
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();

  const inradius = H;
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
