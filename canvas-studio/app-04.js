'use strict';
async function drawLayer(targetCtx, layer) {
        if (!layer.visible) return;
        normalizeLayer(layer);
        const shadow = layer.effects.shadow;
        const glow = layer.effects.glow;
        const hasEffects = (shadow.enabled && shadow.opacity > 0 && shadow.blur > 0) || (glow.enabled && glow.opacity > 0 && glow.blur > 0);
        if (!hasEffects) {
          targetCtx.save();
          targetCtx.globalAlpha = layer.opacity;
          targetCtx.globalCompositeOperation = layer.blendMode;
          await drawLayerSource(targetCtx, layer);
          targetCtx.restore();
          return;
        }
        const source = documentCanvas();
        await drawLayerSource(source.getContext('2d'), layer);
        const combined = documentCanvas();
        const cctx = combined.getContext('2d');
        if (shadow.enabled) cctx.drawImage(outerEffectCanvas(source, shadow, false), 0, 0);
        if (glow.enabled) {
          cctx.save();
          cctx.globalCompositeOperation = 'screen';
          cctx.drawImage(outerEffectCanvas(source, glow, true), 0, 0);
          cctx.restore();
        }
        cctx.drawImage(source, 0, 0);
        targetCtx.save();
        targetCtx.globalAlpha = layer.opacity;
        targetCtx.globalCompositeOperation = layer.blendMode;
        targetCtx.drawImage(combined, 0, 0);
        targetCtx.restore();
      }

async function renderComposite(targetCanvas, includeOverlay = false, background = null) {
        const tctx = targetCanvas.getContext('2d', { willReadFrequently:true });
        tctx.save();
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        tctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        if (background) {
          tctx.fillStyle = background;
          tctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
        }
        for (const layer of state.layers) await drawLayer(tctx, layer);
        if (draftShape) await drawLayer(tctx, draftShape);
        if (includeOverlay) drawEditorOverlay(tctx);
        tctx.restore();
      }

function drawEditorOverlay(targetCtx) {
        const active = getActiveLayer();
        if (active && state.activeTool === 'select') {
          targetCtx.save();
          targetCtx.strokeStyle = '#8f78ff';
          targetCtx.lineWidth = Math.max(1, 1 / state.zoom);
          targetCtx.setLineDash([8 / state.zoom, 5 / state.zoom]);
          targetCtx.strokeRect(active.x, active.y, active.w, active.h);
          targetCtx.fillStyle = '#ffffff';
          targetCtx.strokeStyle = '#6e55ff';
          const r = 5 / state.zoom;
          [[active.x,active.y],[active.x+active.w,active.y],[active.x,active.y+active.h],[active.x+active.w,active.y+active.h]].forEach(([x,y]) => {
            targetCtx.beginPath(); targetCtx.arc(x, y, r, 0, Math.PI*2); targetCtx.fill(); targetCtx.stroke();
          });
          targetCtx.restore();
        }
        if (state.cropActive && state.cropRect) {
          const r = state.cropRect;
          targetCtx.save();
          targetCtx.fillStyle = 'rgba(0,0,0,.55)';
          targetCtx.beginPath();
          targetCtx.rect(0,0,state.width,state.height);
          targetCtx.rect(r.x,r.y,r.w,r.h);
          targetCtx.fill('evenodd');
          targetCtx.strokeStyle = '#ffffff';
          targetCtx.lineWidth = Math.max(1.5, 1.5 / state.zoom);
          targetCtx.setLineDash([10 / state.zoom, 6 / state.zoom]);
          targetCtx.strokeRect(r.x,r.y,r.w,r.h);
          targetCtx.setLineDash([]);
          targetCtx.strokeStyle = 'rgba(255,255,255,.5)';
          targetCtx.lineWidth = Math.max(.8, .8 / state.zoom);
          for (let i=1;i<3;i++) {
            targetCtx.beginPath(); targetCtx.moveTo(r.x + r.w*i/3, r.y); targetCtx.lineTo(r.x + r.w*i/3, r.y+r.h); targetCtx.stroke();
            targetCtx.beginPath(); targetCtx.moveTo(r.x, r.y + r.h*i/3); targetCtx.lineTo(r.x+r.w, r.y + r.h*i/3); targetCtx.stroke();
          }
          targetCtx.restore();
        }
      }

function requestRender() {
        renderGeneration++;
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(async () => {
          const generation = renderGeneration;
          renderQueued = false;
          await renderComposite(canvas, true);
          if (generation !== renderGeneration) requestRender();
          updateExportPreview();
        });
      }
