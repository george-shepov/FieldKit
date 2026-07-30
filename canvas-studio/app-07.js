'use strict';
function updateSelectedText() {
        const layer = getActiveLayer();
        if (!layer || layer.type !== 'text') return toast('Select a text layer first.', 'error');
        layer.text = $('#textContent').value || 'Text';
        layer.fontFamily = $('#fontFamily').value;
        layer.fontSize = parseInt($('#fontSize').value) || 72;
        layer.align = $('#textAlign').value;
        layer.bold = state.textStyle.bold;
        layer.italic = state.textStyle.italic;
        layer.uppercase = state.textStyle.uppercase;
        layer.fill = $('#textColor').value;
        layer.stroke = $('#textStroke').value;
        layer.strokeWidth = parseInt($('#textStrokeWidth').value);
        layerBounds(layer);
        pushHistory('Update text');
        refreshUI();
        requestRender();
      }

async function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

async function importImage(file, asLayer = false) {
        if (!file || !file.type.startsWith('image/')) return toast('Please choose a valid image file.', 'error');
        try {
          const src = await fileToDataURL(file);
          const img = await loadImage(src);
          if (!asLayer || !state.layers.length) {
            state.width = img.naturalWidth;
            state.height = img.naturalHeight;
            state.layers = [];
            history.length = 0;
            historyIndex = -1;
            state.documentName = (file.name || 'image').replace(/\.[^.]+$/, '');
            $('#exportFilename').value = `${state.documentName}-edited`;
          }
          const maxFit = asLayer && state.layers.length ? Math.min(state.width / img.naturalWidth, state.height / img.naturalHeight, 1) : 1;
          const w = img.naturalWidth * maxFit;
          const h = img.naturalHeight * maxFit;
          const layer = {
            id:uid(), type:'image', name:file.name || `Image ${state.layers.length+1}`, src,
            x:(state.width-w)/2, y:(state.height-h)/2, w, h, rotation:0,
            opacity:1, blendMode:'source-over', visible:true,
            adjustments:defaultImageAdjustments(),
            backgroundRemoval:defaultBackgroundRemoval(),
            effects:defaultLayerEffects()
          };
          state.layers.push(layer);
          state.activeLayerId = layer.id;
          state.cropRect = null;
          state.cropActive = false;
          processedCache.clear();
          syncCanvasSize();
          emptyState.classList.add('hidden');
          canvasFrame.classList.remove('hidden');
          pushHistory(asLayer ? 'Add image layer' : 'Open image');
          refreshUI();
          requestRender();
          setTimeout(fitCanvas, 40);
          if (img.naturalWidth * img.naturalHeight > 14_000_000) toast('Large image loaded. Some live effects may update more slowly.');
        } catch (err) {
          console.error(err);
          toast('The image could not be opened.', 'error');
        }
      }

function startCrop() {
        if (!state.layers.length) return;
        state.cropActive = true;
        const ratio = parseFloat($('#cropRatio').value);
        let w = state.width * .8;
        let h = state.height * .8;
        if (Number.isFinite(ratio)) {
          if (w / h > ratio) w = h * ratio; else h = w / ratio;
        }
        state.cropRect = { x:(state.width-w)/2, y:(state.height-h)/2, w, h };
        $('#applyCropBtn').disabled = false;
        $('#cancelCropBtn').disabled = false;
        $('#cropStatus').textContent = 'Active';
        updateCropInputs();
        if (state.activeTool !== 'crop') {
          state.activeTool = 'crop';
          $$('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === 'crop'));
        }
        canvas.style.cursor = 'crosshair';
        requestRender();
      }

function updateCropInputs() {
        if (!state.cropRect) return;
        $('#cropW').value = Math.round(state.cropRect.w);
        $('#cropH').value = Math.round(state.cropRect.h);
      }

function cancelCrop() {
        state.cropRect = null;
        state.cropActive = false;
        $('#applyCropBtn').disabled = true;
        $('#cancelCropBtn').disabled = true;
        $('#cropStatus').textContent = 'Not active';
        setTool('select');
      }

function applyCrop() {
        const r = state.cropRect;
        if (!r || r.w < 2 || r.h < 2) return;
        state.layers.forEach(layer => { layer.x -= r.x; layer.y -= r.y; });
        state.width = Math.round(r.w);
        state.height = Math.round(r.h);
        state.cropRect = null;
        state.cropActive = false;
        processedCache.clear();
        syncCanvasSize();
        pushHistory('Crop document');
        refreshUI();
        setTool('select');
        fitCanvas();
      }
