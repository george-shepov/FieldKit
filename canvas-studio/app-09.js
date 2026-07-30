'use strict';
function syncAdjustmentControls() {
        const layer = getActiveLayer();
        const imageLayer = layer?.type === 'image' ? layer : null;
        $('#adjustmentControls').style.opacity = imageLayer ? '1' : '.4';
        $$('input', $('#adjustmentControls')).forEach(i => i.disabled = !imageLayer);
        $('#resetAdjustmentsBtn').disabled = !imageLayer;
        $('#adjustmentHint').textContent = imageLayer ? `Editing “${imageLayer.name}”` : 'Select an image layer to adjust it.';
        const a = imageLayer?.adjustments || defaultImageAdjustments();
        ['brightness','contrast','saturation','sharpness'].forEach(key => {
          $(`#${key}Range`).value = a[key];
          $(`#${key}Value`).textContent = a[key];
        });
        $('#filterStrength').disabled = !imageLayer;
        $('#filterParam').disabled = !imageLayer;
        $$('.filter-card').forEach(card => card.classList.toggle('active', card.dataset.filter === a.filter));
        $('#filterStrength').value = a.filterStrength;
        $('#filterStrengthValue').textContent = `${a.filterStrength}%`;
        $('#filterParam').value = a.filterParam;
        $('#filterParamValue').textContent = `${a.filterParam}%`;
        $('#filterDescription').textContent = filters.find(f => f.id === a.filter)?.description || filters[0].description;
      }

function syncTextControls() {
        const layer = getActiveLayer();
        if (!layer || layer.type !== 'text') return;
        $('#textContent').value = layer.text;
        $('#fontFamily').value = layer.fontFamily;
        $('#fontSize').value = Math.round(layer.fontSize);
        $('#textAlign').value = layer.align;
        $('#textColor').value = layer.fill;
        $('#textStroke').value = layer.stroke;
        $('#textStrokeWidth').value = layer.strokeWidth;
        $('#textStrokeWidthValue').textContent = `${layer.strokeWidth} px`;
        state.textStyle = { bold:layer.bold, italic:layer.italic, uppercase:layer.uppercase };
        syncTextStyleSegment();
      }

async function autoDetectBackground(layer) {
        if (!layer || layer.type !== 'image') return toast('Select an image layer first.', 'error');
        const img = await loadImage(layer.src);
        const sample = document.createElement('canvas');
        sample.width = 64; sample.height = 64;
        const sctx = sample.getContext('2d', { willReadFrequently:true });
        sctx.drawImage(img, 0, 0, 64, 64);
        const data = sctx.getImageData(0,0,64,64).data;
        const points = [];
        for (const [x0,y0] of [[0,0],[56,0],[0,56],[56,56]]) {
          for (let y=y0;y<y0+8;y++) for (let x=x0;x<x0+8;x++) {
            const i=(y*64+x)*4;
            if (data[i+3] > 20) points.push([data[i],data[i+1],data[i+2]]);
          }
        }
        if (!points.length) return toast('No opaque corner color was found.', 'error');
        const avg = [0,1,2].map(ch => points.reduce((sum,p)=>sum+p[ch],0)/points.length);
        normalizeLayer(layer);
        layer.backgroundRemoval.color = hexFromRgb(...avg);
        layer.backgroundRemoval.enabled = true;
        processedCache.clear();
        pushHistory('Auto background color');
        refreshUI(); requestRender();
        toast('Background color sampled from the image corners.', 'success');
      }

async function pickBackgroundAtPoint(layer, point) {
        normalizeLayer(layer);
        const cx = layer.x + layer.w/2, cy = layer.y + layer.h/2;
        const angle = -(layer.rotation || 0) * Math.PI / 180;
        const dx = point.x - cx, dy = point.y - cy;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + layer.w/2;
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle) + layer.h/2;
        if (localX < 0 || localY < 0 || localX > layer.w || localY > layer.h) return toast('Click inside the selected image layer.', 'error');
        const img = await loadImage(layer.src);
        const sx = clamp(Math.floor(localX / layer.w * img.naturalWidth), 0, img.naturalWidth-1);
        const sy = clamp(Math.floor(localY / layer.h * img.naturalHeight), 0, img.naturalHeight-1);
        const sample = document.createElement('canvas'); sample.width=1; sample.height=1;
        const sctx = sample.getContext('2d', { willReadFrequently:true });
        sctx.drawImage(img, sx, sy, 1, 1, 0, 0, 1, 1);
        const pixel = sctx.getImageData(0,0,1,1).data;
        layer.backgroundRemoval.color = hexFromRgb(pixel[0],pixel[1],pixel[2]);
        layer.backgroundRemoval.enabled = true;
        processedCache.clear();
        pushHistory('Pick background color');
        refreshUI(); requestRender(); setTool('select'); openPanel('background');
        toast('Background color selected.', 'success');
      }
