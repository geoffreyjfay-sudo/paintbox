// ── Storage schema ────────────────────────────────────────────────────────────
//
//  paintbox_palettes: [
//    { id, name, maxSlots, colours: Array(maxSlots) of { id, name, hex, r, g, b } | null }
//  ]
//
//  colours is always exactly maxSlots long; null = empty slot.

// ── State ─────────────────────────────────────────────────────────────────────

let palettes         = loadPalettes();
let activePalette    = null;
let selectedSize     = 24;
let pendingColour    = null;
let copySource       = null;
let colCount         = 8;
let dragSrcIndex     = null;
let referenceImgSrc  = null;  // dataURL of the reference photo (in-memory only)

// ── DOM refs ──────────────────────────────────────────────────────────────────

const homeSection        = document.getElementById('home-section');
const setupSection       = document.getElementById('setup-section');
const paletteViewSection = document.getElementById('palette-view-section');
const uploadSection      = document.getElementById('upload-section');
const sampleSection      = document.getElementById('sample-section');

const backBtn          = document.getElementById('back-btn');
const headerSubtitle   = document.getElementById('header-subtitle');

const newPaletteBtn    = document.getElementById('new-palette-btn');
const paletteListEl    = document.getElementById('palette-list');
const emptyState       = document.getElementById('empty-state');

const setupTitle       = document.getElementById('setup-title');
const copyNotice       = document.getElementById('copy-notice');
const paletteNameInput = document.getElementById('palette-name-input');
const sizeBtns         = document.querySelectorAll('.size-btn');
const createBtn        = document.getElementById('create-btn');

const paletteViewGrid  = document.getElementById('palette-view-grid');
const colBtns          = document.querySelectorAll('.col-btn');
const addColoursBtn    = document.getElementById('add-colours-btn');
const mixBtn           = document.getElementById('mix-btn');

const mixSection          = document.getElementById('mix-section');
const mixUploadArea       = document.getElementById('mix-upload-area');
const mixFileInput        = document.getElementById('mix-file-input');
const mixCanvasWrapper    = document.getElementById('mix-canvas-wrapper');
const mixCanvas           = document.getElementById('mix-canvas');
const mixCtx              = mixCanvas.getContext('2d', { willReadFrequently: true });
const changePhotoBtn      = document.getElementById('change-photo-btn');
const mixSampledPreview   = document.getElementById('mix-sampled-preview');
const mixPrompt           = document.getElementById('mix-prompt');
const mixSuggestionPanel  = document.getElementById('mix-suggestion-panel');
const suggestionPreview   = document.getElementById('suggestion-preview');
const suggestionParts     = document.getElementById('suggestion-parts');
const suggestionDelta     = document.getElementById('suggestion-delta');
const saveMixBtn          = document.getElementById('save-mix-btn');
const mixSavedList        = document.getElementById('mix-saved-list');

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

const SECTIONS = [
  'home-section', 'setup-section', 'palette-view-section',
  'mix-section', 'upload-section', 'sample-section'
];

function showSection(id) {
  SECTIONS.forEach((s) => document.getElementById(s).classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');

  const onHome = id === 'home-section';
  backBtn.classList.toggle('hidden', onHome);

  if (onHome) {
    headerSubtitle.textContent = 'Your watercolour palettes';
  } else if (id === 'setup-section') {
    headerSubtitle.textContent = copySource ? 'Copy palette' : 'New palette';
  } else if (id === 'mix-section') {
    headerSubtitle.textContent = `Mix — ${activePalette?.name ?? ''}`;
  } else {
    headerSubtitle.textContent = activePalette?.name ?? '';
  }
}

backBtn.addEventListener('click', () => {
  const current = SECTIONS.find((s) => !document.getElementById(s).classList.contains('hidden'));
  if (current === 'upload-section' || current === 'sample-section' || current === 'mix-section') {
    if (activePalette) {
      renderPaletteView();
      showSection('palette-view-section');
    } else {
      goHome();
    }
  } else {
    goHome();
  }
});

function goHome() {
  activePalette = null;
  pendingColour = null;
  copySource    = null;
  renderHomeScreen();
  showSection('home-section');
}

// ── Colours array helpers ─────────────────────────────────────────────────────

// Ensure colours is always exactly maxSlots long with nulls for empty slots
function normaliseColours(p) {
  const arr = Array.isArray(p.colours) ? p.colours : [];
  const fixed = Array.from({ length: p.maxSlots }, (_, i) => arr[i] ?? null);
  p.colours = fixed;
}

function filledCount(p) {
  return p.colours.filter(Boolean).length;
}

function firstEmptyIndex(p) {
  return p.colours.findIndex((c) => c === null);
}

// ── Home screen ───────────────────────────────────────────────────────────────

function renderHomeScreen() {
  paletteListEl.innerHTML = '';
  emptyState.classList.toggle('hidden', palettes.length > 0);

  palettes.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'palette-card';
    card.addEventListener('click', () => openPalette(p.id));

    // Mini swatch preview (up to 16 slots)
    const swatchGrid = document.createElement('div');
    swatchGrid.className = 'palette-card-swatches';
    const previewCount = Math.min(p.maxSlots, 16);
    for (let i = 0; i < previewCount; i++) {
      const s = document.createElement('div');
      s.className = 'palette-card-swatch' + (p.colours[i] ? '' : ' empty');
      if (p.colours[i]) s.style.background = p.colours[i].hex;
      swatchGrid.appendChild(s);
    }

    // Name row with pencil
    const nameRow = document.createElement('div');
    nameRow.className = 'palette-card-name-row';

    const nameEl = document.createElement('div');
    nameEl.className = 'palette-card-name';
    nameEl.textContent = p.name;

    const editBtn = document.createElement('button');
    editBtn.className = 'palette-card-edit';
    editBtn.title = 'Rename palette';
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startRename(p, nameEl, editBtn);
    });

    nameRow.appendChild(nameEl);
    nameRow.appendChild(editBtn);

    // Meta
    const meta = document.createElement('div');
    meta.className = 'palette-card-meta';
    meta.innerHTML = `<span>${filledCount(p)} / ${p.maxSlots} colours</span>`;

    const actions = document.createElement('div');
    actions.className = 'palette-card-actions';

    const copy = document.createElement('button');
    copy.className = 'palette-card-copy';
    copy.textContent = 'Copy';
    copy.addEventListener('click', (e) => { e.stopPropagation(); startCopy(p); });

    const del = document.createElement('button');
    del.className = 'palette-card-delete';
    del.textContent = 'Delete';
    del.addEventListener('click', (e) => { e.stopPropagation(); deletePalette(p.id); });

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
    if (trimmed && trimmed !== p.name) { p.name = trimmed; savePalettes(); }
    renderHomeScreen();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = p.name; input.blur(); }
  });
}

function openPalette(id) {
  activePalette = palettes.find((p) => p.id === id);
  if (!activePalette) return;
  renderPaletteView();
  showSection('palette-view-section');
}

function deletePalette(id) {
  palettes = palettes.filter((p) => p.id !== id);
  savePalettes();
  renderHomeScreen();
}

// ── New / copy palette setup ──────────────────────────────────────────────────

const SIZE_OPTIONS = [8, 16, 24, 32, 48];

function openSetup({ source = null } = {}) {
  copySource = source;

  if (source) {
    setupTitle.textContent = 'Copy palette';
    const n = filledCount(source);
    copyNotice.textContent = `Copying ${n} colour${n !== 1 ? 's' : ''} from "${source.name}"`;
    copyNotice.classList.remove('hidden');
    paletteNameInput.value = `${source.name} (copy)`;
    const minSize = n;
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
    btn.disabled = source ? size < filledCount(source) : false;
    btn.classList.toggle('selected', size === selectedSize);
  });

  createBtn.disabled = paletteNameInput.value.trim() === '';
  showSection('setup-section');
}

newPaletteBtn.addEventListener('click', () => openSetup());
function startCopy(source) { openSetup({ source }); }

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

  // Seed from source: copy positions (including gaps), pad/trim to new size
  let seedColours;
  if (copySource) {
    seedColours = Array.from({ length: selectedSize }, (_, i) => {
      const c = copySource.colours[i];
      return c ? { ...c, id: Date.now() + Math.random() } : null;
    });
  } else {
    seedColours = Array(selectedSize).fill(null);
  }

  activePalette = { id: Date.now(), name, maxSlots: selectedSize, colours: seedColours };
  palettes.push(activePalette);
  savePalettes();
  copySource = null;

  showSection('upload-section');
});

// ── Palette view ──────────────────────────────────────────────────────────────

colBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    colCount = Number(btn.dataset.cols);
    colBtns.forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    renderPaletteView();
  });
});

addColoursBtn.addEventListener('click', () => showSection('upload-section'));

function renderPaletteView() {
  paletteViewGrid.innerHTML = '';
  paletteViewGrid.style.gridTemplateColumns = `repeat(${colCount}, 1fr)`;

  activePalette.colours.forEach((colour, i) => {
    const cell = document.createElement('div');
    cell.className = 'view-cell' + (colour ? '' : ' empty');
    cell.dataset.index = i;

    const pan = document.createElement('div');
    pan.className = 'view-pan' + (colour ? '' : ' empty-pan');
    if (colour) pan.style.background = colour.hex;

    if (colour) {
      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'view-remove-btn';
      removeBtn.textContent = '×';
      removeBtn.title = `Remove ${colour.name}`;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        activePalette.colours[i] = null;
        savePalettes();
        renderPaletteView();
      });
      pan.appendChild(removeBtn);

      // Drag
      cell.draggable = true;
      cell.addEventListener('dragstart', (e) => {
        dragSrcIndex = i;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => cell.classList.add('dragging'), 0);
      });
      cell.addEventListener('dragend', () => {
        cell.classList.remove('dragging');
        document.querySelectorAll('.view-cell').forEach((c) => c.classList.remove('drag-over'));
      });
    }

    // Drop target on every cell (filled or empty)
    cell.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.view-cell').forEach((c) => c.classList.remove('drag-over'));
      cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      const destIndex = Number(cell.dataset.index);
      if (dragSrcIndex === null || dragSrcIndex === destIndex) return;
      // Swap positions (preserves gaps)
      const temp = activePalette.colours[dragSrcIndex];
      activePalette.colours[dragSrcIndex] = activePalette.colours[destIndex];
      activePalette.colours[destIndex] = temp;
      dragSrcIndex = null;
      savePalettes();
      renderPaletteView();
    });

    const label = document.createElement('div');
    label.className = 'view-label';
    label.textContent = colour ? colour.name : '';

    cell.appendChild(pan);
    cell.appendChild(label);
    paletteViewGrid.appendChild(cell);
  });
}

// ── Mix section ───────────────────────────────────────────────────────────────

mixBtn.addEventListener('click', () => {
  openMixSection();
});

function openMixSection() {
  currentSuggestion = null;
  mixSuggestionPanel.classList.add('hidden');
  mixSampledPreview.style.background = '';
  mixPrompt.textContent = 'Sample a colour from your photo';

  if (referenceImgSrc) {
    showReferenceImage(referenceImgSrc);
  } else {
    mixCanvasWrapper.classList.add('hidden');
    mixUploadArea.classList.remove('hidden');
  }

  renderSavedMixes();
  showSection('mix-section');
}

// Reference photo upload
mixUploadArea.addEventListener('click', () => mixFileInput.click());
mixUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); mixUploadArea.classList.add('drag-over'); });
mixUploadArea.addEventListener('dragleave', () => mixUploadArea.classList.remove('drag-over'));
mixUploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  mixUploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadReferenceImage(file);
});
mixFileInput.addEventListener('change', () => {
  if (mixFileInput.files[0]) loadReferenceImage(mixFileInput.files[0]);
  mixFileInput.value = '';
});
changePhotoBtn.addEventListener('click', () => {
  referenceImgSrc = null;
  mixCanvasWrapper.classList.add('hidden');
  mixUploadArea.classList.remove('hidden');
  mixSuggestionPanel.classList.add('hidden');
  mixSampledPreview.style.background = '';
  mixPrompt.textContent = 'Sample a colour from your photo';
});

function loadReferenceImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    referenceImgSrc = e.target.result;
    showReferenceImage(referenceImgSrc);
  };
  reader.readAsDataURL(file);
}

function showReferenceImage(src) {
  const img = new Image();
  img.onload = () => {
    const maxW = mixCanvasWrapper.clientWidth || 700;
    const scale = Math.min(1, maxW / img.naturalWidth);
    mixCanvas.width  = img.naturalWidth  * scale;
    mixCanvas.height = img.naturalHeight * scale;
    mixCtx.drawImage(img, 0, 0, mixCanvas.width, mixCanvas.height);
    mixUploadArea.classList.add('hidden');
    mixCanvasWrapper.classList.remove('hidden');
  };
  img.src = src;
}

// Eyedropper
let currentSuggestion = null;

mixCanvas.addEventListener('click', (e) => {
  const rect   = mixCanvas.getBoundingClientRect();
  const scaleX = mixCanvas.width  / rect.width;
  const scaleY = mixCanvas.height / rect.height;
  const x = Math.round((e.clientX - rect.left) * scaleX);
  const y = Math.round((e.clientY - rect.top)  * scaleY);

  const r2 = 3;
  const sx = Math.max(0, x - r2), sy = Math.max(0, y - r2);
  const sw = Math.min(r2 * 2, mixCanvas.width - sx);
  const sh = Math.min(r2 * 2, mixCanvas.height - sy);
  const data = mixCtx.getImageData(sx, sy, sw, sh).data;

  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
  r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);

  const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  mixSampledPreview.style.background = hex;
  mixPrompt.textContent = hex.toUpperCase();

  const result = suggestMix(r, g, b, activePalette.colours);
  if (!result) return;

  currentSuggestion = { targetHex: hex, ...result };
  renderSuggestion(result);
});

function renderSuggestion(result) {
  suggestionPreview.style.background = result.mixHex;

  suggestionParts.innerHTML = '';
  result.parts.forEach(({ colour, ratio }) => {
    const row = document.createElement('div');
    row.className = 'suggestion-part-row';

    const dot = document.createElement('div');
    dot.className = 'suggestion-dot';
    dot.style.background = colour.hex;

    const text = document.createElement('span');
    text.textContent = result.parts.length > 1
      ? `${colour.name} — ${ratio} part${ratio !== 1 ? 's' : ''}`
      : colour.name;

    row.appendChild(dot);
    row.appendChild(text);
    suggestionParts.appendChild(row);
  });

  // Quality indicator
  const dE = result.deltaE;
  const quality = dE < 5 ? 'Excellent match' : dE < 12 ? 'Good match' : dE < 20 ? 'Fair match' : 'Approximate';
  suggestionDelta.textContent = `${quality} (ΔE ${dE.toFixed(1)})`;
  suggestionDelta.className = 'suggestion-delta ' + (dE < 5 ? 'match-excellent' : dE < 12 ? 'match-good' : dE < 20 ? 'match-fair' : 'match-poor');

  mixSuggestionPanel.classList.remove('hidden');
}

// Save mix
saveMixBtn.addEventListener('click', () => {
  if (!currentSuggestion) return;
  if (!activePalette.savedMixes) activePalette.savedMixes = [];

  const mix = {
    id:        Date.now(),
    targetHex: currentSuggestion.targetHex,
    mixHex:    currentSuggestion.mixHex,
    deltaE:    currentSuggestion.deltaE,
    parts:     currentSuggestion.parts.map(({ colour, ratio }) => ({
      name: colour.name, hex: colour.hex, ratio,
    })),
  };

  activePalette.savedMixes.unshift(mix);
  savePalettes();
  renderSavedMixes();
  showToast('Mix saved');
  saveMixBtn.textContent = '♥ Saved';
  setTimeout(() => { saveMixBtn.textContent = '♡ Save mix'; }, 1500);
});

function renderSavedMixes() {
  mixSavedList.innerHTML = '';
  const mixes = activePalette.savedMixes || [];

  if (mixes.length === 0) {
    mixSavedList.innerHTML = '<p class="mix-saved-empty">No saved mixes yet</p>';
    return;
  }

  mixes.forEach((mix) => {
    const row = document.createElement('div');
    row.className = 'saved-mix-row';

    const swatches = document.createElement('div');
    swatches.className = 'saved-mix-swatches';

    const target = document.createElement('div');
    target.className = 'saved-mix-swatch target-swatch';
    target.style.background = mix.targetHex;
    target.title = 'Target colour';

    const arrow = document.createElement('span');
    arrow.className = 'saved-mix-arrow';
    arrow.textContent = '→';

    const result = document.createElement('div');
    result.className = 'saved-mix-swatch';
    result.style.background = mix.mixHex;
    result.title = 'Mix result';

    swatches.appendChild(target);
    swatches.appendChild(arrow);
    swatches.appendChild(result);

    const info = document.createElement('div');
    info.className = 'saved-mix-info';
    info.textContent = mix.parts.map((p) =>
      mix.parts.length > 1 ? `${p.name} ×${p.ratio}` : p.name
    ).join(' + ');

    const del = document.createElement('button');
    del.className = 'saved-mix-delete';
    del.textContent = '×';
    del.addEventListener('click', () => {
      activePalette.savedMixes = activePalette.savedMixes.filter((m) => m.id !== mix.id);
      savePalettes();
      renderSavedMixes();
    });

    row.appendChild(swatches);
    row.appendChild(info);
    row.appendChild(del);
    mixSavedList.appendChild(row);
  });
}

// ── Upload ────────────────────────────────────────────────────────────────────

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
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
      renderSamplePaletteGrid();
      showSection('sample-section');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Colour sampling ───────────────────────────────────────────────────────────

canvas.addEventListener('click', (e) => {
  if (firstEmptyIndex(activePalette) === -1) {
    showToast(`Palette full (${activePalette.maxSlots} colours)`);
    return;
  }

  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.round((e.clientX - rect.left) * scaleX);
  const y = Math.round((e.clientY - rect.top)  * scaleY);

  const r2 = 4;
  const sx = Math.max(0, x - r2), sy = Math.max(0, y - r2);
  const sw = Math.min(r2 * 2, canvas.width - sx), sh = Math.min(r2 * 2, canvas.height - sy);
  const data = ctx.getImageData(sx, sy, sw, sh).data;

  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
  r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);

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
colourNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addToPalette(); });
addBtn.addEventListener('click', addToPalette);

function updateAddBtn() {
  addBtn.disabled = !pendingColour || colourNameInput.value.trim() === '';
}

function addToPalette() {
  if (!pendingColour || colourNameInput.value.trim() === '') return;
  const slot = firstEmptyIndex(activePalette);
  if (slot === -1) {
    showToast(`Palette full (${activePalette.maxSlots} colours)`);
    return;
  }
  const entry = {
    id: Date.now(), name: colourNameInput.value.trim(),
    hex: pendingColour.hex, r: pendingColour.r, g: pendingColour.g, b: pendingColour.b,
  };
  activePalette.colours[slot] = entry;
  pendingColour = null;
  resetColourPicker();
  renderSamplePaletteGrid();
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

function renderSamplePaletteGrid() {
  paletteGrid.innerHTML = '';
  const { colours, maxSlots, name } = activePalette;
  paletteTitle.textContent = name;
  paletteCount.textContent = `${filledCount(activePalette)} / ${maxSlots}`;

  colours.forEach((entry) => {
    if (!entry) return;
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    swatch.style.background = entry.hex;

    const tooltip = document.createElement('div');
    tooltip.className = 'swatch-tooltip';
    tooltip.textContent = entry.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const idx = activePalette.colours.findIndex((c) => c && c.id === entry.id);
      if (idx !== -1) activePalette.colours[idx] = null;
      renderSamplePaletteGrid();
      savePalettes();
    });

    swatch.appendChild(tooltip);
    swatch.appendChild(removeBtn);
    paletteGrid.appendChild(swatch);
  });

  doneBtn.classList.toggle('hidden', filledCount(activePalette) === 0);
}

doneBtn.addEventListener('click', () => {
  savePalettes();
  renderPaletteView();
  showSection('palette-view-section');
});

// ── Persist ───────────────────────────────────────────────────────────────────

function savePalettes() {
  localStorage.setItem('paintbox_palettes', JSON.stringify(palettes));
}

function loadPalettes() {
  try {
    const old = localStorage.getItem('paintbox_palette');
    if (old) {
      const colours = JSON.parse(old);
      if (Array.isArray(colours) && colours.length) {
        const p = { id: Date.now(), name: 'My Palette', maxSlots: 24, colours };
        normaliseColours(p);
        const migrated = [p];
        localStorage.setItem('paintbox_palettes', JSON.stringify(migrated));
        localStorage.removeItem('paintbox_palette');
        return migrated;
      }
      localStorage.removeItem('paintbox_palette');
    }
    const stored = JSON.parse(localStorage.getItem('paintbox_palettes')) || [];
    stored.forEach(normaliseColours);
    return stored;
  } catch { return []; }
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
