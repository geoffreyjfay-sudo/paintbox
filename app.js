// ── Storage schema ────────────────────────────────────────────────────────────
//
//  paintbox_palettes: [
//    { id, name, maxSlots, colours: [{ id, name, hex, r, g, b }] }
//  ]

// ── State ─────────────────────────────────────────────────────────────────────

let palettes       = loadPalettes();   // all saved palettes
let activePalette  = null;             // palette being built/edited
let selectedSize   = 24;              // chosen slot count for new palette
let pendingColour  = null;            // { hex, r, g, b } sampled, not yet named
let copySource     = null;            // palette being copied from, if any

// ── DOM refs ──────────────────────────────────────────────────────────────────

const homeSection      = document.getElementById('home-section');
const setupSection     = document.getElementById('setup-section');
const uploadSection    = document.getElementById('upload-section');
const sampleSection    = document.getElementById('sample-section');
const backBtn          = document.getElementById('back-btn');
const headerSubtitle   = document.getElementById('header-subtitle');

const newPaletteBtn    = document.getElementById('new-palette-btn');
const paletteListEl    = document.getElementById('palette-list');
const emptyState       = document.getElementById('empty-state');

const paletteNameInput = document.getElementById('palette-name-input');
const sizeBtns         = document.querySelectorAll('.size-btn');
const createBtn        = document.getElementById('create-btn');
const setupTitle       = document.getElementById('setup-title');
const copyNotice       = document.getElementById('copy-notice');

const uploadArea       = document.getElementById('upload-area');
const fileInput        = document.getElementById('file-input');

const canvas           = document.getElementById('swatch-canvas');
const ctx              = canvas.getContext('2d', { willReadFrequently: true });
const colourPreview    = document.getElementById('colour-preview');
const colourHex        = document.getElementById('colour-hex');
const colourNameInput  = document.getElementById('colour-name');
const addBtn           = document.getElementById('add-btn');
const paletteGrid      = document.getElementById('palette-grid');
const paletteCount     = document.getElementById('palette-count');
const paletteTitle     = document.getElementById('palette-title');
const doneBtn          = document.getElementById('done-btn');
const toast            = document.getElementById('toast');

// ── Navigation ────────────────────────────────────────────────────────────────

function showSection(id) {
  [homeSection, setupSection, uploadSection, sampleSection].forEach((s) =>
    s.classList.add('hidden')
  );
  document.getElementById(id).classList.remove('hidden');

  const onHome = id === 'home-section';
  backBtn.classList.toggle('hidden', onHome);
  headerSubtitle.textContent = onHome
    ? 'Your watercolour palettes'
    : activePalette?.name ?? 'New palette';
}

backBtn.addEventListener('click', () => {
  activePalette = null;
  pendingColour = null;
  showSection('home-section');
  renderHomeScreen();
});

// ── Home screen ───────────────────────────────────────────────────────────────

function renderHomeScreen() {
  paletteListEl.innerHTML = '';
  const hasPalettes = palettes.length > 0;
  emptyState.classList.toggle('hidden', hasPalettes);

  palettes.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'palette-card';
    card.addEventListener('click', () => openPalette(p.id));

    // Mini swatch preview — show up to 16 slots
    const swatchGrid = document.createElement('div');
    swatchGrid.className = 'palette-card-swatches';
    const previewCount = Math.min(p.maxSlots, 16);
    for (let i = 0; i < previewCount; i++) {
      const s = document.createElement('div');
      s.className = 'palette-card-swatch' + (p.colours[i] ? '' : ' empty');
      if (p.colours[i]) s.style.background = p.colours[i].hex;
      swatchGrid.appendChild(s);
    }

    const nameRow = document.createElement('div');
    nameRow.className = 'palette-card-name-row';

    const name = document.createElement('div');
    name.className = 'palette-card-name';
    name.textContent = p.name;

    const editBtn = document.createElement('button');
    editBtn.className = 'palette-card-edit';
    editBtn.title = 'Rename palette';
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startRename(p, name, editBtn);
    });

    nameRow.appendChild(name);
    nameRow.appendChild(editBtn);

    const meta = document.createElement('div');
    meta.className = 'palette-card-meta';
    meta.innerHTML = `<span>${p.colours.length} / ${p.maxSlots} colours</span>`;

    const actions = document.createElement('div');
    actions.className = 'palette-card-actions';

    const copy = document.createElement('button');
    copy.className = 'palette-card-copy';
    copy.textContent = 'Copy';
    copy.addEventListener('click', (e) => {
      e.stopPropagation();
      startCopy(p);
    });

    const del = document.createElement('button');
    del.className = 'palette-card-delete';
    del.textContent = 'Delete';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePalette(p.id);
    });

    actions.appendChild(copy);
    actions.appendChild(del);
    meta.appendChild(actions);

    card.appendChild(swatchGrid);
    card.appendChild(nameRow);
    card.appendChild(meta);
    paletteListEl.appendChild(card);
  });
}

function startRename(p, nameEl, editBtn) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = p.name;
  input.className = 'palette-card-rename-input';
  input.maxLength = 60;

  nameEl.replaceWith(input);
  editBtn.classList.add('hidden');
  input.focus();
  input.select();

  function commit() {
    const trimmed = input.value.trim();
    if (trimmed && trimmed !== p.name) {
      p.name = trimmed;
      savePalettes();
    }
    renderHomeScreen();
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = p.name; input.blur(); }
  });
}

function openPalette(id) {
  activePalette = palettes.find((p) => p.id === id);
  if (!activePalette) return;
  renderPaletteGrid();
  showSection('upload-section');
}

function deletePalette(id) {
  palettes = palettes.filter((p) => p.id !== id);
  savePalettes();
  renderHomeScreen();
}

// ── New palette setup ─────────────────────────────────────────────────────────

const SIZE_OPTIONS = [8, 16, 24, 32, 48];

function openSetup({ source = null } = {}) {
  copySource = source;

  if (source) {
    setupTitle.textContent = 'Copy palette';
    copyNotice.textContent = `Copying ${source.colours.length} colour${source.colours.length !== 1 ? 's' : ''} from "${source.name}"`;
    copyNotice.classList.remove('hidden');
    paletteNameInput.value = `${source.name} (copy)`;
    // Default to next size up that fits; fall back to same size
    const minSize = source.colours.length;
    const nextSize = SIZE_OPTIONS.find((s) => s > source.maxSlots && s >= minSize)
      || SIZE_OPTIONS.find((s) => s >= minSize)
      || source.maxSlots;
    selectedSize = nextSize;
  } else {
    setupTitle.textContent = 'New palette';
    copyNotice.classList.add('hidden');
    paletteNameInput.value = '';
    selectedSize = 24;
  }

  sizeBtns.forEach((btn) => {
    const size = Number(btn.dataset.size);
    const tooSmall = source && size < source.colours.length;
    btn.disabled = tooSmall;
    btn.classList.toggle('selected', size === selectedSize);
  });

  createBtn.disabled = paletteNameInput.value.trim() === '';
  showSection('setup-section');
}

newPaletteBtn.addEventListener('click', () => openSetup());

function startCopy(source) {
  openSetup({ source });
}

paletteNameInput.addEventListener('input', () => {
  createBtn.disabled = paletteNameInput.value.trim() === '';
});

sizeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedSize = Number(btn.dataset.size);
    sizeBtns.forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

createBtn.addEventListener('click', () => {
  const name = paletteNameInput.value.trim();
  if (!name) return;

  // Deep-copy colours from source if copying, giving each a fresh id
  const seedColours = copySource
    ? copySource.colours.map((c) => ({ ...c, id: Date.now() + Math.random() }))
    : [];

  activePalette = {
    id:       Date.now(),
    name,
    maxSlots: selectedSize,
    colours:  seedColours,
  };
  palettes.push(activePalette);
  savePalettes();
  copySource = null;

  renderPaletteGrid();
  showSection('upload-section');
});

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
  fileInput.value = '';
});

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxW = canvas.parentElement.clientWidth || 700;
      const scale = Math.min(1, maxW / img.naturalWidth);
      canvas.width  = img.naturalWidth  * scale;
      canvas.height = img.naturalHeight * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      resetColourPicker();
      renderPaletteGrid();
      showSection('sample-section');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Colour sampling ───────────────────────────────────────────────────────────

canvas.addEventListener('click', (e) => {
  if (activePalette.colours.length >= activePalette.maxSlots) {
    showToast(`Palette full (${activePalette.maxSlots} colours)`);
    return;
  }

  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.round((e.clientX - rect.left) * scaleX);
  const y = Math.round((e.clientY - rect.top)  * scaleY);

  const r2 = 4;
  const sx = Math.max(0, x - r2);
  const sy = Math.max(0, y - r2);
  const sw = Math.min(r2 * 2, canvas.width  - sx);
  const sh = Math.min(r2 * 2, canvas.height - sy);
  const data = ctx.getImageData(sx, sy, sw, sh).data;

  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
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
  if (activePalette.colours.length >= activePalette.maxSlots) {
    showToast(`Palette full (${activePalette.maxSlots} colours)`);
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

  activePalette.colours.push(entry);
  pendingColour = null;
  resetColourPicker();
  renderPaletteGrid();
  savePalettes();
  showToast(`"${entry.name}" added`);
}

function resetColourPicker() {
  colourPreview.style.background = '#e8e3de';
  colourHex.textContent = '—';
  colourNameInput.value = '';
  colourNameInput.disabled = true;
  updateAddBtn();
}

// ── Palette grid ──────────────────────────────────────────────────────────────

function renderPaletteGrid() {
  paletteGrid.innerHTML = '';
  const { colours, maxSlots, name } = activePalette;

  paletteTitle.textContent = name;
  paletteCount.textContent = `${colours.length} / ${maxSlots}`;

  colours.forEach((entry) => {
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    swatch.style.background = entry.hex;

    const tooltip = document.createElement('div');
    tooltip.className = 'swatch-tooltip';
    tooltip.textContent = entry.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = `Remove ${entry.name}`;
    removeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      activePalette.colours = activePalette.colours.filter((c) => c.id !== entry.id);
      renderPaletteGrid();
      savePalettes();
    });

    swatch.appendChild(tooltip);
    swatch.appendChild(removeBtn);
    paletteGrid.appendChild(swatch);
  });

  doneBtn.classList.toggle('hidden', colours.length === 0);
}

doneBtn.addEventListener('click', () => {
  savePalettes();
  showToast('Palette saved');
  showSection('home-section');
  renderHomeScreen();
});

// ── Persist ───────────────────────────────────────────────────────────────────

function savePalettes() {
  localStorage.setItem('paintbox_palettes', JSON.stringify(palettes));
}

function loadPalettes() {
  try {
    // Migrate old single-palette format
    const old = localStorage.getItem('paintbox_palette');
    if (old) {
      const colours = JSON.parse(old);
      if (Array.isArray(colours) && colours.length) {
        const migrated = [{ id: Date.now(), name: 'My Palette', maxSlots: 24, colours }];
        localStorage.setItem('paintbox_palettes', JSON.stringify(migrated));
        localStorage.removeItem('paintbox_palette');
        return migrated;
      }
      localStorage.removeItem('paintbox_palette');
    }
    return JSON.parse(localStorage.getItem('paintbox_palettes')) || [];
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

// ── Init ──────────────────────────────────────────────────────────────────────

renderHomeScreen();
showSection('home-section');
