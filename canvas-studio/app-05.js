'use strict';
async function updateExportPreview() {
        if (!state.layers.length) {
          exportPreviewCtx.clearRect(0,0,exportPreview.width,exportPreview.height);
          return;
        }
        const temp = document.createElement('canvas');
        temp.width = state.width;
        temp.height = state.height;
        await renderComposite(temp, false);
        exportPreviewCtx.clearRect(0,0,exportPreview.width,exportPreview.height);
        const scale = Math.min(exportPreview.width / temp.width, exportPreview.height / temp.height);
        const w = temp.width * scale, h = temp.height * scale;
        exportPreviewCtx.drawImage(temp, (exportPreview.width-w)/2, (exportPreview.height-h)/2, w, h);
      }

function setTool(tool) {
        state.activeTool = tool;
        $$('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
        if (tool === 'crop') {
          openPanel('cropresize');
          startCrop();
        } else if (tool === 'bgpick') {
          openPanel('background');
        } else if (tool === 'text') {
          openPanel('text');
        } else if (['rect','ellipse','line'].includes(tool)) {
          state.selectedShape = tool;
          syncShapeSegment();
          openPanel('shapes');
        }
        canvas.style.cursor = tool === 'select' ? 'move' : tool === 'text' ? 'text' : 'crosshair';
        requestRender();
      }

function openPanel(name) {
        $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
        $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.panelContent === name));
      }

function canvasPoint(ev) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: clamp((ev.clientX - rect.left) * (canvas.width / rect.width), 0, state.width),
          y: clamp((ev.clientY - rect.top) * (canvas.height / rect.height), 0, state.height)
        };
      }

function layerBounds(layer) {
        if (layer.type === 'text') {
          const measure = document.createElement('canvas').getContext('2d');
          measure.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? '700 ' : '400 '}${layer.fontSize}px ${layer.fontFamily}`;
          const lines = (layer.uppercase ? layer.text.toUpperCase() : layer.text).split('\n');
          const width = Math.max(...lines.map(line => measure.measureText(line).width), 10);
          const height = lines.length * layer.fontSize * 1.18;
          layer.w = width;
          layer.h = height;
        }
        return { x:Math.min(layer.x, layer.x+layer.w), y:Math.min(layer.y, layer.y+layer.h), w:Math.abs(layer.w), h:Math.abs(layer.h) };
      }

function hitTest(point) {
        for (let i = state.layers.length - 1; i >= 0; i--) {
          const layer = state.layers[i];
          if (!layer.visible) continue;
          const b = layerBounds(layer);
          if (point.x >= b.x && point.x <= b.x+b.w && point.y >= b.y && point.y <= b.y+b.h) return layer;
        }
        return null;
      }

function pointerDown(ev) {
        if (!state.layers.length) return;
        isPointerDown = true;
        pointerStart = canvasPoint(ev);
        canvas.setPointerCapture?.(ev.pointerId);
        if (state.activeTool === 'bgpick') {
          const layer = getActiveLayer();
          isPointerDown = false;
          if (!layer || layer.type !== 'image') return toast('Select an image layer first.', 'error');
          pickBackgroundAtPoint(layer, pointerStart);
        } else if (state.activeTool === 'select') {
          const hit = hitTest(pointerStart);
          if (hit) {
            state.activeLayerId = hit.id;
            originalLayerPosition = { x:hit.x, y:hit.y };
            refreshUI();
          } else {
            state.activeLayerId = null;
            originalLayerPosition = null;
            refreshUI();
          }
        } else if (state.activeTool === 'crop') {
          state.cropActive = true;
          state.cropRect = { x:pointerStart.x, y:pointerStart.y, w:1, h:1 };
          updateCropInputs();
        } else if (state.activeTool === 'text') {
          addTextLayer(pointerStart.x, pointerStart.y);
          isPointerDown = false;
        } else if (['rect','ellipse','line'].includes(state.activeTool)) {
          draftShape = makeShapeLayer(state.activeTool, pointerStart.x, pointerStart.y, 1, 1, true);
        }
        requestRender();
      }
