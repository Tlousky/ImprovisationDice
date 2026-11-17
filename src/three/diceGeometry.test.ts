import * as CANNON from 'cannon-es';
import { describe, expect, it } from 'vitest';
import {
  buildD7Geometry,
  buildD12Geometry,
  buildD20Geometry,
  computeSettleQuaternion,
  getTopFaceIndex,
} from './diceGeometry';

describe('Polyhedral Dice Geometry & Physics Hulls', () => {
  it('builds a D12 with 12 distinct pentagonal faces and accurate top-face detection', () => {
    const d12 = buildD12Geometry(0.86);

    expect(d12.faceNormals).toHaveLength(12);
    expect(d12.faceUpTangents).toHaveLength(12);
    expect(d12.geometry.groups).toHaveLength(12);
    expect(d12.convexShape.faces).toHaveLength(12);

    // Verify all 12 faces can be landed cleanly upright and detected back
    for (let f = 0; f < 12; f++) {
      const quat = computeSettleQuaternion(
        d12.faceNormals[f],
        d12.faceUpTangents[f]
      );
      const detected = getTopFaceIndex(d12.faceNormals, quat);
      expect(detected).toBe(f);

      const rotatedUp = d12.faceUpTangents[f].clone().applyQuaternion(quat);
      expect(rotatedUp.z).toBeLessThan(-0.99);
    }

    // Filtered selection: if face 3 is top, but allowed is [0, 2, 4], it should pick among allowed
    const quat3 = computeSettleQuaternion(
      d12.faceNormals[3],
      d12.faceUpTangents[3]
    );
    const filtered = getTopFaceIndex(d12.faceNormals, quat3, [0, 2, 4]);
    expect([0, 2, 4]).toContain(filtered);
  });

  it('builds a D20 with 20 distinct triangular faces and accurate top-face detection', () => {
    const d20 = buildD20Geometry(0.92);

    expect(d20.faceNormals).toHaveLength(20);
    expect(d20.faceUpTangents).toHaveLength(20);
    expect(d20.geometry.groups).toHaveLength(20);
    expect(d20.convexShape.faces).toHaveLength(20);

    for (let f = 0; f < 20; f++) {
      const quat = computeSettleQuaternion(
        d20.faceNormals[f],
        d20.faceUpTangents[f]
      );
      const detected = getTopFaceIndex(d20.faceNormals, quat);
      expect(detected).toBe(f);

      const rotatedUp = d20.faceUpTangents[f].clone().applyQuaternion(quat);
      expect(rotatedUp.z).toBeLessThan(-0.99);
    }
  });

  it('builds a D7 with 7 distinct faces (2 pentagons + 5 side rectangles) and accurate top-face detection', () => {
    const radius = 0.95;
    const d7 = buildD7Geometry(radius);

    expect(d7.faceNormals).toHaveLength(7);
    expect(d7.faceUpTangents).toHaveLength(7);
    expect(d7.geometry.groups).toHaveLength(7);
    expect(d7.convexShape.faces).toHaveLength(7);
    expect(d7.faceInradii).toHaveLength(7);

    // Verify calibrated Bereuter patent ratio: H_half = 0.753 * radius (H = 1.506 * radius)
    expect(d7.faceInradii![0]).toBeCloseTo(0.753 * radius, 4);
    expect(d7.faceInradii![1]).toBeCloseTo(0.753 * radius, 4);
    // Side inradius r_in = radius * cos(pi/5)
    expect(d7.faceInradii![2]).toBeCloseTo(radius * Math.cos(Math.PI / 5), 4);

    for (let f = 0; f < 7; f++) {
      const quat = computeSettleQuaternion(
        d7.faceNormals[f],
        d7.faceUpTangents[f]
      );
      const detected = getTopFaceIndex(d7.faceNormals, quat);
      expect(detected).toBe(f);

      const rotatedUp = d7.faceUpTangents[f].clone().applyQuaternion(quat);
      expect(rotatedUp.z).toBeLessThan(-0.99);
    }
  });

  it('steps cannon-es rigid bodies stably on a flat tray floor', () => {
    const d12 = buildD12Geometry(0.86);
    const d20 = buildD20Geometry(0.92);

    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -28, 0),
    });

    const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor);

    const body12 = new CANNON.Body({
      mass: 1.2,
      shape: d12.convexShape,
      position: new CANNON.Vec3(-1, 2.5, 0),
    });
    const body20 = new CANNON.Body({
      mass: 1.4,
      shape: d20.convexShape,
      position: new CANNON.Vec3(1, 2.5, 0),
    });
    world.addBody(body12);
    world.addBody(body20);

    for (let i = 0; i < 120; i++) {
      world.step(1 / 60);
    }

    expect(Number.isFinite(body12.position.y)).toBe(true);
    expect(Number.isFinite(body20.position.y)).toBe(true);
    expect(body12.position.y).toBeGreaterThan(0.4);
    expect(body20.position.y).toBeGreaterThan(0.4);
    expect(body12.position.y).toBeLessThan(2.0);
    expect(body20.position.y).toBeLessThan(2.0);
  });
});
