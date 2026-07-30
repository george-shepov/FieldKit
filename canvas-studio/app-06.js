'use strict';
function pointerMove(ev) {
        const p = canvasPoint(ev);
        $('#cursorInfo').textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;
        if (!isPointerDown || !pointerStart) return;
        if (state.activeTool === 'select') {
          const layer = getActiveLayer();
          if (layer && originalLayerPosition) {
            layer.x = originalLayerPosition.x + p.x - pointerStart.x;
            layer.y = originalLayerPosition.y + p.y - pointerStart.y;
            syncLayerProperties();
          }
        } else if (state.activeTool === 'crop') {
          let w = p.x - pointerStart.x;
          let h = p.y - pointerStart.y;
          const ratio = parseFloat($('#cropRatio').value);
          if (Number.isFinite(ratio)) {
            const signW = Math.sign(w) || 1;
            const signH = Math.sign(h) || 1;
            if (Math.abs(w / (h || 1)) > ratio) h = signH * Math.abs(w) / ratio;
            else w = signW * Math.abs(h) * ratio;
          }
          const x = w < 0 ? pointerStart.x + w : pointerStart.x;
          const y = h < 0 ? pointerStart.y + h : pointerStart.y;
          state.cropRect = { x:clamp(x,0,state.width), y:clamp(y,0,state.height), w:clamp(Math.abs(w),1,state.width), h:clamp(Math.abs(h),1,state.height) };
          state.cropRect.w = Math.min(state.cropRect.w, state.width - state.cropRect.x);
          state.cropRect.h = Math.min(state.cropRect.h, state.height - state.cropRect.y);
          updateCropInputs();
        } else if (draftShape) {
          draftShape.w = p.x - pointerStart.x;
          draftShape.h = p.y - pointerStart.y;
        }
        requestRender();
      }

function pointerUp() {
        if (!isPointerDown) return;
        if (state.activeTool === 'select' && originalLayerPosition) pushHistory('Move layer');
        if (draftShape) {
          if (draftShape.shapeType !== 'line') {
            if (draftShape.w < 0) { draftShape.x += draftShape.w; draftShape.w = Math.abs(draftShape.w); }
            if (draftShape.h < 0) { draftShape.y += draftShape.h; draftShape.h = Math.abs(draftShape.h); }
          }
          if (Math.abs(draftShape.w) > 2 || Math.abs(draftShape.h) > 2) {
            draftShape.preview = false;
            state.layers.push(draftShape);
            state.activeLayerId = draftShape.id;
            pushHistory('Draw shape');
            refreshUI();
          }
          draftShape = null;
        }
        isPointerDown = false;
        pointerStart = null;
        originalLayerPosition = null;
        requestRender();
      }

function makeShapeLayer(type, x, y, w, h, preview = false) {
        return {
          id: uid(), type:'shape', name:`${type[0].toUpperCase()+type.slice(1)} ${state.layers.filter(l=>l.type==='shape').length+1}`,
          shapeType:type, x, y, w, h, rotation:0,
          fill:$('#shapeFill').value, stroke:$('#shapeStroke').value,
          fillOpacity:parseInt($('#shapeFillOpacity').value)/100,
          strokeWidth:parseInt($('#shapeStrokeWidth').value),
          opacity:1, blendMode:'source-over', visible:true, effects:defaultLayerEffects(), preview
        };
      }

function addTextLayer(x = null, y = null) {
        const placedFromButton = x === null || y === null;
        const text = $('#textContent').value.trim() || 'Text';
        const layer = {
          id:uid(), type:'text', name:`Text ${state.layers.filter(l=>l.type==='text').length+1}`,
          text, x:0, y:0, w:100, h:50, rotation:0,
          fontFamily:$('#fontFamily').value, fontSize:parseInt($('#fontSize').value) || 72,
          align:$('#textAlign').value, bold:state.textStyle.bold, italic:state.textStyle.italic, uppercase:state.textStyle.uppercase,
          fill:$('#textColor').value, stroke:$('#textStroke').value, strokeWidth:parseInt($('#textStrokeWidth').value),
          opacity:1, blendMode:'source-over', visible:true, effects:defaultLayerEffects()
        };
        layerBounds(layer);
        if (placedFromButton) {
          layer.x = (state.width - layer.w) / 2;
          layer.y = (state.height - layer.h) / 2;
        } else {
          layer.x = x;
          layer.y = y;
          if (layer.align === 'center') layer.x -= layer.w/2;
          if (layer.align === 'right') layer.x -= layer.w;
        }
        state.layers.push(layer);
        state.activeLayerId = layer.id;
        pushHistory('Add text');
        refreshUI();
        requestRender();
      }
