import * as THREE from 'three';
import type { DiceSkin, TrayTheme } from '../types/app';

interface DieFaceTextureOptions {
  label: string;
  shape: 'pentagon' | 'triangle' | 'rectangle';
  skin: DiceSkin;
  needsUnderline?: boolean;
}

const FACE_TEXTURE_CACHE = new Map<string, THREE.CanvasTexture>();
const VELVET_TEXTURE_CACHE = new Map<TrayTheme, THREE.CanvasTexture>();

function drawFaceLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  inkColor: string,
  accentColor: string,
  shape: 'pentagon' | 'triangle' | 'rectangle',
  needsUnderline?: boolean
): void {
  const cx = 256;
  const cy = shape === 'triangle' ? 260 : 256;

  ctx.save();
  ctx.fillStyle = inkColor;
  ctx.strokeStyle = accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const serifStack = '"Playfair Display", Georgia, "Times New Roman", serif';

  // Split superscript 7 (e.g. M⁷, m⁷, mM⁷) or accidental (♯, ♭) for refined typography
  const hasSuper7 = label.includes('⁷');
  const hasAccidental = label.includes('♯') || label.includes('♭');

  if (hasSuper7) {
    const base = label.replace('⁷', '');
    const baseSize =
      shape === 'triangle'
        ? base.length >= 2
          ? 92
          : 112
        : 120;
    const supSize = Math.round(baseSize * 0.56);

    ctx.font = `700 ${baseSize}px ${serifStack}`;
    const baseWidth = ctx.measureText(base).width;
    ctx.font = `700 ${supSize}px ${serifStack}`;
    const supWidth = ctx.measureText('7').width;

    const totalWidth = baseWidth + supWidth * 0.92;
    const startX = cx - totalWidth / 2;

    ctx.textAlign = 'left';
    ctx.font = `700 ${baseSize}px ${serifStack}`;
    ctx.fillText(base, startX, cy + 6);

    ctx.font = `700 ${supSize}px ${serifStack}`;
    ctx.fillText('7', startX + baseWidth * 0.95, cy - baseSize * 0.28);
  } else if (hasAccidental) {
    const letter = label[0];
    const accidental = label[1];
    const baseSize = shape === 'triangle' ? 106 : 138;
    const accSize = Math.round(baseSize * 0.68);

    ctx.font = `700 ${baseSize}px ${serifStack}`;
    const letterWidth = ctx.measureText(letter).width;
    ctx.font = `600 ${accSize}px ${serifStack}`;
    const accWidth = ctx.measureText(accidental).width;

    const totalWidth = letterWidth + accWidth * 0.85;
    const startX = cx - totalWidth / 2;

    ctx.textAlign = 'left';
    ctx.font = `700 ${baseSize}px ${serifStack}`;
    ctx.fillText(letter, startX, cy + 4);

    ctx.font = `600 ${accSize}px ${serifStack}`;
    ctx.fillText(accidental, startX + letterWidth * 0.94, cy - baseSize * 0.22);
  } else {
    let fontSize = shape === 'triangle' ? 112 : 148;
    if (label.length === 2) fontSize = shape === 'triangle' ? 92 : 124;
    if (label.length >= 3) fontSize = shape === 'triangle' ? 68 : 96;

    ctx.font = `700 ${fontSize}px ${serifStack}`;
    ctx.fillText(label, cx, cy + 4);
  }

  if (needsUnderline) {
    const lineHalfWidth = shape === 'triangle' ? 32 : 40;
    const lineY = shape === 'triangle' ? cy + 58 : cy + 78;
    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.moveTo(cx - lineHalfWidth, lineY);
    ctx.lineTo(cx + lineHalfWidth, lineY);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Creates a crisp 512x512 engraved serif face texture for a D12 or D20 face.
 */
export function getDieFaceTexture(
  options: DieFaceTextureOptions
): THREE.CanvasTexture {
  const key = `${options.skin}|${options.shape}|${options.label}|${Boolean(
    options.needsUnderline
  )}`;
  const cached = FACE_TEXTURE_CACHE.get(key);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const isIvory = options.skin === 'ivory';

  // Soft pearl-ivory or matte-obsidian resin base with subtle beveled depth
  const grad = ctx.createRadialGradient(256, 240, 24, 256, 256, 300);
  if (isIvory) {
    grad.addColorStop(0, '#fffdf9');
    grad.addColorStop(0.55, '#f6f1e6');
    grad.addColorStop(0.85, '#e8dfd0');
    grad.addColorStop(1, '#d8ccb8');
  } else {
    grad.addColorStop(0, '#2b2733');
    grad.addColorStop(0.6, '#1c1922');
    grad.addColorStop(1, '#110f16');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle recessed border sheen on the face center
  ctx.save();
  ctx.beginPath();
  if (options.shape === 'rectangle') {
    const c = ctx as CanvasRenderingContext2D & { roundRect?: (...args: any[]) => void };
    if (typeof c.roundRect === 'function') {
      c.roundRect(54, 54, size - 108, size - 108, 28);
    } else {
      c.rect(54, 54, size - 108, size - 108);
    }
  } else {
    ctx.arc(256, 256, options.shape === 'triangle' ? 98 : 132, 0, Math.PI * 2);
  }
  ctx.strokeStyle = isIvory
    ? 'rgba(182, 166, 136, 0.18)'
    : 'rgba(212, 175, 55, 0.14)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  const inkColor = isIvory ? '#18151c' : '#e9c765';
  const accentColor = isIvory ? '#2d2633' : '#d4af37';

  // Subtle engraved shadow beneath lettering
  ctx.save();
  ctx.shadowColor = isIvory
    ? 'rgba(255, 255, 255, 0.7)'
    : 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 2;
  drawFaceLabel(
    ctx,
    options.label,
    inkColor,
    accentColor,
    options.shape,
    options.needsUnderline
  );
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  FACE_TEXTURE_CACHE.set(key, texture);
  return texture;
}

/**
 * Generates a plush procedural velvet / studio felt texture for the dice tray floor.
 */
export function getTrayVelvetTexture(theme: TrayTheme): THREE.CanvasTexture {
  const cached = VELVET_TEXTURE_CACHE.get(theme);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const isPurple = theme === 'purple-velvet';
  const baseGrad = ctx.createRadialGradient(256, 256, 30, 256, 256, 360);
  if (isPurple) {
    baseGrad.addColorStop(0, '#4c148c');
    baseGrad.addColorStop(0.55, '#370b69');
    baseGrad.addColorStop(1, '#210543');
  } else {
    baseGrad.addColorStop(0, '#1e3a2f');
    baseGrad.addColorStop(0.55, '#152b22');
    baseGrad.addColorStop(1, '#0c1b15');
  }
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle velvet nap micro-fibers
  for (let i = 0; i < 4800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 2 + Math.random() * 5;
    const angle = Math.random() * Math.PI;
    ctx.strokeStyle =
      i % 2 === 0
        ? isPurple
          ? 'rgba(185, 130, 255, 0.045)'
          : 'rgba(140, 210, 175, 0.04)'
        : 'rgba(10, 4, 20, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // Subtle embossed brass-tinted boundary rule near tray border
  ctx.strokeStyle = isPurple
    ? 'rgba(212, 175, 55, 0.16)'
    : 'rgba(212, 175, 55, 0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, size - 44, size - 44);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  VELVET_TEXTURE_CACHE.set(theme, texture);
  return texture;
}
