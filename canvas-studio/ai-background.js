'use strict';
(() => {
  const ORT_VERSION = '1.27.0';
  const ORT_SCRIPT = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.wasm.min.js`;
  const ORT_WASM_ROOT = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
  const MODEL_URL = 'https://huggingface.co/Heliosoph/u2net-onnx/resolve/main/u2netp.onnx';
  const MODEL_KEY = 'u2netp-apache-2.0-v1';
  const MODEL_DB = 'fieldkit-canvas-studio-models-v1';
  const MODEL_STORE = 'models';
  const INPUT_SIZE = 320;
  const MAX_MASK_EDGE = 2048;

  let sessionPromise = null;
  let brushCanvas = null;
  let brushCtx = null;
  let brushLayerId = null;
  let brushDrawing = false;
  let brushLast = null;
  let brushMode = 'erase';
  let brushSize = 42;

  const smoothstep = (a, b, x) => {
    if (a === b) return x >= b ? 1 : 0;
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function imageLayer() {
    const layer = getActiveLayer();
    return layer?.type === 'image' ? normalizeLayer(layer) : null;
  }

  function ensureRemoval(layer) {
    if (!layer) return null;
    const current = layer.backgroundRemoval || {};
    const defaults = defaultBackgroundRemoval();
    layer.backgroundRemoval = { ...defaults, ...current };
    return layer.backgroundRemoval;
  }

  function setStatus(message, percent = null, error = false) {
    const status = $('#aiBackgroundStatus');
    const bar = $('#aiBackgroundProgress');
    if (status) {
      status.textContent = message;
      status.classList.toggle('is-error', error);
    }
    if (bar) {
      bar.hidden = percent == null;
      if (percent != null) bar.value = clamp(percent, 0, 100);
    }
  }

  function loadScript(src) {
    if (window.ort) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-canvas-ai-runtime="${src}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.canvasAiRuntime = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load the local AI runtime.'));
      document.head.appendChild(script);
    });
  }

  function openModelDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return resolve(null);
      const request = indexedDB.open(MODEL_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(MODEL_STORE)) request.result.createObjectStore(MODEL_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function modelCacheGet(key) {
    try {
      const db = await openModelDb();
      if (!db) return null;
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(MODEL_STORE, 'readonly');
        const req = tx.objectStore(MODEL_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.warn('[Canvas Studio] AI model cache read failed:', error);
      return null;
    }
  }

  async function modelCachePut(key, buffer) {
    try {
      const db = await openModelDb();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(MODEL_STORE, 'readwrite');
        tx.objectStore(MODEL_STORE).put(buffer, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.warn('[Canvas Studio] AI model cache write failed:', error);
    }
  }

  async function fetchArrayBufferWithProgress(url) {
    const response = await fetch(url, { mode:'cors', credentials:'omit', cache:'force-cache' });
    if (!response.ok) throw new Error(`Model download failed (${response.status}).`);
    const total = Number(response.headers.get('content-length')) || 0;
    if (!response.body?.getReader) return response.arrayBuffer();
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      const percent = total ? Math.round(received / total * 100) : null;
      setStatus(percent == null ? `Downloading AI model… ${(received / 1048576).toFixed(1)} MB` : `Downloading AI model… ${percent}%`, percent);
    }
    const out = new Uint8Array(received);
    let offset = 0;
    chunks.forEach(chunk => { out.set(chunk, offset); offset += chunk.byteLength; });
    return out.buffer;
  }

  async function getSession() {
    if (sessionPromise) return sessionPromise;
    sessionPromise = (async () => {
      setStatus('Loading the on-device AI runtime…', 2);
      await loadScript(ORT_SCRIPT);
      if (!window.ort) throw new Error('The AI runtime did not initialize.');
      ort.env.wasm.wasmPaths = ORT_WASM_ROOT;
      ort.env.wasm.numThreads = 1;
      let model = await modelCacheGet(MODEL_KEY);
      if (model) setStatus('Loading cached AI model…', 86);
      else {
        model = await fetchArrayBufferWithProgress(MODEL_URL);
        await modelCachePut(MODEL_KEY, model);
      }
      setStatus('Starting the segmentation model…', 92);
      return ort.InferenceSession.create(model, {
        executionProviders:['wasm'],
        graphOptimizationLevel:'all'
      });
    })().catch(error => {
      sessionPromise = null;
      throw error;
    });
    return sessionPromise;
  }

  function preprocessImage(img) {
    const work = document.createElement('canvas');
    work.width = INPUT_SIZE;
    work.height = INPUT_SIZE;
    const wctx = work.getContext('2d', { willReadFrequently:true });
    wctx.drawImage(img, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const pixels = wctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    const plane = INPUT_SIZE * INPUT_SIZE;
    for (let i = 0; i < plane; i++) {
      const source = i * 4;
      tensor[i] = (pixels[source] / 255 - mean[0]) / std[0];
      tensor[plane + i] = (pixels[source + 1] / 255 - mean[1]) / std[1];
      tensor[plane * 2 + i] = (pixels[source + 2] / 255 - mean[2]) / std[2];
    }
    return tensor;
  }

  function rawMaskDataUrl(values) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < values.length; i++) {
      const value = Number(values[i]);
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const range = Math.max(1e-8, max - min);
    const mask = document.createElement('canvas');
    mask.width = INPUT_SIZE;
    mask.height = INPUT_SIZE;
    const mctx = mask.getContext('2d', { willReadFrequently:true });
    const imageData = mctx.createImageData(INPUT_SIZE, INPUT_SIZE);
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
      const value = clamp((Number(values[i]) - min) / range, 0, 1);
      const gray = Math.round(value * 255);
      const p = i * 4;
      imageData.data[p] = gray;
      imageData.data[p + 1] = gray;
      imageData.data[p + 2] = gray;
      imageData.data[p + 3] = 255;
    }
    mctx.putImageData(imageData, 0, 0);
    return mask.toDataURL('image/png');
  }

  function morphology(values, width, height, amount) {
    const count = Math.min(8, Math.abs(Math.round(amount)));
    if (!count) return values;
    let current = new Uint8ClampedArray(values);
    const dilate = amount > 0;
    for (let pass = 0; pass < count; pass++) {
      const next = new Uint8ClampedArray(current.length);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let chosen = dilate ? 0 : 255;
          for (let oy = -1; oy <= 1; oy++) {
            const yy = clamp(y + oy, 0, height - 1);
            for (let ox = -1; ox <= 1; ox++) {
              const xx = clamp(x + ox, 0, width - 1);
              const value = current[yy * width + xx];
              chosen = dilate ? Math.max(chosen, value) : Math.min(chosen, value);
            }
          }
          next[y * width + x] = chosen;
        }
      }
      current = next;
    }
    return current;
  }

  async function tunedMaskDataUrl(layer) {
    const removal = ensureRemoval(layer);
    if (!removal?.aiRawMask) throw new Error('Run AI removal first.');
    const raw = await loadImage(removal.aiRawMask);
    const small = document.createElement('canvas');
    small.width = INPUT_SIZE;
    small.height = INPUT_SIZE;
    const sctx = small.getContext('2d', { willReadFrequently:true });
    sctx.drawImage(raw, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const source = sctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const threshold = clamp(Number(removal.aiThreshold ?? 38), 0, 100) / 100;
    const feather = clamp(Number(removal.aiFeather ?? 10), 0, 40) / 100;
    const low = threshold - feather / 2;
    const high = threshold + feather / 2;
    let alpha = new Uint8ClampedArray(INPUT_SIZE * INPUT_SIZE);
    for (let i = 0; i < alpha.length; i++) alpha[i] = Math.round(smoothstep(low, high, source[i * 4] / 255) * 255);
    alpha = morphology(alpha, INPUT_SIZE, INPUT_SIZE, Number(removal.aiEdge ?? 1));

    const scale = Math.min(1, MAX_MASK_EDGE / Math.max(layer.w, layer.h));
    const width = Math.max(1, Math.round(layer.w * scale));
    const height = Math.max(1, Math.round(layer.h * scale));
    const alphaSmall = document.createElement('canvas');
    alphaSmall.width = INPUT_SIZE;
    alphaSmall.height = INPUT_SIZE;
    const actx = alphaSmall.getContext('2d');
    const alphaImage = actx.createImageData(INPUT_SIZE, INPUT_SIZE);
    for (let i = 0; i < alpha.length; i++) {
      const p = i * 4;
      alphaImage.data[p] = 255;
      alphaImage.data[p + 1] = 255;
      alphaImage.data[p + 2] = 255;
      alphaImage.data[p + 3] = alpha[i];
    }
    actx.putImageData(alphaImage, 0, 0);

    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const octx = output.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(alphaSmall, 0, 0, width, height);
    return output.toDataURL('image/png');
  }

  async function runAiRemoval() {
    const layer = imageLayer();
    if (!layer) return toast('Select an image layer first.', 'error');
    const button = $('#aiRemoveBackgroundBtn');
    button.disabled = true;
    try {
      setStatus('Preparing image…', 1);
      const [session, img] = await Promise.all([getSession(), loadImage(layer.src)]);
      setStatus('Finding the foreground subject…', 95);
      await new Promise(resolve => requestAnimationFrame(resolve));
      const input = preprocessImage(img);
      const tensor = new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]);
      const feeds = { [session.inputNames[0]]: tensor };
      const results = await session.run(feeds);
      const output = results[session.outputNames[0]];
      if (!output?.data) throw new Error('The model returned no segmentation mask.');
      const removal = ensureRemoval(layer);
      removal.aiRawMask = rawMaskDataUrl(output.data);
      removal.mode = 'ai';
      removal.enabled = true;
      removal.aiMask = await tunedMaskDataUrl(layer);
      removal.aiRevision = (Number(removal.aiRevision) || 0) + 1;
      processedCache.clear();
      pushHistory('AI background removal');
      refreshUI();
      requestRender();
      setStatus('AI cutout ready. Refine the mask below.', 100);
      setTimeout(() => { const bar = $('#aiBackgroundProgress'); if (bar) bar.hidden = true; }, 900);
      toast('AI background removal complete.', 'success');
    } catch (error) {
      console.error('[Canvas Studio] AI background removal failed:', error);
      setStatus(error.message || 'AI background removal failed.', null, true);
      toast('AI removal failed. Check your connection for the first model download.', 'error');
    } finally {
      button.disabled = false;
      syncAiControls();
    }
  }

  async function applyAiSettings(push = true) {
    const layer = imageLayer();
    const removal = ensureRemoval(layer);
    if (!layer || !removal?.aiRawMask) return;
    removal.aiMask = await tunedMaskDataUrl(layer);
    removal.mode = 'ai';
    removal.enabled = true;
    removal.aiRevision = (Number(removal.aiRevision) || 0) + 1;
    processedCache.clear();
    if (push) pushHistory('Refine AI mask');
    requestRender();
  }

  function resetAiRemoval() {
    const layer = imageLayer();
    if (!layer) return;
    const removal = ensureRemoval(layer);
    removal.aiMask = null;
    removal.aiRawMask = null;
    removal.aiRevision = (Number(removal.aiRevision) || 0) + 1;
    removal.mode = 'none';
    removal.enabled = false;
    processedCache.clear();
    pushHistory('Restore original background');
    refreshUI();
    requestRender();
    setTool('select');
    setStatus('Original image restored.');
  }

  async function prepareBrush(mode) {
    const layer = imageLayer();
    const removal = ensureRemoval(layer);
    if (!layer || !removal?.aiMask) return toast('Run AI removal before refining the mask.', 'error');
    const img = await loadImage(removal.aiMask);
    brushCanvas = document.createElement('canvas');
    brushCanvas.width = img.naturalWidth || img.width;
    brushCanvas.height = img.naturalHeight || img.height;
    brushCtx = brushCanvas.getContext('2d');
    brushCtx.drawImage(img, 0, 0);
    brushLayerId = layer.id;
    brushMode = mode;
    state.activeTool = mode === 'erase' ? 'mask-erase' : 'mask-restore';
    $$('.tool[data-tool]').forEach(button => button.classList.remove('active'));
    $('#aiEraseBrushBtn')?.classList.toggle('active', mode === 'erase');
    $('#aiRestoreBrushBtn')?.classList.toggle('active', mode === 'restore');
    canvas.style.cursor = 'crosshair';
    setStatus(`${mode === 'erase' ? 'Erase' : 'Restore'} brush active. Paint on the image, then release to apply.`);
  }

  function layerLocalPoint(layer, point) {
    const cx = layer.x + layer.w / 2;
    const cy = layer.y + layer.h / 2;
    const angle = -(Number(layer.rotation) || 0) * Math.PI / 180;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const x = dx * Math.cos(angle) - dy * Math.sin(angle) + layer.w / 2;
    const y = dx * Math.sin(angle) + dy * Math.cos(angle) + layer.h / 2;
    if (x < 0 || y < 0 || x > layer.w || y > layer.h) return null;
    return { x, y };
  }

  function brushPoint(point) {
    const layer = imageLayer();
    if (!layer || layer.id !== brushLayerId || !brushCanvas) return null;
    const local = layerLocalPoint(layer, point);
    if (!local) return null;
    return {
      x: local.x / layer.w * brushCanvas.width,
      y: local.y / layer.h * brushCanvas.height,
      width: brushSize / Math.max(1, layer.w) * brushCanvas.width
    };
  }

  function drawBrushSegment(from, to) {
    if (!brushCtx || !to) return;
    brushCtx.save();
    brushCtx.globalCompositeOperation = brushMode === 'erase' ? 'destination-out' : 'source-over';
    brushCtx.strokeStyle = '#ffffff';
    brushCtx.fillStyle = '#ffffff';
    brushCtx.lineCap = 'round';
    brushCtx.lineJoin = 'round';
    brushCtx.lineWidth = Math.max(2, to.width);
    brushCtx.beginPath();
    if (from) brushCtx.moveTo(from.x, from.y);
    else brushCtx.moveTo(to.x, to.y);
    brushCtx.lineTo(to.x, to.y);
    brushCtx.stroke();
    brushCtx.beginPath();
    brushCtx.arc(to.x, to.y, Math.max(1, to.width / 2), 0, Math.PI * 2);
    brushCtx.fill();
    brushCtx.restore();
  }

  function isBrushTool() {
    return state.activeTool === 'mask-erase' || state.activeTool === 'mask-restore';
  }

  function maskPointerDown(event) {
    if (!isBrushTool()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = brushPoint(canvasPoint(event));
    if (!point) return;
    brushDrawing = true;
    brushLast = point;
    drawBrushSegment(null, point);
    canvas.setPointerCapture?.(event.pointerId);
  }

  function maskPointerMove(event) {
    if (!isBrushTool() || !brushDrawing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = brushPoint(canvasPoint(event));
    if (!point) return;
    drawBrushSegment(brushLast, point);
    brushLast = point;
  }

  function maskPointerUp(event) {
    if (!isBrushTool() || !brushDrawing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    brushDrawing = false;
    brushLast = null;
    const layer = imageLayer();
    if (!layer || layer.id !== brushLayerId || !brushCanvas) return;
    const removal = ensureRemoval(layer);
    removal.aiMask = brushCanvas.toDataURL('image/png');
    removal.aiRevision = (Number(removal.aiRevision) || 0) + 1;
    processedCache.clear();
    pushHistory(brushMode === 'erase' ? 'Erase AI mask' : 'Restore AI mask');
    requestRender();
    setStatus('Mask brush applied. Continue painting or choose Done.');
  }

  function finishBrush() {
    brushCanvas = null;
    brushCtx = null;
    brushLayerId = null;
    brushDrawing = false;
    brushLast = null;
    $('#aiEraseBrushBtn')?.classList.remove('active');
    $('#aiRestoreBrushBtn')?.classList.remove('active');
    setTool('select');
    setStatus('AI cutout ready.');
  }

  function syncAiControls() {
    const layer = imageLayer();
    const removal = layer ? ensureRemoval(layer) : defaultBackgroundRemoval();
    const hasMask = !!(layer && removal.aiMask);
    ['aiRemoveBackgroundBtn','aiResetBackgroundBtn','aiThreshold','aiFeather','aiEdge','aiEraseBrushBtn','aiRestoreBrushBtn','aiDoneBrushBtn','aiBrushSize'].forEach(id => {
      const node = $('#'+id);
      if (node) node.disabled = !layer || (id !== 'aiRemoveBackgroundBtn' && !hasMask);
    });
    if ($('#aiThreshold')) {
      $('#aiThreshold').value = removal.aiThreshold ?? 38;
      $('#aiThresholdValue').textContent = `${removal.aiThreshold ?? 38}%`;
      $('#aiFeather').value = removal.aiFeather ?? 10;
      $('#aiFeatherValue').textContent = `${removal.aiFeather ?? 10}%`;
      $('#aiEdge').value = removal.aiEdge ?? 1;
      $('#aiEdgeValue').textContent = `${Number(removal.aiEdge ?? 1) > 0 ? '+' : ''}${removal.aiEdge ?? 1}`;
      $('#aiBrushSize').value = brushSize;
      $('#aiBrushSizeValue').textContent = `${brushSize} px`;
    }
    $('#aiRefineControls')?.classList.toggle('hidden', !hasMask);
    if ($('#aiModeBadge')) $('#aiModeBadge').textContent = hasMask && removal.mode === 'ai' ? 'AI mask active' : 'Local AI';
    if ($('#backgroundEnabled')) $('#backgroundEnabled').checked = !!(layer && removal.enabled && removal.mode === 'color');
  }

  function bindAiEvents() {
    $('#aiRemoveBackgroundBtn').addEventListener('click', runAiRemoval);
    $('#aiResetBackgroundBtn').addEventListener('click', resetAiRemoval);
    [['aiThreshold','aiThresholdValue','aiThreshold'],['aiFeather','aiFeatherValue','aiFeather'],['aiEdge','aiEdgeValue','aiEdge']].forEach(([id,valueId,key]) => {
      $('#'+id).addEventListener('input', event => {
        const layer = imageLayer();
        if (!layer) return;
        const removal = ensureRemoval(layer);
        removal[key] = Number(event.target.value);
        $('#'+valueId).textContent = key === 'aiEdge' ? `${removal[key] > 0 ? '+' : ''}${removal[key]}` : `${removal[key]}%`;
      });
      $('#'+id).addEventListener('change', () => applyAiSettings(true));
    });
    $('#aiEraseBrushBtn').addEventListener('click', () => prepareBrush('erase'));
    $('#aiRestoreBrushBtn').addEventListener('click', () => prepareBrush('restore'));
    $('#aiDoneBrushBtn').addEventListener('click', finishBrush);
    $('#aiBrushSize').addEventListener('input', event => {
      brushSize = Number(event.target.value);
      $('#aiBrushSizeValue').textContent = `${brushSize} px`;
    });

    $('#backgroundEnabled').addEventListener('change', event => {
      const layer = imageLayer();
      if (!layer) return;
      const removal = ensureRemoval(layer);
      removal.mode = event.target.checked ? 'color' : (removal.mode === 'color' ? 'none' : removal.mode);
      processedCache.clear();
      requestRender();
    }, true);
    ['backgroundColor','backgroundPreset','backgroundTolerance','backgroundSoftness','backgroundDespill','autoBackgroundBtn','pickBackgroundBtn'].forEach(id => {
      $('#'+id)?.addEventListener('input', () => {
        const layer = imageLayer();
        if (!layer) return;
        const removal = ensureRemoval(layer);
        removal.mode = 'color';
        removal.enabled = true;
      }, true);
      $('#'+id)?.addEventListener('click', () => {
        const layer = imageLayer();
        if (!layer) return;
        const removal = ensureRemoval(layer);
        removal.mode = 'color';
        removal.enabled = true;
      }, true);
    });

    canvas.addEventListener('pointerdown', maskPointerDown, true);
    canvas.addEventListener('pointermove', maskPointerMove, true);
    canvas.addEventListener('pointerup', maskPointerUp, true);
    canvas.addEventListener('pointercancel', maskPointerUp, true);
  }

  function injectUi() {
    const panel = document.querySelector('[data-panel-content="background"]');
    const colorSection = panel?.querySelector('.section');
    if (!panel || !colorSection || $('#aiRemoveBackgroundBtn')) return;
    colorSection.querySelector('.section-title h3').textContent = 'Color key';
    const colorBadge = colorSection.querySelector('.section-title span');
    if (colorBadge) colorBadge.textContent = 'Flat backgrounds only';
    const hint = colorSection.querySelector('#backgroundHint');
    if (hint) hint.textContent = 'Use this only for a solid studio, green-screen, blue-screen, black, or white background.';
    const enableLabel = colorSection.querySelector('label.inline');
    if (enableLabel?.lastChild) enableLabel.lastChild.textContent = ' Enable color-key removal';

    const aiSection = document.createElement('div');
    aiSection.className = 'section ai-background-section';
    aiSection.innerHTML = `
      <div class="section-title"><h3>AI cutout</h3><span id="aiModeBadge">Local AI</span></div>
      <p class="help">Use this for textured walls, rooms, products, people, signs, and other complex backgrounds.</p>
      <div class="inline ai-action-row">
        <button class="btn primary" id="aiRemoveBackgroundBtn">✨ Remove with AI</button>
        <button class="btn" id="aiResetBackgroundBtn">Restore original</button>
      </div>
      <progress id="aiBackgroundProgress" max="100" value="0" hidden></progress>
      <p class="help ai-status" id="aiBackgroundStatus" role="status">First use downloads an Apache-licensed 5 MB model plus the browser AI runtime. Processing remains on this device, and the model is cached for later offline use.</p>
      <div id="aiRefineControls" class="hidden">
        <div class="control">
          <div class="control-head"><label>Subject threshold</label><span class="value" id="aiThresholdValue">38%</span></div>
          <input id="aiThreshold" type="range" min="5" max="90" value="38" />
        </div>
        <div class="control">
          <div class="control-head"><label>Edge feather</label><span class="value" id="aiFeatherValue">10%</span></div>
          <input id="aiFeather" type="range" min="0" max="40" value="10" />
        </div>
        <div class="control">
          <div class="control-head"><label>Expand / contract edge</label><span class="value" id="aiEdgeValue">+1</span></div>
          <input id="aiEdge" type="range" min="-8" max="8" value="1" />
        </div>
        <div class="section-title ai-refine-title"><h3>Manual cleanup</h3><span>Non-destructive mask</span></div>
        <div class="control">
          <div class="control-head"><label>Brush size</label><span class="value" id="aiBrushSizeValue">42 px</span></div>
          <input id="aiBrushSize" type="range" min="4" max="240" value="42" />
        </div>
        <div class="inline ai-action-row">
          <button class="btn small" id="aiEraseBrushBtn">Erase background</button>
          <button class="btn small" id="aiRestoreBrushBtn">Restore subject</button>
          <button class="btn small" id="aiDoneBrushBtn">Done</button>
        </div>
        <p class="help">Erase removes missed background. Restore brings back parts of the subject that AI removed.</p>
      </div>`;
    panel.insertBefore(aiSection, colorSection);

    const style = document.createElement('style');
    style.textContent = `
      .ai-background-section{border-bottom:1px solid rgba(255,255,255,.09)}
      .ai-action-row{gap:8px;flex-wrap:wrap;margin:12px 0}
      #aiBackgroundProgress{width:100%;height:8px;margin:4px 0 8px;accent-color:#7c5cff}
      .ai-status.is-error{color:#ff8b98}
      .ai-refine-title{margin-top:18px}
      #aiRefineControls.hidden{display:none}
      #aiEraseBrushBtn.active,#aiRestoreBrushBtn.active{border-color:#8b70ff;background:rgba(124,92,255,.2)}
    `;
    document.head.appendChild(style);
  }

  function install() {
    injectUi();
    bindAiEvents();
    const previousSync = window.syncBackgroundControls;
    window.syncBackgroundControls = function syncBackgroundControlsWithAi() {
      previousSync?.();
      syncAiControls();
    };
    syncAiControls();
  }

  install();
})();
