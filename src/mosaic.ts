export type Mode = "positive" | "negative";
export type Output = "positive" | "negative" | "hstack" | "vstack";
export type ColorKey = "white" | "black" | "avg";

export interface MosaicOptions {
  words: string[];
  fontSize: number;
  fontFamily: string;
  density: number;
  jitter: number;
  sizeVariance: number;
  color: ColorKey;
  output: Output;
}

type Source = HTMLImageElement | HTMLCanvasElement;

const MAX_DIM = 1600;

export function renderMosaic(source: Source, target: HTMLCanvasElement, opts: MosaicOptions): void {
  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
  const W = Math.round(srcW * scale);
  const H = Math.round(srcH * scale);

  const pixels = readPixels(source, W, H);
  const resolved = resolveColor(opts.color, pixels);

  const layout = layoutFor(opts.output, W, H);
  target.width = layout.totalW;
  target.height = layout.totalH;

  const ctx = target.getContext("2d")!;
  for (const panel of layout.panels) {
    drawPanel(ctx, source, pixels, W, H, panel.x, panel.y, panel.mode, resolved, opts);
  }
}

interface Panel {
  x: number;
  y: number;
  mode: Mode;
}

function layoutFor(
  output: Output,
  W: number,
  H: number,
): { totalW: number; totalH: number; panels: Panel[] } {
  switch (output) {
    case "positive":
      return { totalW: W, totalH: H, panels: [{ x: 0, y: 0, mode: "positive" }] };
    case "negative":
      return { totalW: W, totalH: H, panels: [{ x: 0, y: 0, mode: "negative" }] };
    case "hstack":
      return {
        totalW: W * 2,
        totalH: H,
        panels: [
          { x: 0, y: 0, mode: "positive" },
          { x: W, y: 0, mode: "negative" },
        ],
      };
    case "vstack":
      return {
        totalW: W,
        totalH: H * 2,
        panels: [
          { x: 0, y: 0, mode: "positive" },
          { x: 0, y: H, mode: "negative" },
        ],
      };
  }
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  source: Source,
  pixels: Uint8ClampedArray,
  W: number,
  H: number,
  ox: number,
  oy: number,
  mode: Mode,
  color: string,
  opts: MosaicOptions,
): void {
  if (mode === "negative") {
    ctx.drawImage(source, ox, oy, W, H);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(ox, oy, W, H);
  }

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  const cell = opts.fontSize / opts.density;
  const cols = Math.ceil(W / cell);
  const rows = Math.ceil(H / cell);
  const rand = mulberry32(0xc0ffee);

  let wordIdx = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = (col + 0.5) * cell + (rand() - 0.5) * cell * opts.jitter * 2;
      const cy = (row + 0.5) * cell + (rand() - 0.5) * cell * opts.jitter * 2;
      const px = Math.max(0, Math.min(W - 1, Math.floor(cx)));
      const py = Math.max(0, Math.min(H - 1, Math.floor(cy)));

      const sizeMul = 1 + (rand() - 0.5) * 2 * opts.sizeVariance;
      const size = Math.max(6, opts.fontSize * sizeMul);

      ctx.font = `${size}px ${opts.fontFamily}`;

      if (mode === "positive") {
        const i = (py * W + px) * 4;
        ctx.fillStyle = `rgb(${pixels[i]},${pixels[i + 1]},${pixels[i + 2]})`;
      } else {
        ctx.fillStyle = color;
      }

      const word = opts.words[wordIdx % opts.words.length];
      wordIdx++;
      ctx.fillText(word, ox + cx, oy + cy);
    }
  }
}

function readPixels(source: Source, w: number, h: number): Uint8ClampedArray {
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

function resolveColor(key: ColorKey, pixels: Uint8ClampedArray): string {
  if (key === "white") return "#ffffff";
  if (key === "black") return "#000000";
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  const step = 4 * 16;
  for (let i = 0; i < pixels.length; i += step) {
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
    n++;
  }
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
