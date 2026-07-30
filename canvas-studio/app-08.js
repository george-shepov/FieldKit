'use strict';
function applyResize() {
        if (!state.layers.length) return;
        const newW = Math.max(1, parseInt($('#resizeW').value));
        const newH = Math.max(1, parseInt($('#resizeH').value));
        if (!newW || !newH) return;
        const sx = newW / state.width;
        const sy = newH / state.height;
        state.layers.forEach(layer => {
          layer.x *= sx; layer.y *= sy; layer.w *= sx; layer.h *= sy;
          if (layer.type === 'text') layer.fontSize *= Math.min(sx, sy);
          if (layer.type === 'shape') layer.strokeWidth *= Math.min(sx, sy);
        });
        state.width = newW;
        state.height = newH;
        processedCache.clear();
        syncCanvasSize();
        pushHistory('Resize document');
        refreshUI();
        requestRender();
        fitCanvas();
      }

function deleteActiveLayer() {
        const i = state.layers.findIndex(l => l.id === state.activeLayerId);
        if (i < 0) return;
        state.layers.splice(i, 1);
        state.activeLayerId = state.layers[Math.min(i, state.layers.length-1)]?.id || null;
        pushHistory('Delete layer');
        refreshUI();
        requestRender();
        if (!state.layers.length) {
          emptyState.classList.remove('hidden');
          canvasFrame.classList.add('hidden');
          $('#docBadge').textContent = 'No document';
        }
      }

function duplicateActiveLayer() {
        const layer = getActiveLayer();
        if (!layer) return;
        const copy = deepClone(layer);
        copy.id = uid(); copy.name = `${layer.name} copy`; copy.x += 20; copy.y += 20;
        state.layers.push(copy); state.activeLayerId = copy.id;
        pushHistory('Duplicate layer'); refreshUI(); requestRender();
      }

function moveLayer(direction) {
        const i = state.layers.findIndex(l => l.id === state.activeLayerId);
        const ni = i + direction;
        if (i < 0 || ni < 0 || ni >= state.layers.length) return;
        [state.layers[i], state.layers[ni]] = [state.layers[ni], state.layers[i]];
        pushHistory('Reorder layers'); refreshUI(); requestRender();
      }

function refreshLayerList() {
        const list = $('#layerList');
        list.innerHTML = '';
        [...state.layers].reverse().forEach(layer => {
          const item = document.createElement('div');
          item.className = `layer-item ${layer.id === state.activeLayerId ? 'active' : ''}`;
          const thumb = layer.type === 'image' ? `<img src="${layer.src}" alt="" />` : layer.type === 'text' ? 'T' : layer.shapeType === 'rect' ? '▭' : layer.shapeType === 'ellipse' ? '◯' : '╱';
          item.innerHTML = `
            <button class="icon-plain visibility" title="Toggle visibility">${layer.visible ? '◉' : '○'}</button>
            <div class="layer-thumb">${thumb}</div>
            <div class="layer-meta"><strong>${escapeHtml(layer.name)}</strong><span>${layer.type}${layer.type==='shape' ? ` · ${layer.shapeType}` : ''}</span></div>
            <button class="icon-plain remove" title="Delete layer">×</button>`;
          item.addEventListener('click', () => { state.activeLayerId = layer.id; refreshUI(); requestRender(); });
          $('.visibility', item).addEventListener('click', e => { e.stopPropagation(); layer.visible = !layer.visible; pushHistory('Toggle layer'); refreshUI(); requestRender(); });
          $('.remove', item).addEventListener('click', e => { e.stopPropagation(); state.activeLayerId = layer.id; deleteActiveLayer(); });
          list.appendChild(item);
        });
        $('#layerCount').textContent = `${state.layers.length} layer${state.layers.length===1?'':'s'}`;
      }

function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
      }

function syncLayerProperties() {
        const layer = getActiveLayer();
        const disabled = !layer;
        ['layerX','layerY','layerW','layerH','layerName','layerOpacity','blendMode'].forEach(id => $('#'+id).disabled = disabled);
        if (!layer) {
          $('#activeLayerType').textContent = 'None';
          $('#layerX').value = $('#layerY').value = $('#layerW').value = $('#layerH').value = '';
          $('#layerName').value = '';
          return;
        }
        layerBounds(layer);
        $('#layerX').value = Math.round(layer.x);
        $('#layerY').value = Math.round(layer.y);
        $('#layerW').value = Math.round(layer.w);
        $('#layerH').value = Math.round(layer.h);
        $('#layerName').value = layer.name;
        $('#layerOpacity').value = Math.round(layer.opacity * 100);
        $('#layerOpacityValue').textContent = `${Math.round(layer.opacity * 100)}%`;
        $('#blendMode').value = layer.blendMode;
        $('#activeLayerType').textContent = layer.type;
      }
