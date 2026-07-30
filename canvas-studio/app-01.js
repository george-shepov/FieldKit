'use strict';
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);

const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const hexFromRgb = (r, g, b) => `#${[r,g,b].map(v => clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('')}`;

const rgba = (hex, alpha = 1) => {
        const h = hex.replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
      };

const canvas = $('#editorCanvas');

const ctx = canvas.getContext('2d', { willReadFrequently: true });

const canvasFrame = $('#canvasFrame');

const stage = $('#stage');

const emptyState = $('#emptyState');

const fileInput = $('#fileInput');

const sidebar = $('#sidebar');

const exportPreview = $('#exportPreview');

const exportPreviewCtx = exportPreview.getContext('2d');

const filters = [
        { id:'none', name:'Original', description:'No creative filter.', preview:'none' },
        { id:'vintage', name:'Vintage', description:'Warm sepia, softened contrast, and muted saturation.', preview:'sepia(.55) contrast(.92) saturate(.8)' },
        { id:'mono', name:'Mono', description:'Clean black-and-white conversion.', preview:'grayscale(1)' },
        { id:'noir', name:'Noir', description:'High-contrast monochrome with dramatic shadows.', preview:'grayscale(1) contrast(1.45) brightness(.92)' },
        { id:'warm', name:'Warm', description:'Adds warm red and amber tones.', preview:'sepia(.35) saturate(1.25) hue-rotate(-10deg)' },
        { id:'cool', name:'Cool', description:'Adds blue/cyan toning and crisp contrast.', preview:'saturate(1.1) hue-rotate(12deg) contrast(1.08)' },
        { id:'dream', name:'Dream', description:'Soft glow with brighter highlights and richer color.', preview:'blur(.7px) brightness(1.08) saturate(1.25)' },
        { id:'dramatic', name:'Dramatic', description:'Strong contrast and deep saturation.', preview:'contrast(1.35) saturate(1.35)' },
        { id:'invert', name:'Invert', description:'Inverts image colors for a negative effect.', preview:'invert(1)' },
        { id:'faded', name:'Faded', description:'Lifts shadows and softens color for a matte look.', preview:'contrast(.8) brightness(1.08) saturate(.75)' }
      ];

const state = {
        width: 1200,
        height: 800,
        layers: [],
        activeLayerId: null,
        activeTool: 'select',
        zoom: 1,
        cropRect: null,
        cropActive: false,
        selectedShape: 'rect',
        textStyle: { bold:false, italic:false, uppercase:false },
        documentName: 'canvas-studio'
      };

const imageCache = new Map();

const processedCache = new Map();

const history = [];

let historyIndex = -1;

let renderQueued = false;

let renderGeneration = 0;

let isPointerDown = false;

let pointerStart = null;

let originalLayerPosition = null;

let draftShape = null;

let resizeRatio = 1.5;

let suppressHistory = false;

function toast(message, type = '') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        $('#toastStack').appendChild(el);
        setTimeout(() => el.remove(), 2800);
      }

function getActiveLayer() {
        return normalizeLayer(state.layers.find(l => l.id === state.activeLayerId) || null);
      }

function defaultImageAdjustments() {
        return { brightness:0, contrast:0, saturation:0, sharpness:0, filter:'none', filterStrength:100, filterParam:50 };
      }

function defaultBackgroundRemoval() {
        return { enabled:false, color:'#ffffff', tolerance:18, softness:12, despill:35 };
      }

function defaultLayerEffects() {
        return {
          shadow:{ enabled:false, color:'#000000', opacity:55, blur:24, offsetX:12, offsetY:14 },
          glow:{ enabled:false, color:'#7c5cff', opacity:65, blur:28 }
        };
      }

function normalizeLayer(layer) {
        if (!layer) return layer;
        if (layer.opacity == null) layer.opacity = 1;
        if (!layer.blendMode) layer.blendMode = 'source-over';
        if (layer.visible == null) layer.visible = true;
        if (!layer.effects) layer.effects = defaultLayerEffects();
        if (!layer.effects.shadow) layer.effects.shadow = defaultLayerEffects().shadow;
        if (!layer.effects.glow) layer.effects.glow = defaultLayerEffects().glow;
        if (layer.type === 'image') {
          if (!layer.adjustments) layer.adjustments = defaultImageAdjustments();
          if (!layer.backgroundRemoval) layer.backgroundRemoval = defaultBackgroundRemoval();
        }
        return layer;
      }

function serializeState() {
        return deepClone({
          width: state.width,
          height: state.height,
          layers: state.layers,
          activeLayerId: state.activeLayerId,
          documentName: state.documentName
        });
      }

function pushHistory(label = 'Edit') {
        if (suppressHistory) return;
        const snapshot = serializeState();
        const signature = JSON.stringify(snapshot);
        if (historyIndex >= 0 && history[historyIndex]?.signature === signature) return;
        history.splice(historyIndex + 1);
        history.push({ label, snapshot, signature });
        if (history.length > 40) history.shift();
        historyIndex = history.length - 1;
        updateHistoryButtons();
      }

function restoreHistory(index) {
        const entry = history[index];
        if (!entry) return;
        suppressHistory = true;
        const snap = deepClone(entry.snapshot);
        state.width = snap.width;
        state.height = snap.height;
        state.layers = snap.layers.map(normalizeLayer);
        state.activeLayerId = snap.activeLayerId;
        state.documentName = snap.documentName;
        state.cropRect = null;
        state.cropActive = false;
        historyIndex = index;
        processedCache.clear();
        syncCanvasSize();
        refreshUI();
        requestRender();
        suppressHistory = false;
      }

function undo() { if (historyIndex > 0) restoreHistory(historyIndex - 1); }

function redo() { if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1); }

function updateHistoryButtons() {
        $('#undoBtn').disabled = historyIndex <= 0;
        $('#redoBtn').disabled = historyIndex < 0 || historyIndex >= history.length - 1;
      }

function syncCanvasSize() {
        canvas.width = Math.max(1, Math.round(state.width));
        canvas.height = Math.max(1, Math.round(state.height));
        canvas.style.width = `${Math.round(state.width * state.zoom)}px`;
        canvas.style.height = `${Math.round(state.height * state.zoom)}px`;
        resizeRatio = state.width / state.height;
        $('#resizeW').value = Math.round(state.width);
        $('#resizeH').value = Math.round(state.height);
        $('#resizeMeta').textContent = `${Math.round(state.width)} × ${Math.round(state.height)} px`;
        $('#exportDimensions').textContent = `${Math.round(state.width)} × ${Math.round(state.height)}`;
        $('#docBadge').textContent = `${Math.round(state.width)} × ${Math.round(state.height)}`;
      }

function updateZoom(value, fit = false) {
        state.zoom = clamp(value, .1, 2);
        canvas.style.width = `${Math.round(state.width * state.zoom)}px`;
        canvas.style.height = `${Math.round(state.height * state.zoom)}px`;
        $('#zoomSlider').value = Math.round(state.zoom * 100);
        $('#zoomValue').textContent = `${Math.round(state.zoom * 100)}%`;
        if (fit) stage.scrollTo({ left:0, top:0, behavior:'smooth' });
      }

function fitCanvas() {
        if (!state.layers.length) return;
        const pad = window.innerWidth <= 780 ? 46 : 100;
        const availableW = Math.max(100, stage.clientWidth - pad);
        const availableH = Math.max(100, stage.clientHeight - pad - (window.innerWidth <= 780 ? 60 : 0));
        updateZoom(Math.min(availableW / state.width, availableH / state.height, 1), true);
      }

function loadImage(src) {
        if (imageCache.has(src)) return imageCache.get(src);
        const promise = new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
        imageCache.set(src, promise);
        return promise;
      }

function layerCacheKey(layer) {
        const a = layer.adjustments || defaultImageAdjustments();
        const r = layer.backgroundRemoval || defaultBackgroundRemoval();
        return [layer.id, layer.w, layer.h, a.brightness, a.contrast, a.saturation, a.sharpness, a.filter, a.filterStrength, a.filterParam, r.enabled, r.color, r.tolerance, r.softness, r.despill].join('|');
      }
