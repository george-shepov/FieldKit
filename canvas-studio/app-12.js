'use strict';
function initEvents() {
        $('#openBtn').addEventListener('click', () => openFile(false));
        $('#emptyOpenBtn').addEventListener('click', () => openFile(false));
        $('#addImageLayerBtn').addEventListener('click', () => openFile(true));
        fileInput.addEventListener('change', () => {
          const file = fileInput.files?.[0];
          importImage(file, fileInput.dataset.asLayer === 'true');
          fileInput.value = '';
        });

        ['dragenter','dragover'].forEach(type => stage.addEventListener(type, e => { e.preventDefault(); canvasFrame.classList.add('dragover'); }));
        ['dragleave','drop'].forEach(type => stage.addEventListener(type, e => { e.preventDefault(); canvasFrame.classList.remove('dragover'); }));
        stage.addEventListener('drop', e => importImage(e.dataTransfer.files?.[0], state.layers.length > 0));

        $$('.tool[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
        $$('.tab').forEach(b => b.addEventListener('click', () => { openPanel(b.dataset.panel); if (window.innerWidth <= 780) sidebar.classList.add('open'); }));
        $('#mobilePanelBtn').addEventListener('click', () => sidebar.classList.toggle('open'));
        $('#stageWrap').addEventListener('click', e => { if (window.innerWidth <= 780 && !sidebar.contains(e.target) && !$('#mobilePanelBtn').contains(e.target)) sidebar.classList.remove('open'); });

        canvas.addEventListener('pointerdown', pointerDown);
        canvas.addEventListener('pointermove', pointerMove);
        canvas.addEventListener('pointerup', pointerUp);
        canvas.addEventListener('pointercancel', pointerUp);
        canvas.addEventListener('pointerleave', () => { if (!isPointerDown) $('#cursorInfo').textContent = 'Ready'; });

        $('#undoBtn').addEventListener('click', undo);
        $('#redoBtn').addEventListener('click', redo);
        $('#resetViewBtn').addEventListener('click', fitCanvas);
        $('#zoomSlider').addEventListener('input', e => updateZoom(parseInt(e.target.value)/100));
        $('#zoomInBtn').addEventListener('click', () => updateZoom(state.zoom + .1));
        $('#zoomOutBtn').addEventListener('click', () => updateZoom(state.zoom - .1));

        ['brightness','contrast','saturation','sharpness'].forEach(key => {
          const input = $(`#${key}Range`);
          input.addEventListener('input', () => {
            const layer = getActiveLayer(); if (!layer || layer.type !== 'image') return;
            layer.adjustments[key] = parseInt(input.value);
            $(`#${key}Value`).textContent = input.value;
            processedCache.clear(); requestRender();
          });
          input.addEventListener('change', () => pushHistory(`Adjust ${key}`));
        });
        $('#resetAdjustmentsBtn').addEventListener('click', () => {
          const layer = getActiveLayer(); if (!layer || layer.type !== 'image') return;
          layer.adjustments = defaultImageAdjustments(); processedCache.clear(); pushHistory('Reset adjustments'); refreshUI(); requestRender();
        });
        ['filterStrength','filterParam'].forEach(id => {
          $('#'+id).addEventListener('input', e => {
            const layer = getActiveLayer(); if (!layer || layer.type !== 'image') return;
            const key = id === 'filterStrength' ? 'filterStrength' : 'filterParam';
            layer.adjustments[key] = parseInt(e.target.value);
            $(`#${id}Value`).textContent = `${e.target.value}%`;
            processedCache.clear(); requestRender();
          });
          $('#'+id).addEventListener('change', () => pushHistory('Tune filter'));
        });

        ['layerX','layerY','layerW','layerH'].forEach(id => {
          $('#'+id).addEventListener('change', e => {
            const layer = getActiveLayer(); if (!layer) return;
            const map = {layerX:'x',layerY:'y',layerW:'w',layerH:'h'};
            layer[map[id]] = parseFloat(e.target.value) || (id.endsWith('W') || id.endsWith('H') ? 1 : 0);
            if (layer.type === 'image') processedCache.clear();
            pushHistory('Transform layer'); refreshUI(); requestRender();
          });
        });

        $('#backgroundEnabled').addEventListener('change', e => {
          const l=getActiveLayer(); if(!l || l.type!=='image') return;
          normalizeLayer(l).backgroundRemoval.enabled=e.target.checked; processedCache.clear(); pushHistory('Toggle background removal'); requestRender();
        });
        $('#backgroundColor').addEventListener('input', e => {
          const l=getActiveLayer(); if(!l || l.type!=='image') return;
          normalizeLayer(l).backgroundRemoval.color=e.target.value; l.backgroundRemoval.enabled=true; processedCache.clear(); requestRender();
        });
        $('#backgroundColor').addEventListener('change', () => pushHistory('Background color'));
        $('#backgroundPreset').addEventListener('change', e => {
          const l=getActiveLayer(); if(!l || l.type!=='image' || e.target.value==='custom') return;
          const colors={white:'#ffffff',black:'#000000',green:'#00ff00',blue:'#0066ff'};
          normalizeLayer(l).backgroundRemoval.color=colors[e.target.value]; l.backgroundRemoval.enabled=true; processedCache.clear(); pushHistory('Background preset'); refreshUI(); requestRender();
        });
        [['backgroundTolerance','tolerance'],['backgroundSoftness','softness'],['backgroundDespill','despill']].forEach(([id,key]) => {
          $('#'+id).addEventListener('input', e => { const l=getActiveLayer(); if(!l || l.type!=='image') return; normalizeLayer(l).backgroundRemoval[key]=parseInt(e.target.value); $('#'+id+'Value').textContent=`${e.target.value}%`; processedCache.clear(); requestRender(); });
          $('#'+id).addEventListener('change', () => pushHistory('Tune background removal'));
        });
        $('#autoBackgroundBtn').addEventListener('click', () => autoDetectBackground(getActiveLayer()));
        $('#pickBackgroundBtn').addEventListener('click', () => setTool('bgpick'));
        $('#resetBackgroundBtn').addEventListener('click', () => { const l=getActiveLayer(); if(!l || l.type!=='image') return; l.backgroundRemoval=defaultBackgroundRemoval(); processedCache.clear(); pushHistory('Reset background removal'); refreshUI(); requestRender(); });

        [['shadowEnabled','shadow','enabled'],['glowEnabled','glow','enabled']].forEach(([id,group,key]) => $('#'+id).addEventListener('change', e => { const l=normalizeLayer(getActiveLayer()); if(!l) return; l.effects[group][key]=e.target.checked; pushHistory(`Toggle ${group}`); requestRender(); }));
        [['shadowColor','shadow','color'],['glowColor','glow','color']].forEach(([id,group,key]) => { $('#'+id).addEventListener('input', e => { const l=normalizeLayer(getActiveLayer()); if(!l) return; l.effects[group][key]=e.target.value; requestRender(); }); $('#'+id).addEventListener('change', () => pushHistory('Effect color')); });
        [['shadowOpacity','shadow','opacity','%'],['shadowBlur','shadow','blur',' px'],['shadowOffsetX','shadow','offsetX',' px'],['shadowOffsetY','shadow','offsetY',' px'],['glowOpacity','glow','opacity','%'],['glowBlur','glow','blur',' px']].forEach(([id,group,key,suffix]) => {
          $('#'+id).addEventListener('input', e => { const l=normalizeLayer(getActiveLayer()); if(!l) return; l.effects[group][key]=parseInt(e.target.value); $('#'+id+'Value').textContent=`${e.target.value}${suffix}`; requestRender(); });
          $('#'+id).addEventListener('change', () => pushHistory('Tune layer effect'));
        });
        $('#resetEffectsBtn').addEventListener('click', () => { const l=getActiveLayer(); if(!l) return; l.effects=defaultLayerEffects(); pushHistory('Reset effects'); refreshUI(); requestRender(); });

        $('#startCropBtn').addEventListener('click', startCrop);
        $('#cancelCropBtn').addEventListener('click', cancelCrop);
        $('#applyCropBtn').addEventListener('click', applyCrop);
        $('#cropRatio').addEventListener('change', startCrop);
        $('#cropW').addEventListener('change', e => { if (state.cropRect) { state.cropRect.w = clamp(parseInt(e.target.value),1,state.width-state.cropRect.x); requestRender(); } });
        $('#cropH').addEventListener('change', e => { if (state.cropRect) { state.cropRect.h = clamp(parseInt(e.target.value),1,state.height-state.cropRect.y); requestRender(); } });
        $('#resizeW').addEventListener('input', e => { if ($('#lockResizeRatio').checked) $('#resizeH').value = Math.max(1, Math.round(parseInt(e.target.value)/resizeRatio)); });
        $('#resizeH').addEventListener('input', e => { if ($('#lockResizeRatio').checked) $('#resizeW').value = Math.max(1, Math.round(parseInt(e.target.value)*resizeRatio)); });
        $('#applyResizeBtn').addEventListener('click', applyResize);

        $('#addTextBtn').addEventListener('click', () => addTextLayer());
        $('#updateTextBtn').addEventListener('click', updateSelectedText);
        $$('#textStyleSegment button').forEach(b => b.addEventListener('click', () => { state.textStyle[b.dataset.style] = !state.textStyle[b.dataset.style]; syncTextStyleSegment(); }));
        $('#textStrokeWidth').addEventListener('input', e => $('#textStrokeWidthValue').textContent = `${e.target.value} px`);

        $$('#shapeTypeSegment button').forEach(b => b.addEventListener('click', () => { state.selectedShape=b.dataset.shape; syncShapeSegment(); }));
        $('#activateShapeBtn').addEventListener('click', () => setTool(state.selectedShape));
        $('#shapeFillOpacity').addEventListener('input', e => $('#shapeFillOpacityValue').textContent = `${e.target.value}%`);
        $('#shapeStrokeWidth').addEventListener('input', e => $('#shapeStrokeWidthValue').textContent = `${e.target.value} px`);

        $('#layerName').addEventListener('change', e => { const l=getActiveLayer(); if(l){l.name=e.target.value||l.name;pushHistory('Rename layer');refreshUI();} });
        $('#layerOpacity').addEventListener('input', e => { const l=getActiveLayer(); if(l){l.opacity=parseInt(e.target.value)/100;$('#layerOpacityValue').textContent=`${e.target.value}%`;requestRender();} });
        $('#layerOpacity').addEventListener('change', () => pushHistory('Layer opacity'));
        $('#blendMode').addEventListener('change', e => { const l=getActiveLayer(); if(l){l.blendMode=e.target.value;pushHistory('Blend mode');requestRender();} });
        $('#deleteLayerBtn').addEventListener('click', deleteActiveLayer);
        $('#deleteLayerTool').addEventListener('click', deleteActiveLayer);
        $('#duplicateLayerBtn').addEventListener('click', duplicateActiveLayer);
        $('#layerUpBtn').addEventListener('click', () => moveLayer(1));
        $('#layerDownBtn').addEventListener('click', () => moveLayer(-1));

        $('#exportFormat').addEventListener('change', e => $('#qualityControl').classList.toggle('hidden', e.target.value === 'image/png'));
        $('#exportQuality').addEventListener('input', e => $('#exportQualityValue').textContent = `${e.target.value}%`);
        $('#downloadBtn').addEventListener('click', downloadExport);
        $('#quickExportBtn').addEventListener('click', () => { openPanel('export'); sidebar.classList.add('open'); });

        window.addEventListener('keydown', e => {
          const mod = e.ctrlKey || e.metaKey;
          if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
          if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
          if (e.key === 'Delete' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) deleteActiveLayer();
          if (e.key === 'Escape') { if (state.cropActive) cancelCrop(); sidebar.classList.remove('open'); }
        });
        window.addEventListener('resize', () => { if(state.layers.length) fitCanvas(); });
      }
