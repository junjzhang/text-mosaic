import "./style.css";
import { renderMosaic, type MosaicOptions, type Output } from "./mosaic";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const fileInput = $<HTMLInputElement>("file");
const wordsInput = $<HTMLInputElement>("words");
const sizeInput = $<HTMLInputElement>("size");
const densityInput = $<HTMLInputElement>("density");
const jitterInput = $<HTMLInputElement>("jitter");
const sizeVarInput = $<HTMLInputElement>("sizeVar");
const fontSelect = $<HTMLSelectElement>("font");
const colorSelect = $<HTMLSelectElement>("color");
const colorLabel = $<HTMLSpanElement>("colorLabel");
const outputGroup = $<HTMLDivElement>("output");
const renderBtn = $<HTMLButtonElement>("render");
const downloadBtn = $<HTMLButtonElement>("download");
const canvas = $<HTMLCanvasElement>("canvas");
const placeholder = $<HTMLDivElement>("placeholder");
const stage = document.querySelector<HTMLElement>(".stage")!;
const controls = $<HTMLElement>("controls");
const toggleBtn = $<HTMLButtonElement>("toggle");

let currentImage: HTMLImageElement | null = null;
let currentOutput: Output = "positive";

const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

function setCollapsed(collapsed: boolean) {
  controls.classList.toggle("collapsed", collapsed);
  toggleBtn.textContent = collapsed ? "展开" : "收起";
  toggleBtn.setAttribute("aria-expanded", String(!collapsed));
}

toggleBtn.addEventListener("click", () => {
  setCollapsed(!controls.classList.contains("collapsed"));
});

const sliders: [HTMLInputElement, HTMLOutputElement][] = [
  [sizeInput, $<HTMLOutputElement>("sizeOut")],
  [densityInput, $<HTMLOutputElement>("densityOut")],
  [jitterInput, $<HTMLOutputElement>("jitterOut")],
  [sizeVarInput, $<HTMLOutputElement>("sizeVarOut")],
];
for (const [input, out] of sliders) {
  const sync = () => (out.value = input.value);
  sync();
  input.addEventListener("input", sync);
}

const colorLabels: Record<Output, string> = {
  positive: "背景色",
  negative: "文字色",
  hstack: "辅助色",
  vstack: "辅助色",
};

function updateColorLabel() {
  colorLabel.textContent = colorLabels[currentOutput];
}

outputGroup.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-value]");
  if (!btn) return;
  currentOutput = btn.dataset.value as Output;
  for (const b of outputGroup.querySelectorAll<HTMLButtonElement>("button[data-value]")) {
    b.setAttribute("aria-checked", String(b === btn));
  }
  updateColorLabel();
  if (currentImage) render();
});

function readOptions(): MosaicOptions {
  const words = wordsInput.value
    .split(/[,，\s]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  return {
    words: words.length ? words : ["flower"],
    fontSize: Number(sizeInput.value),
    fontFamily: fontSelect.value,
    density: Number(densityInput.value),
    jitter: Number(jitterInput.value),
    sizeVariance: Number(sizeVarInput.value),
    color: colorSelect.value as MosaicOptions["color"],
    output: currentOutput,
  };
}

function render(autoCollapse = false) {
  if (!currentImage) return;
  renderMosaic(currentImage, canvas, readOptions());
  canvas.classList.add("ready");
  placeholder.style.display = "none";
  if (autoCollapse && isMobile()) setCollapsed(true);
}

function loadFile(file: File) {
  if (!file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    currentImage = img;
    render(true);
  };
  img.src = url;
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) loadFile(f);
});

renderBtn.addEventListener("click", () => render(true));

downloadBtn.addEventListener("click", () => {
  if (!currentImage) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `text-mosaic-${currentOutput}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
});

["dragenter", "dragover"].forEach((e) =>
  stage.addEventListener(e, (ev) => {
    ev.preventDefault();
    stage.classList.add("dragover");
  }),
);
["dragleave", "drop"].forEach((e) =>
  stage.addEventListener(e, (ev) => {
    ev.preventDefault();
    stage.classList.remove("dragover");
  }),
);
stage.addEventListener("drop", (ev) => {
  const f = ev.dataTransfer?.files?.[0];
  if (f) loadFile(f);
});

updateColorLabel();
