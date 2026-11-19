// Wires the page: pick a layout, grade and size, load a photo per panel, drag and
// zoom each, type the title and subtitle, export the cover as a PNG. A `?shot=`
// query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, panelRects } from './cover.js';
import { shotScene, markShotReady } from './shots.js';

const SAMPLES = ['boulevard', 'pier'];
const PANEL_COUNT = { split: 3, grid: 4, bands: 3 };

const canvas = document.getElementById('cover');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const status = document.getElementById('status');
const panelLabel = document.getElementById('panelLabel');
const photoFile = document.getElementById('photoFile');

const state = {
  layout: 'split',
  grade: 'sunset',
  size: 'square',
  title: titleInput.value,
  subtitle: subtitleInput.value,
  panels: [],
};
let selected = 0;
let dragging = null;

function freshPanels() {
  const n = PANEL_COUNT[state.layout];
  const old = state.panels;
  state.panels = Array.from({ length: n }, (_, i) => {
    const kept = old[i];
    if (kept) return kept;
    return { photo: null, sample: SAMPLES[i % 2], zoom: 1, ox: 0, oy: 0 };
  });
}

function redraw() {
  drawCover(canvas, state);
  panelLabel.textContent = `Panel ${selected + 1} of ${state.panels.length}`;
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSample(name) {
  return loadImage(`samples/${name}.jpg`);
}

async function fillSamples(first, second) {
  const names = [first, second, first, second];
  const loaded = await Promise.all(names.map((n) => loadSample(n)));
  state.panels.forEach((panel, i) => {
    panel.photo = loaded[i];
    panel.sample = names[i];
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
  });
}

function pickPanel(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = (clientX - box.left) * (canvas.width / box.width);
  const y = (clientY - box.top) * (canvas.height / box.height);
  const rects = panelRects(canvas.width, canvas.height, state.layout);
  const hit = rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  return hit === -1 ? null : { index: hit, rect: rects[hit], x, y };
}

function bindGroup(id, key) {
  document.getElementById(id).addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-' + key + ']');
    if (!btn) return;
    state[key] = btn.dataset[key];
    document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('on', b === btn));
    if (key === 'layout') {
      selected = 0;
      freshPanels();
    }
    redraw();
  });
}
bindGroup('layoutRow', 'layout');
bindGroup('gradeRow', 'grade');
bindGroup('sizeRow', 'size');

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });

canvas.addEventListener('pointerdown', (e) => {
  const hit = pickPanel(e.clientX, e.clientY);
  if (!hit) return;
  selected = hit.index;
  const panel = state.panels[selected];
  dragging = { x: e.clientX, y: e.clientY, ox: panel.ox, oy: panel.oy, rect: hit.rect };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const panel = state.panels[selected];
  panel.ox = dragging.ox + (e.clientX - dragging.x) / dragging.rect.w;
  panel.oy = dragging.oy + (e.clientY - dragging.y) / dragging.rect.h;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const hit = pickPanel(e.clientX, e.clientY);
  if (!hit) return;
  selected = hit.index;
  const panel = state.panels[selected];
  panel.zoom = Math.min(3, Math.max(1, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  redraw();
}, { passive: false });

document.getElementById('loadPhoto').addEventListener('click', () => photoFile.click());
photoFile.addEventListener('change', async () => {
  const file = photoFile.files[0];
  if (!file) return;
  const panel = state.panels[selected];
  panel.photo = await loadImage(URL.createObjectURL(file));
  panel.sample = null;
  redraw();
});
document.getElementById('cycleSample').addEventListener('click', async () => {
  const panel = state.panels[selected];
  const next = panel.sample === 'boulevard' ? 'pier' : 'boulevard';
  panel.photo = await loadSample(next);
  panel.sample = next;
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  redraw();
});
document.getElementById('zoomIn').addEventListener('click', () => {
  const panel = state.panels[selected];
  panel.zoom = Math.min(3, panel.zoom * 1.25);
  redraw();
});
document.getElementById('zoomOut').addEventListener('click', () => {
  const panel = state.panels[selected];
  panel.zoom = Math.max(1, panel.zoom / 1.25);
  redraw();
});
document.getElementById('resetPanel').addEventListener('click', () => {
  const panel = state.panels[selected];
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  redraw();
});

document.getElementById('export').addEventListener('click', () => {
  redraw();
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `palmline-${state.size}-${canvas.width}x${canvas.height}.png`;
    a.click();
    status.textContent = `Saved ${a.download}`;
  }, 'image/png');
});

const params = new URLSearchParams(location.search);
const scene = params.get('shot') ? shotScene(params) : null;
freshPanels();
if (scene) {
  if (scene.shot === 'cover') document.body.classList.add('shot-cover');
  state.layout = scene.layout;
  state.grade = scene.grade;
  state.size = scene.size;
  state.title = scene.title;
  state.subtitle = scene.subtitle;
  titleInput.value = scene.title;
  subtitleInput.value = scene.subtitle;
  document.querySelectorAll('#layoutRow button').forEach((b) => b.classList.toggle('on', b.dataset.layout === scene.layout));
  document.querySelectorAll('#gradeRow button').forEach((b) => b.classList.toggle('on', b.dataset.grade === scene.grade));
  document.querySelectorAll('#sizeRow button').forEach((b) => b.classList.toggle('on', b.dataset.size === scene.size));
  freshPanels();
  fillSamples(scene.photo, scene.photo2).then(() => {
    redraw();
    markShotReady();
  });
} else {
  fillSamples('boulevard', 'pier').then(redraw);
}
