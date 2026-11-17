import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { D12_PITCH_FACES, D20_CHORD_FACES } from '../music/theory';
import type { AppMode, DiceSkin, TrayTheme } from '../types/app';
import {
  buildD12Geometry,
  buildD20Geometry,
  buildD8Geometry,
  buildD6Geometry,
  computeSettleQuaternion,
  getTopFaceIndex,
  type PolyhedralDieGeometryData,
} from './diceGeometry';
import { getDieFaceTexture, getTrayVelvetTexture } from './diceTextures';

export interface DiceStageHandle {
  rollChord: () => void;
  rollMelody: (count: number, allowedFaces?: number[]) => void;
  finishMelodyEarly: () => void;
}

interface DiceStageProps {
  mode: AppMode;
  skin: DiceSkin;
  trayTheme: TrayTheme;
  allowedMelodyFaces?: number[];
  melodyDieSides?: 6 | 8 | 12;
  activeMelodyScale?: string[];
  onChordLanded: (d12FaceIndex: number, d20FaceIndex: number) => void;
  onMelodyStepLanded: (
    stepIndex: number,
    d12FaceIndex: number,
    scaleIndex?: number
  ) => void;
  onMelodySequenceComplete: () => void;
  onDiceImpact?: (intensity: number) => void;
  onDieTapped?: (which: 'd12' | 'd20' | 'd8' | 'd6') => void;
  onRollingChange?: (rolling: boolean) => void;
}

const TRAY_HALF_W = 2.45;
const TRAY_HALF_D = 2.65;
const MELODY_D12_SCALE = 1.24;
const MELODY_D8_SCALE = 1.65;
const MELODY_D6_SCALE = 1.15;

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function buildD12Materials(skin: DiceSkin): THREE.MeshPhysicalMaterial[] {
  return D12_PITCH_FACES.map(
    (pitch) =>
      new THREE.MeshPhysicalMaterial({
        map: getDieFaceTexture({
          label: pitch.label,
          shape: 'pentagon',
          skin,
          needsUnderline: pitch.needsUnderline,
        }),
        roughness: skin === 'ivory' ? 0.24 : 0.36,
        metalness: skin === 'ivory' ? 0.02 : 0.12,
        clearcoat: skin === 'ivory' ? 0.65 : 0.35,
        clearcoatRoughness: 0.18,
      })
  );
}

function buildD20Materials(skin: DiceSkin): THREE.MeshPhysicalMaterial[] {
  return D20_CHORD_FACES.map(
    (chord) =>
      new THREE.MeshPhysicalMaterial({
        map: getDieFaceTexture({
          label: chord.faceLabel,
          shape: 'triangle',
          skin,
          needsUnderline: chord.needsUnderline,
        }),
        roughness: skin === 'ivory' ? 0.24 : 0.36,
        metalness: skin === 'ivory' ? 0.02 : 0.12,
        clearcoat: skin === 'ivory' ? 0.65 : 0.35,
        clearcoatRoughness: 0.18,
      })
  );
}

function buildD8Materials(
  scalePitches: string[],
  skin: DiceSkin
): THREE.MeshPhysicalMaterial[] {
  const defaultLabels = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const baseProps = {
    roughness: skin === 'ivory' ? 0.24 : 0.36,
    metalness: skin === 'ivory' ? 0.02 : 0.12,
    clearcoat: skin === 'ivory' ? 0.65 : 0.35,
    clearcoatRoughness: 0.18,
  };

  const materials: THREE.MeshPhysicalMaterial[] = [];
  for (let f = 0; f < 8; f++) {
    const label =
      f < 7
        ? scalePitches[f] ?? defaultLabels[f]
        : scalePitches[0] ?? defaultLabels[0];
    materials.push(
      new THREE.MeshPhysicalMaterial({
        ...baseProps,
        map: getDieFaceTexture({
          label,
          shape: 'triangle',
          skin,
          needsUnderline: label === '6' || label === '9' || label === 'C',
        }),
      })
    );
  }
  return materials;
}

function buildD6Materials(
  scalePitches: string[],
  skin: DiceSkin
): THREE.MeshPhysicalMaterial[] {
  const defaultLabels = ['1', '2', '3', '4', '5', '6'];
  const baseProps = {
    roughness: skin === 'ivory' ? 0.24 : 0.36,
    metalness: skin === 'ivory' ? 0.02 : 0.12,
    clearcoat: skin === 'ivory' ? 0.65 : 0.35,
    clearcoatRoughness: 0.18,
  };

  const materials: THREE.MeshPhysicalMaterial[] = [];
  for (let f = 0; f < 6; f++) {
    const label =
      f < 5
        ? scalePitches[f] ?? defaultLabels[f]
        : scalePitches[0] ?? defaultLabels[0];
    materials.push(
      new THREE.MeshPhysicalMaterial({
        ...baseProps,
        map: getDieFaceTexture({
          label,
          shape: 'rectangle',
          skin,
          needsUnderline: label === '6' || label === '9' || label === 'C',
        }),
      })
    );
  }
  return materials;
}

function isBodyCalm(body: CANNON.Body): boolean {
  return (
    body.velocity.lengthSquared() < 0.04 &&
    body.angularVelocity.lengthSquared() < 0.14 &&
    body.position.y < 1.35
  );
}

export const DiceStage = forwardRef<DiceStageHandle, DiceStageProps>(
  function DiceStage(
    {
      mode,
      skin,
      trayTheme,
      allowedMelodyFaces,
      melodyDieSides = 12,
      activeMelodyScale,
      onChordLanded,
      onMelodyStepLanded,
      onMelodySequenceComplete,
      onDiceImpact,
      onDieTapped,
      onRollingChange,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    const allowedMelodyFacesRef = useRef(allowedMelodyFaces);
    allowedMelodyFacesRef.current = allowedMelodyFaces;

    const melodyDieSidesRef = useRef(melodyDieSides);
    melodyDieSidesRef.current = melodyDieSides;

    const activeMelodyScaleRef = useRef(activeMelodyScale);
    activeMelodyScaleRef.current = activeMelodyScale;

    const callbacksRef = useRef({
      onChordLanded,
      onMelodyStepLanded,
      onMelodySequenceComplete,
      onDiceImpact,
      onDieTapped,
      onRollingChange,
    });
    callbacksRef.current = {
      onChordLanded,
      onMelodyStepLanded,
      onMelodySequenceComplete,
      onDiceImpact,
      onDieTapped,
      onRollingChange,
    };

    const modeRef = useRef(mode);
    modeRef.current = mode;

    const sceneRefs = useRef<{
      d12Mesh?: THREE.Mesh;
      d20Mesh?: THREE.Mesh;
      d8Mesh?: THREE.Mesh;
      d6Mesh?: THREE.Mesh;
      floorMesh?: THREE.Mesh;
      d12Body?: CANNON.Body;
      d20Body?: CANNON.Body;
      d8Body?: CANNON.Body;
      d6Body?: CANNON.Body;
      d12Data?: PolyhedralDieGeometryData;
      d20Data?: PolyhedralDieGeometryData;
      d8Data?: PolyhedralDieGeometryData;
      d6Data?: PolyhedralDieGeometryData;
      world?: CANNON.World;
      rollChord?: () => void;
      rollMelody?: (count: number, allowedFaces?: number[]) => void;
      finishMelodyEarly?: () => void;
    }>({});

    useImperativeHandle(ref, () => ({
      rollChord: () => sceneRefs.current.rollChord?.(),
      rollMelody: (count: number, allowedFaces?: number[]) =>
        sceneRefs.current.rollMelody?.(count, allowedFaces ?? allowedMelodyFacesRef.current),
      finishMelodyEarly: () => sceneRefs.current.finishMelodyEarly?.(),
    }));

    // Update dice face materials dynamically when skin or active scale changes
    useEffect(() => {
      const { d12Mesh, d20Mesh, d8Mesh, d6Mesh } = sceneRefs.current;
      if (d12Mesh) {
        const oldMats = d12Mesh.material as THREE.Material[];
        d12Mesh.material = buildD12Materials(skin);
        oldMats.forEach((m) => m.dispose());
      }
      if (d20Mesh) {
        const oldMats = d20Mesh.material as THREE.Material[];
        d20Mesh.material = buildD20Materials(skin);
        oldMats.forEach((m) => m.dispose());
      }
      if (d8Mesh) {
        const oldMats = d8Mesh.material as THREE.Material[];
        d8Mesh.material = buildD8Materials(
          activeMelodyScale ?? ['1', '2', '3', '4', '5', '6', '7'],
          skin
        );
        oldMats.forEach((m) => m.dispose());
      }
      if (d6Mesh) {
        const oldMats = d6Mesh.material as THREE.Material[];
        d6Mesh.material = buildD6Materials(
          activeMelodyScale ?? ['1', '2', '3', '4', '5'],
          skin
        );
        oldMats.forEach((m) => m.dispose());
      }
    }, [skin, activeMelodyScale]);

    // Update velvet floor texture dynamically when trayTheme changes
    useEffect(() => {
      const { floorMesh } = sceneRefs.current;
      if (floorMesh) {
        const mat = floorMesh.material as THREE.MeshStandardMaterial;
        mat.map = getTrayVelvetTexture(trayTheme);
        mat.needsUpdate = true;
      }
    }, [trayTheme]);

    // Sync dice visibility, body presence, and resting poses when switching modes or melody die side count
    useEffect(() => {
      const {
        d12Mesh,
        d20Mesh,
        d8Mesh,
        d6Mesh,
        d12Body,
        d20Body,
        d8Body,
        d6Body,
        d12Data,
        d20Data,
        d8Data,
        d6Data,
        world,
      } = sceneRefs.current;
      if (
        !d12Mesh ||
        !d20Mesh ||
        !d8Mesh ||
        !d6Mesh ||
        !d12Body ||
        !d20Body ||
        !d8Body ||
        !d6Body ||
        !d12Data ||
        !d20Data ||
        !d8Data ||
        !d6Data ||
        !world
      ) {
        return;
      }

      if (mode === 'melody') {
        d20Mesh.visible = false;
        if (world.bodies.includes(d20Body)) {
          world.removeBody(d20Body);
        }

        d12Mesh.visible = false;
        if (world.bodies.includes(d12Body)) {
          world.removeBody(d12Body);
        }
        d8Mesh.visible = false;
        if (world.bodies.includes(d8Body)) {
          world.removeBody(d8Body);
        }
        d6Mesh.visible = false;
        if (world.bodies.includes(d6Body)) {
          world.removeBody(d6Body);
        }

        if (melodyDieSides === 6) {
          d6Mesh.visible = true;
          if (!world.bodies.includes(d6Body)) {
            world.addBody(d6Body);
          }
          d6Mesh.scale.setScalar(MELODY_D6_SCALE);
          const initQ = computeSettleQuaternion(
            d6Data.faceNormals[0],
            d6Data.faceUpTangents[0]
          );
          const initRad = d6Data.inradius * MELODY_D6_SCALE;
          d6Body.quaternion.set(initQ.x, initQ.y, initQ.z, initQ.w);
          d6Mesh.quaternion.copy(initQ);
          d6Body.position.set(0, initRad, 0);
          d6Mesh.position.set(0, initRad, 0);
          d6Body.velocity.setZero();
          d6Body.angularVelocity.setZero();
        } else if (melodyDieSides === 8) {
          d8Mesh.visible = true;
          if (!world.bodies.includes(d8Body)) {
            world.addBody(d8Body);
          }
          d8Mesh.scale.setScalar(MELODY_D8_SCALE);
          const initQ = computeSettleQuaternion(
            d8Data.faceNormals[0],
            d8Data.faceUpTangents[0]
          );
          const initRad = d8Data.inradius * MELODY_D8_SCALE;
          d8Body.quaternion.set(initQ.x, initQ.y, initQ.z, initQ.w);
          d8Mesh.quaternion.copy(initQ);
          d8Body.position.set(0, initRad, 0);
          d8Mesh.position.set(0, initRad, 0);
          d8Body.velocity.setZero();
          d8Body.angularVelocity.setZero();
        } else {
          d12Mesh.visible = true;
          if (!world.bodies.includes(d12Body)) {
            world.addBody(d12Body);
          }
          d12Mesh.scale.setScalar(MELODY_D12_SCALE);
          d12Body.position.set(0, d12Data.inradius * MELODY_D12_SCALE, 0);
          d12Mesh.position.set(0, d12Data.inradius * MELODY_D12_SCALE, 0);
          d12Body.velocity.setZero();
          d12Body.angularVelocity.setZero();
        }
      } else {
        d8Mesh.visible = false;
        if (world.bodies.includes(d8Body)) {
          world.removeBody(d8Body);
        }
        d6Mesh.visible = false;
        if (world.bodies.includes(d6Body)) {
          world.removeBody(d6Body);
        }

        d20Mesh.visible = true;
        if (!world.bodies.includes(d20Body)) {
          world.addBody(d20Body);
        }
        d12Mesh.visible = true;
        if (!world.bodies.includes(d12Body)) {
          world.addBody(d12Body);
        }
        d12Mesh.scale.setScalar(1);
        d12Body.position.set(-1.12, d12Data.inradius, 0.12);
        d12Mesh.position.set(-1.12, d12Data.inradius, 0.12);
        d12Body.velocity.setZero();
        d12Body.angularVelocity.setZero();
        d20Body.position.set(1.12, d20Data.inradius, 0.12);
        d20Mesh.position.set(1.12, d20Data.inradius, 0.12);
        d20Body.velocity.setZero();
        d20Body.angularVelocity.setZero();
      }
    }, [mode, melodyDieSides]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const scene = new THREE.Scene();

      const width = Math.max(240, container.clientWidth);
      const height = Math.max(220, container.clientHeight);
      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);

      const updateCameraFraming = (w: number, h: number) => {
        const aspect = w / Math.max(1, h);
        camera.aspect = aspect;
        // Pull camera slightly further back on very narrow portrait widths so tray edges stay visible
        const zoomFactor = aspect < 0.85 ? 0.85 / aspect : 1;
        camera.position.set(0, 12.6 * zoomFactor, 3.1 * zoomFactor);
        camera.lookAt(0, 0.25, 0.12);
        camera.updateProjectionMatrix();
      };
      updateCameraFraming(width, height);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      // Studio lighting setup
      const hemiLight = new THREE.HemisphereLight(0xfff6e5, 0x26163a, 0.92);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfff5e0, 1.55);
      keyLight.position.set(3.8, 11.5, 4.6);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 25;
      keyLight.shadow.camera.left = -4.2;
      keyLight.shadow.camera.right = 4.2;
      keyLight.shadow.camera.top = 4.2;
      keyLight.shadow.camera.bottom = -4.2;
      keyLight.shadow.bias = -0.0008;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xd9bfff, 0.55);
      rimLight.position.set(-4.5, 6.0, -5.0);
      scene.add(rimLight);

      // Velvet tray floor
      const floorGeo = new THREE.PlaneGeometry(TRAY_HALF_W * 2, TRAY_HALF_D * 2);
      const floorMat = new THREE.MeshStandardMaterial({
        map: getTrayVelvetTexture(trayTheme),
        roughness: 0.94,
        metalness: 0.02,
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Dark walnut tray border walls + subtle brass corner caps
      const walnutMat = new THREE.MeshStandardMaterial({
        color: 0x3b2214,
        roughness: 0.44,
        metalness: 0.08,
      });
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.28,
        metalness: 0.82,
      });

      const railThickness = 0.28;
      const railHeight = 0.65;
      const trayGroup = new THREE.Group();

      const topRail = new THREE.Mesh(
        new THREE.BoxGeometry(TRAY_HALF_W * 2 + railThickness * 2, railHeight, railThickness),
        walnutMat
      );
      topRail.position.set(0, railHeight / 2 - 0.05, -TRAY_HALF_D - railThickness / 2);
      topRail.castShadow = true;
      topRail.receiveShadow = true;

      const bottomRail = topRail.clone();
      bottomRail.position.z = TRAY_HALF_D + railThickness / 2;

      const leftRail = new THREE.Mesh(
        new THREE.BoxGeometry(railThickness, railHeight, TRAY_HALF_D * 2),
        walnutMat
      );
      leftRail.position.set(-TRAY_HALF_W - railThickness / 2, railHeight / 2 - 0.05, 0);
      leftRail.castShadow = true;
      leftRail.receiveShadow = true;

      const rightRail = leftRail.clone();
      rightRail.position.x = TRAY_HALF_W + railThickness / 2;

      trayGroup.add(topRail, bottomRail, leftRail, rightRail);

      const cornerPositions: [number, number][] = [
        [-TRAY_HALF_W - railThickness / 2, -TRAY_HALF_D - railThickness / 2],
        [TRAY_HALF_W + railThickness / 2, -TRAY_HALF_D - railThickness / 2],
        [-TRAY_HALF_W - railThickness / 2, TRAY_HALF_D + railThickness / 2],
        [TRAY_HALF_W + railThickness / 2, TRAY_HALF_D + railThickness / 2],
      ];
      cornerPositions.forEach(([cx, cz]) => {
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(railThickness + 0.02, railHeight + 0.02, railThickness + 0.02),
          brassMat
        );
        cap.position.set(cx, railHeight / 2 - 0.05, cz);
        trayGroup.add(cap);
      });
      scene.add(trayGroup);

      // Build D12, D20, D8, and D6 meshes
      const d12Data = buildD12Geometry(0.86);
      const d20Data = buildD20Geometry(0.92);
      const d8Data = buildD8Geometry(0.95);
      const d6Data = buildD6Geometry(1.35);

      const d12Mesh = new THREE.Mesh(d12Data.geometry, buildD12Materials(skin));
      d12Mesh.castShadow = true;
      d12Mesh.receiveShadow = true;
      scene.add(d12Mesh);

      const d20Mesh = new THREE.Mesh(d20Data.geometry, buildD20Materials(skin));
      d20Mesh.castShadow = true;
      d20Mesh.receiveShadow = true;
      scene.add(d20Mesh);

      const d8Mesh = new THREE.Mesh(
        d8Data.geometry,
        buildD8Materials(
          activeMelodyScaleRef.current ?? ['1', '2', '3', '4', '5', '6', '7'],
          skin
        )
      );
      d8Mesh.castShadow = true;
      d8Mesh.receiveShadow = true;
      scene.add(d8Mesh);

      const d6Mesh = new THREE.Mesh(
        d6Data.geometry,
        buildD6Materials(
          activeMelodyScaleRef.current ?? ['1', '2', '3', '4', '5'],
          skin
        )
      );
      d6Mesh.castShadow = true;
      d6Mesh.receiveShadow = true;
      scene.add(d6Mesh);

      // Build cannon-es physics world
      const world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -30, 0),
        allowSleep: false,
      });

      const dicePhysMat = new CANNON.Material('dice');
      const trayPhysMat = new CANNON.Material('tray');

      world.addContactMaterial(
        new CANNON.ContactMaterial(trayPhysMat, dicePhysMat, {
          friction: 0.45,
          restitution: 0.38,
        })
      );
      world.addContactMaterial(
        new CANNON.ContactMaterial(dicePhysMat, dicePhysMat, {
          friction: 0.3,
          restitution: 0.52,
        })
      );

      const floorBody = new CANNON.Body({
        mass: 0,
        material: trayPhysMat,
        shape: new CANNON.Plane(),
      });
      floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
      world.addBody(floorBody);

      const ceilingBody = new CANNON.Body({
        mass: 0,
        material: trayPhysMat,
        shape: new CANNON.Plane(),
        position: new CANNON.Vec3(0, 4.4, 0),
      });
      ceilingBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
      world.addBody(ceilingBody);

      const addWall = (
        x: number,
        y: number,
        z: number,
        hx: number,
        hy: number,
        hz: number
      ) => {
        const wall = new CANNON.Body({
          mass: 0,
          material: trayPhysMat,
          shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)),
          position: new CANNON.Vec3(x, y, z),
        });
        world.addBody(wall);
      };

      const wallH = 3.2;
      addWall(0, wallH / 2, -TRAY_HALF_D - 0.5, TRAY_HALF_W + 1, wallH / 2, 0.5);
      addWall(0, wallH / 2, TRAY_HALF_D + 0.5, TRAY_HALF_W + 1, wallH / 2, 0.5);
      addWall(-TRAY_HALF_W - 0.5, wallH / 2, 0, 0.5, wallH / 2, TRAY_HALF_D + 1);
      addWall(TRAY_HALF_W + 0.5, wallH / 2, 0, 0.5, wallH / 2, TRAY_HALF_D + 1);

      const d12Body = new CANNON.Body({
        mass: 1.2,
        material: dicePhysMat,
        shape: d12Data.convexShape,
        linearDamping: 0.28,
        angularDamping: 0.32,
      });
      const d20Body = new CANNON.Body({
        mass: 1.35,
        material: dicePhysMat,
        shape: d20Data.convexShape,
        linearDamping: 0.28,
        angularDamping: 0.32,
      });
      const d8Body = new CANNON.Body({
        mass: 1.2,
        material: dicePhysMat,
        shape: d8Data.convexShape,
        linearDamping: 0.28,
        angularDamping: 0.32,
      });
      const d6Body = new CANNON.Body({
        mass: 1.2,
        material: dicePhysMat,
        shape: d6Data.convexShape,
        linearDamping: 0.28,
        angularDamping: 0.32,
      });

      const handleCollide = (event: { contact: CANNON.ContactEquation }) => {
        const impactVel = Math.abs(event.contact.getImpactVelocityAlongNormal());
        if (impactVel > 1.2) {
          callbacksRef.current.onDiceImpact?.(Math.min(1, impactVel / 10));
        }
      };
      d12Body.addEventListener('collide', handleCollide);
      d20Body.addEventListener('collide', handleCollide);
      d8Body.addEventListener('collide', handleCollide);
      d6Body.addEventListener('collide', handleCollide);

      // Initial resting poses (E♭ on D12, M⁷ on D20, Tonic on D8/D6)
      d12Body.position.set(-1.12, d12Data.inradius, 0.12);
      const initQ12 = computeSettleQuaternion(
        d12Data.faceNormals[3],
        d12Data.faceUpTangents[3]
      );
      d12Body.quaternion.set(initQ12.x, initQ12.y, initQ12.z, initQ12.w);
      d12Mesh.position.set(-1.12, d12Data.inradius, 0.12);
      d12Mesh.quaternion.copy(initQ12);

      d20Body.position.set(1.12, d20Data.inradius, 0.12);
      const initQ20 = computeSettleQuaternion(
        d20Data.faceNormals[6],
        d20Data.faceUpTangents[6]
      );
      d20Body.quaternion.set(initQ20.x, initQ20.y, initQ20.z, initQ20.w);
      d20Mesh.position.set(1.12, d20Data.inradius, 0.12);
      d20Mesh.quaternion.copy(initQ20);

      const initQ8 = computeSettleQuaternion(
        d8Data.faceNormals[0],
        d8Data.faceUpTangents[0]
      );
      const initRad8 = d8Data.inradius * MELODY_D8_SCALE;
      d8Body.quaternion.set(initQ8.x, initQ8.y, initQ8.z, initQ8.w);
      d8Mesh.quaternion.copy(initQ8);
      d8Body.position.set(0, initRad8, 0);
      d8Mesh.position.set(0, initRad8, 0);

      const initQ6 = computeSettleQuaternion(
        d6Data.faceNormals[0],
        d6Data.faceUpTangents[0]
      );
      const initRad6 = d6Data.inradius * MELODY_D6_SCALE;
      d6Body.quaternion.set(initQ6.x, initQ6.y, initQ6.z, initQ6.w);
      d6Mesh.quaternion.copy(initQ6);
      d6Body.position.set(0, initRad6, 0);
      d6Mesh.position.set(0, initRad6, 0);

      if (modeRef.current === 'chord') {
        d8Mesh.visible = false;
        d6Mesh.visible = false;
        world.addBody(d12Body);
        world.addBody(d20Body);
      } else {
        d20Mesh.visible = false;
        if (melodyDieSidesRef.current === 6) {
          d12Mesh.visible = false;
          d8Mesh.visible = false;
          d6Mesh.visible = true;
          world.addBody(d6Body);
        } else if (melodyDieSidesRef.current === 8) {
          d12Mesh.visible = false;
          d6Mesh.visible = false;
          d8Mesh.visible = true;
          world.addBody(d8Body);
        } else {
          d8Mesh.visible = false;
          d6Mesh.visible = false;
          d12Mesh.visible = true;
          d12Mesh.scale.setScalar(MELODY_D12_SCALE);
          d12Body.position.set(0, d12Data.inradius * MELODY_D12_SCALE, 0);
          d12Mesh.position.set(0, d12Data.inradius * MELODY_D12_SCALE, 0);
          world.addBody(d12Body);
        }
      }

      // Animation & roll state machine
      type RollState =
        | { kind: 'idle' }
        | {
            kind: 'chord-physics';
            elapsed: number;
            calmFrames: number;
          }
        | {
            kind: 'chord-settle';
            elapsed: number;
            duration: number;
            startPos12: THREE.Vector3;
            endPos12: THREE.Vector3;
            startQ12: THREE.Quaternion;
            endQ12: THREE.Quaternion;
            face12: number;
            startPos20: THREE.Vector3;
            endPos20: THREE.Vector3;
            startQ20: THREE.Quaternion;
            endQ20: THREE.Quaternion;
            face20: number;
          }
        | {
            kind: 'melody-physics';
            dieType: 'd12' | 'd8' | 'd6';
            elapsed: number;
            calmFrames: number;
            stepIndex: number;
            totalSteps: number;
            allowedFaces?: number[];
          }
        | {
            kind: 'melody-settle';
            dieType: 'd12' | 'd8' | 'd6';
            elapsed: number;
            duration: number;
            startPos: THREE.Vector3;
            endPos: THREE.Vector3;
            startQ: THREE.Quaternion;
            endQ: THREE.Quaternion;
            face: number;
            stepIndex: number;
            totalSteps: number;
            allowedFaces?: number[];
            pauseAfter: number;
          };

      let rollState: RollState = { kind: 'idle' };
      let finishMelodyRequested = false;

      const launchBody = (
        body: CANNON.Body,
        x: number,
        y: number,
        z: number,
        vx: number,
        vy: number,
        vz: number
      ) => {
        body.position.set(x, y, z);
        body.velocity.set(vx, vy, vz);
        body.angularVelocity.set(
          randomRange(-22, 22),
          randomRange(-18, 18),
          randomRange(-22, 22)
        );
        body.quaternion.setFromEuler(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );
      };

      const startSingleMelodyThrow = (
        stepIndex: number,
        totalSteps: number,
        dieType: 'd12' | 'd8' | 'd6',
        allowedFaces?: number[]
      ) => {
        d12Mesh.visible = false;
        d8Mesh.visible = false;
        d6Mesh.visible = false;

        let activeBody: CANNON.Body;
        if (dieType === 'd8') {
          d8Mesh.visible = true;
          d8Mesh.scale.setScalar(MELODY_D8_SCALE);
          activeBody = d8Body;
        } else if (dieType === 'd6') {
          d6Mesh.visible = true;
          d6Mesh.scale.setScalar(MELODY_D6_SCALE);
          activeBody = d6Body;
        } else {
          d12Mesh.visible = true;
          d12Mesh.scale.setScalar(MELODY_D12_SCALE);
          activeBody = d12Body;
        }

        launchBody(
          activeBody,
          randomRange(-1.1, 1.1),
          randomRange(2.4, 2.9),
          randomRange(-1.1, 1.1),
          randomRange(-2.8, 2.8),
          randomRange(-1.2, 0.8),
          randomRange(-2.8, 2.8)
        );

        rollState = {
          kind: 'melody-physics',
          dieType,
          elapsed: 0,
          calmFrames: 0,
          stepIndex,
          totalSteps,
          allowedFaces,
        };
      };

      const triggerChordRoll = () => {
        if (rollState.kind !== 'idle') return;
        d8Mesh.visible = false;
        if (world.bodies.includes(d8Body)) world.removeBody(d8Body);
        d6Mesh.visible = false;
        if (world.bodies.includes(d6Body)) world.removeBody(d6Body);

        d20Mesh.visible = true;
        if (!world.bodies.includes(d20Body)) world.addBody(d20Body);
        d12Mesh.visible = true;
        if (!world.bodies.includes(d12Body)) world.addBody(d12Body);
        d12Mesh.scale.setScalar(1);

        launchBody(
          d12Body,
          randomRange(-1.55, -0.75),
          randomRange(2.4, 3.0),
          randomRange(-1.2, 1.2),
          randomRange(1.4, 3.5),
          randomRange(-1.0, 1.0),
          randomRange(-2.2, 2.2)
        );
        launchBody(
          d20Body,
          randomRange(0.75, 1.55),
          randomRange(2.5, 3.1),
          randomRange(-1.2, 1.2),
          randomRange(-3.5, -1.4),
          randomRange(-1.0, 1.0),
          randomRange(-2.2, 2.2)
        );

        callbacksRef.current.onRollingChange?.(true);
        rollState = { kind: 'chord-physics', elapsed: 0, calmFrames: 0 };
      };

      const triggerMelodyRoll = (count: number, allowedFaces?: number[]) => {
        if (rollState.kind !== 'idle') return;
        const clampedCount = Math.max(3, Math.min(9, Math.round(count)));
        finishMelodyRequested = false;
        d20Mesh.visible = false;
        if (world.bodies.includes(d20Body)) world.removeBody(d20Body);

        if (world.bodies.includes(d12Body)) world.removeBody(d12Body);
        if (world.bodies.includes(d8Body)) world.removeBody(d8Body);
        if (world.bodies.includes(d6Body)) world.removeBody(d6Body);

        const dieType =
          melodyDieSidesRef.current === 6
            ? 'd6'
            : melodyDieSidesRef.current === 8
              ? 'd8'
              : 'd12';

        if (dieType === 'd8') {
          world.addBody(d8Body);
        } else if (dieType === 'd6') {
          world.addBody(d6Body);
        } else {
          world.addBody(d12Body);
        }

        callbacksRef.current.onRollingChange?.(true);
        const facesToUse = allowedFaces ?? allowedMelodyFacesRef.current;
        startSingleMelodyThrow(0, clampedCount, dieType, facesToUse);
      };

      const finishMelodyEarly = () => {
        if (
          rollState.kind === 'melody-physics' ||
          rollState.kind === 'melody-settle'
        ) {
          finishMelodyRequested = true;
        }
      };

      sceneRefs.current = {
        d12Mesh,
        d20Mesh,
        d8Mesh,
        d6Mesh,
        floorMesh,
        d12Body,
        d20Body,
        d8Body,
        d6Body,
        d12Data,
        d20Data,
        d8Data,
        d6Data,
        world,
        rollChord: triggerChordRoll,
        rollMelody: triggerMelodyRoll,
        finishMelodyEarly,
      };

      // Tap / click detection on dice in the tray
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const onPointerUp = (ev: PointerEvent) => {
        if (rollState.kind !== 'idle') return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const targets: THREE.Mesh[] = [];
        if (modeRef.current === 'chord') {
          if (d12Mesh.visible) targets.push(d12Mesh);
          if (d20Mesh.visible) targets.push(d20Mesh);
        } else {
          if (d8Mesh.visible) targets.push(d8Mesh);
          if (d6Mesh.visible) targets.push(d6Mesh);
          if (d12Mesh.visible) targets.push(d12Mesh);
        }
        const hits = raycaster.intersectObjects(targets, false);
        if (hits.length > 0) {
          const hitObj = hits[0].object;
          if (hitObj === d8Mesh) {
            callbacksRef.current.onDieTapped?.('d8');
            launchBody(
              d8Body,
              d8Body.position.x,
              1.2,
              d8Body.position.z,
              randomRange(-1.5, 1.5),
              3.5,
              randomRange(-1.5, 1.5)
            );
          } else if (hitObj === d6Mesh) {
            callbacksRef.current.onDieTapped?.('d6');
            launchBody(
              d6Body,
              d6Body.position.x,
              1.2,
              d6Body.position.z,
              randomRange(-1.5, 1.5),
              3.5,
              randomRange(-1.5, 1.5)
            );
          } else if (hitObj === d12Mesh) {
            callbacksRef.current.onDieTapped?.('d12');
            launchBody(
              d12Body,
              d12Body.position.x,
              1.2,
              d12Body.position.z,
              randomRange(-1.5, 1.5),
              3.5,
              randomRange(-1.5, 1.5)
            );
          } else {
            callbacksRef.current.onDieTapped?.('d20');
            launchBody(
              d20Body,
              d20Body.position.x,
              1.2,
              d20Body.position.z,
              randomRange(-1.5, 1.5),
              3.5,
              randomRange(-1.5, 1.5)
            );
          }
        }
      };
      renderer.domElement.addEventListener('pointerup', onPointerUp);

      // Resize observer for mobile viewport changes
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.max(240, entry.contentRect.width);
          const h = Math.max(220, entry.contentRect.height);
          updateCameraFraming(w, h);
          renderer.setSize(w, h);
        }
      });
      resizeObserver.observe(container);

      // Render loop
      let rafId = 0;
      let lastTime = performance.now();

      const animate = (now: number) => {
        rafId = window.requestAnimationFrame(animate);
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        if (rollState.kind === 'chord-physics') {
          world.step(1 / 60, dt, 4);
          rollState.elapsed += dt;

          d12Mesh.position.set(
            d12Body.position.x,
            d12Body.position.y,
            d12Body.position.z
          );
          d12Mesh.quaternion.set(
            d12Body.quaternion.x,
            d12Body.quaternion.y,
            d12Body.quaternion.z,
            d12Body.quaternion.w
          );
          d20Mesh.position.set(
            d20Body.position.x,
            d20Body.position.y,
            d20Body.position.z
          );
          d20Mesh.quaternion.set(
            d20Body.quaternion.x,
            d20Body.quaternion.y,
            d20Body.quaternion.z,
            d20Body.quaternion.w
          );

          if (isBodyCalm(d12Body) && isBodyCalm(d20Body)) {
            rollState.calmFrames += 1;
          } else {
            rollState.calmFrames = 0;
          }

          if (rollState.calmFrames >= 10 || rollState.elapsed >= 2.15) {
            const face12 = getTopFaceIndex(
              d12Data.faceNormals,
              d12Mesh.quaternion
            );
            const face20 = getTopFaceIndex(
              d20Data.faceNormals,
              d20Mesh.quaternion
            );

            // Clamp resting positions within tray and keep slight separation
            const end12 = new THREE.Vector3(
              THREE.MathUtils.clamp(d12Mesh.position.x, -1.55, 1.55),
              d12Data.inradius,
              THREE.MathUtils.clamp(d12Mesh.position.z, -1.55, 1.55)
            );
            const end20 = new THREE.Vector3(
              THREE.MathUtils.clamp(d20Mesh.position.x, -1.55, 1.55),
              d20Data.inradius,
              THREE.MathUtils.clamp(d20Mesh.position.z, -1.55, 1.55)
            );
            const sep = end20.clone().sub(end12);
            sep.y = 0;
            if (sep.length() < 1.95) {
              if (sep.lengthSq() < 1e-4) sep.set(1, 0, 0);
              sep.normalize().multiplyScalar((1.95 - sep.length()) * 0.55);
              end12.sub(sep);
              end20.add(sep);
            }

            rollState = {
              kind: 'chord-settle',
              elapsed: 0,
              duration: 0.24,
              startPos12: d12Mesh.position.clone(),
              endPos12: end12,
              startQ12: d12Mesh.quaternion.clone(),
              endQ12: computeSettleQuaternion(
                d12Data.faceNormals[face12],
                d12Data.faceUpTangents[face12]
              ),
              face12,
              startPos20: d20Mesh.position.clone(),
              endPos20: end20,
              startQ20: d20Mesh.quaternion.clone(),
              endQ20: computeSettleQuaternion(
                d20Data.faceNormals[face20],
                d20Data.faceUpTangents[face20]
              ),
              face20,
            };
          }
        } else if (rollState.kind === 'chord-settle') {
          rollState.elapsed += dt;
          const t = Math.min(1, rollState.elapsed / rollState.duration);
          const eased = 1 - Math.pow(1 - t, 3);

          d12Mesh.position.lerpVectors(rollState.startPos12, rollState.endPos12, eased);
          d12Mesh.quaternion.slerpQuaternions(rollState.startQ12, rollState.endQ12, eased);

          d20Mesh.position.lerpVectors(rollState.startPos20, rollState.endPos20, eased);
          d20Mesh.quaternion.slerpQuaternions(rollState.startQ20, rollState.endQ20, eased);

          if (t >= 1) {
            d12Body.position.set(
              d12Mesh.position.x,
              d12Mesh.position.y,
              d12Mesh.position.z
            );
            d12Body.quaternion.set(
              d12Mesh.quaternion.x,
              d12Mesh.quaternion.y,
              d12Mesh.quaternion.z,
              d12Mesh.quaternion.w
            );
            d12Body.velocity.setZero();
            d12Body.angularVelocity.setZero();

            d20Body.position.set(
              d20Mesh.position.x,
              d20Mesh.position.y,
              d20Mesh.position.z
            );
            d20Body.quaternion.set(
              d20Mesh.quaternion.x,
              d20Mesh.quaternion.y,
              d20Mesh.quaternion.z,
              d20Mesh.quaternion.w
            );
            d20Body.velocity.setZero();
            d20Body.angularVelocity.setZero();

            const { face12, face20 } = rollState;
            rollState = { kind: 'idle' };
            callbacksRef.current.onRollingChange?.(false);
            callbacksRef.current.onChordLanded(face12, face20);
          }
        } else if (rollState.kind === 'melody-physics') {
          world.step(1 / 60, dt * 1.35, 4);
          rollState.elapsed += dt;

          const isD8 = rollState.dieType === 'd8';
          const isD6 = rollState.dieType === 'd6';
          const activeMesh = isD8 ? d8Mesh : isD6 ? d6Mesh : d12Mesh;
          const activeBody = isD8 ? d8Body : isD6 ? d6Body : d12Body;
          const activeData = isD8 ? d8Data : isD6 ? d6Data : d12Data;
          const activeScale = isD8
            ? MELODY_D8_SCALE
            : isD6
              ? MELODY_D6_SCALE
              : MELODY_D12_SCALE;

          activeMesh.position.set(
            activeBody.position.x,
            Math.max(activeData.inradius * activeScale, activeBody.position.y),
            activeBody.position.z
          );
          activeMesh.quaternion.set(
            activeBody.quaternion.x,
            activeBody.quaternion.y,
            activeBody.quaternion.z,
            activeBody.quaternion.w
          );

          if (isBodyCalm(activeBody)) {
            rollState.calmFrames += 1;
          } else {
            rollState.calmFrames = 0;
          }

          if (
            finishMelodyRequested ||
            rollState.calmFrames >= 6 ||
            rollState.elapsed >= 0.92
          ) {
            if (finishMelodyRequested) {
              const { stepIndex, totalSteps, dieType } = rollState;
              const isChromatic = dieType === 'd12';
              const activeData =
                dieType === 'd8' ? d8Data : dieType === 'd6' ? d6Data : d12Data;
              const activeMesh =
                dieType === 'd8' ? d8Mesh : dieType === 'd6' ? d6Mesh : d12Mesh;
              const activeBody =
                dieType === 'd8' ? d8Body : dieType === 'd6' ? d6Body : d12Body;
              const activeScale =
                dieType === 'd8'
                  ? MELODY_D8_SCALE
                  : dieType === 'd6'
                    ? MELODY_D6_SCALE
                    : MELODY_D12_SCALE;
              const numFaces = dieType === 'd8' ? 8 : dieType === 'd6' ? 6 : 12;
              const allowed =
                isChromatic && rollState.allowedFaces?.length
                  ? rollState.allowedFaces
                  : undefined;

              let lastFace = getTopFaceIndex(
                activeData.faceNormals,
                activeMesh.quaternion,
                allowed
              );
              callbacksRef.current.onMelodyStepLanded(
                stepIndex,
                isChromatic ? lastFace : -1,
                isChromatic ? undefined : lastFace
              );
              for (let s = stepIndex + 1; s < totalSteps; s++) {
                if (allowed && allowed.length > 0) {
                  lastFace = allowed[Math.floor(Math.random() * allowed.length)];
                } else {
                  lastFace = Math.floor(Math.random() * numFaces);
                }
                callbacksRef.current.onMelodyStepLanded(
                  s,
                  isChromatic ? lastFace : -1,
                  isChromatic ? undefined : lastFace
                );
              }
              const finalQ = computeSettleQuaternion(
                activeData.faceNormals[lastFace],
                activeData.faceUpTangents[lastFace]
              );
              const settleH = activeData.inradius * activeScale;
              activeMesh.position.set(0, settleH, 0);
              activeMesh.quaternion.copy(finalQ);
              activeBody.position.set(0, settleH, 0);
              activeBody.velocity.setZero();
              activeBody.angularVelocity.setZero();

              rollState = { kind: 'idle' };
              callbacksRef.current.onRollingChange?.(false);
              callbacksRef.current.onMelodySequenceComplete();
            } else {
              const isChromatic = rollState.dieType === 'd12';
              const allowed =
                isChromatic && rollState.allowedFaces?.length
                  ? rollState.allowedFaces
                  : undefined;
              const face = getTopFaceIndex(
                activeData.faceNormals,
                activeMesh.quaternion,
                allowed
              );
              const endPos = new THREE.Vector3(
                THREE.MathUtils.clamp(activeMesh.position.x, -1.1, 1.1),
                activeData.inradius * activeScale,
                THREE.MathUtils.clamp(activeMesh.position.z, -1.1, 1.1)
              );

              rollState = {
                kind: 'melody-settle',
                dieType: rollState.dieType,
                elapsed: 0,
                duration: 0.16,
                startPos: activeMesh.position.clone(),
                endPos,
                startQ: activeMesh.quaternion.clone(),
                endQ: computeSettleQuaternion(
                  activeData.faceNormals[face],
                  activeData.faceUpTangents[face]
                ),
                face,
                stepIndex: rollState.stepIndex,
                totalSteps: rollState.totalSteps,
                allowedFaces: rollState.allowedFaces,
                pauseAfter: 0,
              };
            }
          }
        } else if (rollState.kind === 'melody-settle') {
          const isD8 = rollState.dieType === 'd8';
          const isD6 = rollState.dieType === 'd6';
          const activeMesh = isD8 ? d8Mesh : isD6 ? d6Mesh : d12Mesh;

          if (rollState.pauseAfter === 0) {
            rollState.elapsed += dt;
            const t = Math.min(1, rollState.elapsed / rollState.duration);
            const eased = 1 - Math.pow(1 - t, 3);

            activeMesh.position.lerpVectors(rollState.startPos, rollState.endPos, eased);
            activeMesh.quaternion.slerpQuaternions(rollState.startQ, rollState.endQ, eased);

            if (t >= 1) {
              const isChromatic = rollState.dieType === 'd12';
              callbacksRef.current.onMelodyStepLanded(
                rollState.stepIndex,
                isChromatic ? rollState.face : -1,
                isChromatic ? undefined : rollState.face
              );
              if (rollState.stepIndex + 1 >= rollState.totalSteps) {
                rollState = { kind: 'idle' };
                callbacksRef.current.onRollingChange?.(false);
                callbacksRef.current.onMelodySequenceComplete();
              } else {
                rollState.pauseAfter = 0.001;
              }
            }
          } else {
            rollState.pauseAfter += dt;
            if (finishMelodyRequested || rollState.pauseAfter >= 0.2) {
              if (finishMelodyRequested) {
                const { stepIndex, totalSteps, dieType } = rollState;
                const isChromatic = dieType === 'd12';
                const activeData =
                  dieType === 'd8' ? d8Data : dieType === 'd6' ? d6Data : d12Data;
                const activeMesh =
                  dieType === 'd8' ? d8Mesh : dieType === 'd6' ? d6Mesh : d12Mesh;
                const activeScale =
                  dieType === 'd8'
                    ? MELODY_D8_SCALE
                    : dieType === 'd6'
                      ? MELODY_D6_SCALE
                      : MELODY_D12_SCALE;
                const numFaces = dieType === 'd8' ? 8 : dieType === 'd6' ? 6 : 12;
                const allowed =
                  isChromatic && rollState.allowedFaces?.length
                    ? rollState.allowedFaces
                    : undefined;

                let lastFace = rollState.face;
                for (let s = stepIndex + 1; s < totalSteps; s++) {
                  if (allowed && allowed.length > 0) {
                    lastFace = allowed[Math.floor(Math.random() * allowed.length)];
                  } else {
                    lastFace = Math.floor(Math.random() * numFaces);
                  }
                  callbacksRef.current.onMelodyStepLanded(
                    s,
                    isChromatic ? lastFace : -1,
                    isChromatic ? undefined : lastFace
                  );
                }
                const finalQ = computeSettleQuaternion(
                  activeData.faceNormals[lastFace],
                  activeData.faceUpTangents[lastFace]
                );
                activeMesh.position.set(0, activeData.inradius * activeScale, 0);
                activeMesh.quaternion.copy(finalQ);

                rollState = { kind: 'idle' };
                callbacksRef.current.onRollingChange?.(false);
                callbacksRef.current.onMelodySequenceComplete();
              } else {
                startSingleMelodyThrow(
                  rollState.stepIndex + 1,
                  rollState.totalSteps,
                  rollState.dieType,
                  rollState.allowedFaces
                );
              }
            }
          }
        }

        renderer.render(scene, camera);
      };

      rafId = window.requestAnimationFrame(animate);

      return () => {
        window.cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        d12Body.removeEventListener('collide', handleCollide);
        d20Body.removeEventListener('collide', handleCollide);
        d8Body.removeEventListener('collide', handleCollide);
        d6Body.removeEventListener('collide', handleCollide);

        d12Data.geometry.dispose();
        d20Data.geometry.dispose();
        d8Data.geometry.dispose();
        d6Data.geometry.dispose();
        floorGeo.dispose();
        floorMat.dispose();
        walnutMat.dispose();
        brassMat.dispose();
        (d12Mesh.material as THREE.Material[]).forEach((m) => m.dispose());
        (d20Mesh.material as THREE.Material[]).forEach((m) => m.dispose());
        (d8Mesh.material as THREE.Material[]).forEach((m) => m.dispose());
        (d6Mesh.material as THREE.Material[]).forEach((m) => m.dispose());
        renderer.dispose();
      };
    }, []);

    return (
      <div
        ref={containerRef}
        className="dice-stage-canvas"
        aria-label="3D Dice Rolling Tray"
      />
    );
  }
);
