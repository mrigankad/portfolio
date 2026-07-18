// Click-to-view 3D model gallery. Thumbnails are plain images; the model file
// and the <model-viewer> component itself are only downloaded when a model is
// opened, so the gallery costs almost nothing on page load.
let viewerLoaded = false;

export function initModelGallery() {
  const dialog = document.getElementById('model-dialog');
  if (!dialog) return;
  const holder = dialog.querySelector('.mv-holder');
  const title = dialog.querySelector('.mv-title');

  document.querySelectorAll('[data-model]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      title.textContent = btn.dataset.title;
      holder.innerHTML = '<p class="mv-loading">Loading model…</p>';
      dialog.showModal();
      if (!viewerLoaded) {
        await import('@google/model-viewer');
        viewerLoaded = true;
      }
      const mv = document.createElement('model-viewer');
      mv.src = btn.dataset.model;
      mv.poster = btn.dataset.poster;
      mv.alt = `3D model: ${btn.dataset.title}`;
      mv.setAttribute('camera-controls', '');
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('shadow-intensity', '1');
      mv.setAttribute('touch-action', 'pan-y');
      holder.replaceChildren(mv);
    });
  });

  dialog.querySelector('.mv-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => holder.replaceChildren());
}
