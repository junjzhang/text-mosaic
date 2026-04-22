export interface MosaicOptions {
  words: string[];
  fontSize: number;
  fontFamily: string;
  density: number;
  jitter: number;
  sizeVariance: number;
  bgMode: "white" | "black" | "avg" | "transparent";
}

interface Pixel {
  r: number;
  g: number;
  b: number;
}

export function renderMosaic(
  source: HTMLImageElement | HTMLCanvasElement,
  target: HTMLCanvasElement,
  opts: MosaicOptions,
): void {
  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const W = Math.round(srcW * scale);
  const H = Math.round(srcH * scale);

  target.width = W;
  target.height = H;

  const pixels = readPixels(source, W, H);

  const ctx = target.getContext("2d")!;
  ctx.fillStyle = resolveBackground(opts.bgMode, pixels, W, H);
  if (opts.bgMode === "transparent") {
    ctx.clearRect(0, 0, W, H);
  } else {
    ctx.fillRect(0, 0, W, H);
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
      const color = samplePixel(pixels, W, px, py);

      const sizeMul = 1 + (rand() - 0.5) * 2 * opts.sizeVariance;
      const size = Math.max(6, opts.fontSize * sizeMul);

      ctx.font = `${size}px ${opts.fontFamily}`;
      ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;

      const word = opts.words[wordIdx % opts.words.length];
      wordIdx++;
      ctx.fillText(word, cx, cy);
    }
  }
}

function readPixels(
  source: HTMLImageElement | HTMLCanvasElement,
  w: number,
  h: number,
): Uint8ClampedArray {
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

function samplePixel(data: Uint8ClampedArray, w: number, x: number, y: number): Pixel {
  const i = (y * w + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

function resolveBackground(
  mode: MosaicOptions["bgMode"],
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
): string {
  if (mode === "white") return "#ffffff";
  if (mode === "black") return "#000000";
  if (mode === "transparent") return "rgba(0,0,0,0)";

  let r = 0,
    g = 0,
    b = 0;
  const step = 4 * 16;
  let n = 0;
  for (let i = 0; i < w * h * 4; i += step) {
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
