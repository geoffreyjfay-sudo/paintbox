// ── State ──────────────────────────────────────────────────────────────────────

const MAX_COLOURS = 24;

let palette = loadPalette();   // [{ id, name, hex, r, g, b }]
let pendingColour = null;      // { hex, r, g, b } — colour sampled, not yet named
let img = null;                // HTMLImageElement of the uploaded swatch photo

// ── DOM refs ──────────────────────────────────────────────────────────────────

const uploadSection   = document.getElementById('upload-section');
const sampleSection   = document.getElementById('sample-section');
const uploadArea      = document.getElementById('upload-area');
const fileInput       = document.getElementById('file-input');
const canvas          = document.getElementById('swatch-canvas');
const ctx             = canvas.getContext('2d', { willReadFrequently: true });
const colourPreview   = document.getElementById('colour-preview');
const colourHex       = document.getElementById('colour-hex');
const colourNameInput = document.getElementById('colour-name');
const addBtn          = document.getElementById('add-btn');
const paletteGrid     = document.getElementById('palette-grid');
const paletteCount    = document.getElementById('palette-count');
const saveBtn         = document.getElementById('save-btn');
const toast           = document.getElementById('toast');

// ── Upload ────────────────────────────────────────────────────────────────────

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImage(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadImage(fileInput.files[0]);
});

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    img = new Image();
    img.onload = () => {
      // Draw image onto canvas, scaled to fit max width
      const maxW = canvas.parentElement.clientWidth || 700;
      const scale = Math.min(1, maxW / img.naturalWidth);
      canvas.width  = img.naturalWidth  * scale;
      canvas.height = img.naturalHeight * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      uploadSection.classList.add('hidden');
      sampleSection.classList.remove('hidden');
      renderPaletteGrid();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Colour sampling ───────────────────────────────────────────────────────────

canvas.addEventListener('click', (e) => {
  if (palette.length >= MAX_COLOURS) {
    showToast('Palette full (24 colours)');
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.round((e.clientX - rect.left) * scaleX);
  const y = Math.round((e.clientY - rect.top)  * scaleY);

  // Sample a small region around the click and average the pixels
  const sampleRadius = 4;
  const sx = Math.max(0, x - sampleRadius);
  const sy = Math.max(0, y - sampleRadius);
  const sw = Math.min(sampleRadius * 2, canvas.width  - sx);
  const sh = Math.min(sampleRadius * 2, canvas.height - sy);
  const data = ctx.getImageData(sx, sy, sw, sh).data;

  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }
  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);

  pendingColour = { hex: rgbToHex(r, g, b), r, g, b };

  colourPreview.style.background = pendingColour.hex;
  colourHex.textContent = pendingColour.hex.toUpperCase();
  colourNameInput.disabled = false;
  colourNameInput.value = '';
  colourNameInput.focus();
  updateAddBtn();
});

// ── Naming + adding ───────────────────────────────────────────────────────────

colourNameInput.addEventListener('input', updateAddBtn);

colourNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addToPalette();
});

addBtn.addEventListener('click', addToPalette);

function updateAddBtn() {
  addBtn.disabled = !pendingColour || colourNameInput.value.trim() === '';
}

function addToPalette() {
  if (!pendingColour || colourNameInput.value.trim() === '') return;
  if (palette.length >= MAX_COLOURS) {
    showToast('Palette full (24 colours)');
    return;
  }

  const entry = {
    id:   Date.now(),
    name: colourNameInput.value.trim(),
    hex:  pendingColour.hex,
    r:    pendingColour.r,
    g:    pendingColour.g,
    b:    pendingColour.b,
  };

  palette.push(entry);
  pendingColour = null;

  colourPreview.style.background = '#e8e3de';
  colourHex.textContent = '—';
  colourNameInput.value = '';
  colourNameInput.disabled = true;
  updateAddBtn();

  renderPaletteGrid();
  savePalette();
  showToast(`"${entry.name}" added`);
}

// ── Palette grid ──────────────────────────────────────────────────────────────

function renderPaletteGrid() {
  paletteGrid.innerHTML = '';
  paletteCount.textContent = `${palette.length} / ${MAX_COLOURS}`;

  palette.forEach((entry) => {
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    swatch.style.background = entry.hex;
    swatch.title = entry.name;

    const tooltip = document.createElement('div');
    tooltip.className = 'swatch-tooltip';
    tooltip.textContent = entry.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = `Remove ${entry.name}`;
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromPalette(entry.id);
    });

    swatch.appendChild(tooltip);
    swatch.appendChild(removeBtn);
    paletteGrid.appendChild(swatch);
  });

  saveBtn.classList.toggle('hidden', palette.length === 0);
}

function removeFromPalette(id) {
  palette = palette.filter((e) => e.id !== id);
  renderPaletteGrid();
  savePalette();
}

// ── Save / load (localStorage) ────────────────────────────────────────────────

saveBtn.addEventListener('click', () => {
  savePalette();
  showToast('Palette saved');
});

function savePalette() {
  localStorage.setItem('paintbox_palette', JSON.stringify(palette));
}

function loadPalette() {
  try {
    return JSON.parse(localStorage.getItem('paintbox_palette')) || [];
  } catch {
    return [];
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
}
