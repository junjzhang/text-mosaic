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
const colorGrid = $<HTMLDivElement>("colorGrid");
const customColorInput = $<HTMLInputElement>("customColor");
const colorLabel = $<HTMLSpanElement>("colorLabel");
const swapLink = $<HTMLLabelElement>("swapLink");
const outputGroup = $<HTMLDivElement>("output");
const downloadBtn = $<HTMLButtonElement>("download");
const canvas = $<HTMLCanvasElement>("canvas");
const placeholder = $<HTMLDivElement>("placeholder");
const stage = document.querySelector<HTMLElement>(".stage")!;
const controls = $<HTMLElement>("controls");
const toggleBtn = $<HTMLButtonElement>("toggle");

let currentImage: HTMLImageElement | null = null;
let currentOutput: Output = "positive";
let currentColor = "#ffffff";

type Swatch =
  | { type: "color"; value: string; label?: string }
  | { type: "avg"; label: string }
  | { type: "custom"; label: string };

const SWATCHES: Swatch[] = [
  { type: "color", value: "#ffffff", label: "白" },
  { type: "color", value: "#000000", label: "黑" },
  { type: "avg", label: "均色" },
  { type: "custom", label: "自选" },
  { type: "color", value: "#8DA3B8" },
  { type: "color", value: "#D9B6B9" },
  { type: "color", value: "#A5B5A0" },
  { type: "color", value: "#D4C8B8" },
  { type: "color", value: "#B7AFC7" },
  { type: "color", value: "#9F9F9F" },
  { type: "color", value: "#EAE3D2" },
  { type: "color", value: "#C2A593" },
  { type: "color", value: "#6C7A89" },
  { type: "color", value: "#8E7E93" },
  { type: "color", value: "#9FB3A8" },
  { type: "color", value: "#B89A7C" },
];

function buildSwatches() {
  for (const s of SWATCHES) {
    if (s.type === "custom") {
      const label = document.createElement("label");
      label.className = "color-swatch special custom";
      label.htmlFor = "customColor";
      label.textContent = s.label;
      label.title = s.label;
      colorGrid.appendChild(label);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-swatch";
      if (s.type === "avg") {
        btn.classList.add("special", "avg");
        btn.textContent = s.label;
        btn.title = s.label;
        btn.addEventListener("click", () => setColor("avg"));
      } else {
        btn.dataset.value = s.value.toLowerCase();
        btn.style.background = s.value;
        btn.title = s.label ?? s.value;
        btn.setAttribute("aria-label", s.label ?? s.value);
        btn.addEventListener("click", () => setColor(s.value));
      }
      colorGrid.appendChild(btn);
    }
  }
}

function setColor(value: string) {
  currentColor = value;
  updateActiveSwatch();
  scheduleRender();
}

function updateActiveSwatch() {
  const swatches = colorGrid.querySelectorAll<HTMLElement>(".color-swatch");
  let matched = false;
  for (const el of swatches) {
    if (el.classList.contains("custom")) continue;
    const isAvg = el.classList.contains("avg");
    const active = isAvg
      ? currentColor === "avg"
      : el.dataset.value === currentColor.toLowerCase();
    el.classList.toggle("active", active);
    if (active) matched = true;
  }
  const custom = colorGrid.querySelector<HTMLElement>(".custom");
  if (custom) {
    const useCustom = !matched && currentColor !== "avg";
    custom.classList.toggle("active", useCustom);
    custom.style.background = useCustom ? currentColor : "";
    custom.style.color = useCustom ? "transparent" : "";
  }
}

customColorInput.addEventListener("input", () => {
  setColor(customColorInput.value);
});

buildSwatches();
updateActiveSwatch();

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
  input.addEventListener("input", () => {
    sync();
    scheduleRender();
  });
}

wordsInput.addEventListener("input", scheduleRender);
fontSelect.addEventListener("change", scheduleRender);

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
  scheduleRender();
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
    color: currentColor,
    output: currentOutput,
  };
}

function render(autoCollapse = false) {
  if (!currentImage) return;
  renderMosaic(currentImage, canvas, readOptions());
  canvas.classList.add("ready");
  placeholder.style.display = "none";
  swapLink.classList.add("visible");
  if (autoCollapse && isMobile()) setCollapsed(true);
}

let renderTimer: number | null = null;
function scheduleRender() {
  if (!currentImage) return;
  if (renderTimer !== null) clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    renderTimer = null;
    render();
  }, 60);
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
