'use strict';
function syncBackgroundControls() {
        const layer = getActiveLayer();
        const image = layer?.type === 'image' ? normalizeLayer(layer) : null;
        const ids = ['backgroundEnabled','backgroundColor','backgroundPreset','autoBackgroundBtn','pickBackgroundBtn','resetBackgroundBtn','backgroundTolerance','backgroundSoftness','backgroundDespill'];
        ids.forEach(id => $('#'+id).disabled = !image);
        $('#backgroundHint').textContent = image ? `Editing “${image.name}”` : 'Select an image layer. Best results come from solid or evenly lit backgrounds.';
        const r = image?.backgroundRemoval || defaultBackgroundRemoval();
        $('#backgroundEnabled').checked = !!r.enabled;
        $('#backgroundColor').value = r.color;
        $('#backgroundTolerance').value = r.tolerance;
        $('#backgroundToleranceValue').textContent = `${r.tolerance}%`;
        $('#backgroundSoftness').value = r.softness;
        $('#backgroundSoftnessValue').textContent = `${r.softness}%`;
        $('#backgroundDespill').value = r.despill;
        $('#backgroundDespillValue').textContent = `${r.despill}%`;
      }

function syncEffectsControls() {
        const layer = normalizeLayer(getActiveLayer());
        const ids = ['shadowEnabled','shadowColor','shadowOpacity','shadowBlur','shadowOffsetX','shadowOffsetY','glowEnabled','glowColor','glowOpacity','glowBlur','resetEffectsBtn'];
        ids.forEach(id => $('#'+id).disabled = !layer);
        $('#effectsHint').textContent = layer ? `Editing “${layer.name}”` : 'Select a layer to add non-destructive shadow and glow.';
        const e = layer?.effects || defaultLayerEffects();
        $('#shadowEnabled').checked = !!e.shadow.enabled;
        $('#shadowColor').value = e.shadow.color;
        $('#shadowOpacity').value = e.shadow.opacity; $('#shadowOpacityValue').textContent = `${e.shadow.opacity}%`;
        $('#shadowBlur').value = e.shadow.blur; $('#shadowBlurValue').textContent = `${e.shadow.blur} px`;
        $('#shadowOffsetX').value = e.shadow.offsetX; $('#shadowOffsetXValue').textContent = `${e.shadow.offsetX} px`;
        $('#shadowOffsetY').value = e.shadow.offsetY; $('#shadowOffsetYValue').textContent = `${e.shadow.offsetY} px`;
        $('#glowEnabled').checked = !!e.glow.enabled;
        $('#glowColor').value = e.glow.color;
        $('#glowOpacity').value = e.glow.opacity; $('#glowOpacityValue').textContent = `${e.glow.opacity}%`;
        $('#glowBlur').value = e.glow.blur; $('#glowBlurValue').textContent = `${e.glow.blur} px`;
      }

function refreshUI() {
        refreshLayerList();
        syncLayerProperties();
        syncAdjustmentControls();
        syncBackgroundControls();
        syncEffectsControls();
        syncTextControls();
        syncCanvasSize();
        updateHistoryButtons();
      }

function buildFilterGrid() {
        const grid = $('#filterGrid');
        filters.forEach(filter => {
          const card = document.createElement('button');
          card.className = 'filter-card';
          card.dataset.filter = filter.id;
          card.innerHTML = `<canvas width="120" height="90"></canvas><span>${filter.name}</span>`;
          card.addEventListener('click', () => {
            const layer = getActiveLayer();
            if (!layer || layer.type !== 'image') return toast('Select an image layer first.', 'error');
            layer.adjustments.filter = filter.id;
            processedCache.clear();
            pushHistory(`Filter: ${filter.name}`);
            syncAdjustmentControls();
            requestRender();
          });
          grid.appendChild(card);
        });
      }

async function updateFilterPreviews() {
        const layer = state.layers.find(l => l.type === 'image');
        if (!layer) return;
        const img = await loadImage(layer.src);
        $$('.filter-card').forEach(card => {
          const filter = filters.find(f => f.id === card.dataset.filter);
          const c = $('canvas', card);
          const cctx = c.getContext('2d');
          cctx.clearRect(0,0,c.width,c.height);
          const scale = Math.max(c.width/img.naturalWidth, c.height/img.naturalHeight);
          const w=img.naturalWidth*scale, h=img.naturalHeight*scale;
          cctx.save(); cctx.filter = filter.preview; cctx.drawImage(img,(c.width-w)/2,(c.height-h)/2,w,h); cctx.restore();
        });
      }

function syncTextStyleSegment() {
        $$('#textStyleSegment button').forEach(b => b.classList.toggle('active', !!state.textStyle[b.dataset.style]));
      }

function syncShapeSegment() {
        $$('#shapeTypeSegment button').forEach(b => b.classList.toggle('active', b.dataset.shape === state.selectedShape));
      }
