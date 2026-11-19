// Fixed scenes for screenshots: ?shot=editor shows the page with a sample photo;
// ?shot=cover shows the cover alone. `photo` picks the first sample (samples/<photo>.jpg),
// `photo2` the second, `caption` the title, `sub` the subtitle, and `layout`, `grade`
// and `size` the rest. window.__shotReady is set once the scene is painted.
export function shotScene(query) {
  return {
    shot: query.get('shot') ?? 'editor',
    photo: query.get('photo') ?? 'boulevard',
    photo2: query.get('photo2') ?? 'pier',
    title: query.get('caption') ?? 'Boulevard Nights',
    subtitle: query.get('sub') ?? 'Neon Coast',
    layout: query.get('layout') ?? 'split',
    grade: query.get('grade') ?? 'sunset',
    size: query.get('size') ?? 'square',
  };
}

export function markShotReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
