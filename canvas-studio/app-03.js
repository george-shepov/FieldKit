'use strict';
async function getProcessedImageLayer(layer) {
        const key = layerCacheKey(layer);
        if (processedCache.has(key)) return processedCache.get(key);
        normalizeLayer(layer);
        const work = document.createElement('canvas');
        work.width = Math.max(1, Math.round(layer.w));
        work.height = Math.max(1, Math.round(layer.h));
        const raw = document.createElement('canvas');
        raw.width = work.width;
        raw.height = work.height;
        const rawCtx = raw.getContext('2d', { willReadFrequently:true });
        const wctx = work.getContext('2d', { willReadFrequently:true });
        const img = await loadImage(layer.src);
        const a = layer.adjustments || defaultImageAdjustments();
        rawCtx.drawImage(img, 0, 0, raw.width, raw.height);
        applyBackgroundRemoval(raw, layer.backgroundRemoval);
        wctx.save();
        wctx.filter = filterCss(a);
        wctx.drawImage(raw, 0, 0, work.width, work.height);
        wctx.restore();
        sharpenCanvas(work, a.sharpness || 0);
        processedCache.set(key, work);
        if (processedCache.size > 28) processedCache.delete(processedCache.keys().next().value);
        return work;
      }

function drawTextLayer(targetCtx, layer) {
        targetCtx.save();
        targetCtx.translate(layer.x, layer.y);
        targetCtx.rotate((layer.rotation || 0) * Math.PI / 180);
        const fontStyle = `${layer.italic ? 'italic ' : ''}${layer.bold ? '700 ' : '400 '}${layer.fontSize}px ${layer.fontFamily}`;
        targetCtx.font = fontStyle;
        targetCtx.textAlign = layer.align || 'left';
        targetCtx.textBaseline = 'top';
        const textAnchor = layer.align === 'center' ? layer.w / 2 : layer.align === 'right' ? layer.w : 0;
        const lines = (layer.uppercase ? layer.text.toUpperCase() : layer.text).split('\n');
        const lineHeight = layer.fontSize * 1.18;
        lines.forEach((line, i) => {
          if (layer.strokeWidth > 0) {
            targetCtx.lineWidth = layer.strokeWidth;
            targetCtx.strokeStyle = layer.stroke;
            targetCtx.lineJoin = 'round';
            targetCtx.strokeText(line, textAnchor, i * lineHeight);
          }
          targetCtx.fillStyle = layer.fill;
          targetCtx.fillText(line, textAnchor, i * lineHeight);
        });
        targetCtx.restore();
      }

function drawShapeLayer(targetCtx, layer) {
        targetCtx.save();
        targetCtx.translate(layer.x, layer.y);
        targetCtx.rotate((layer.rotation || 0) * Math.PI / 180);
        targetCtx.lineWidth = layer.strokeWidth;
        targetCtx.strokeStyle = layer.stroke;
        targetCtx.fillStyle = rgba(layer.fill, layer.fillOpacity);
        targetCtx.lineJoin = 'round';
        targetCtx.lineCap = 'round';
        targetCtx.beginPath();
        if (layer.shapeType === 'rect') targetCtx.rect(0, 0, layer.w, layer.h);
        else if (layer.shapeType === 'ellipse') targetCtx.ellipse(layer.w / 2, layer.h / 2, Math.abs(layer.w / 2), Math.abs(layer.h / 2), 0, 0, Math.PI * 2);
        else { targetCtx.moveTo(0, 0); targetCtx.lineTo(layer.w, layer.h); }
        if (layer.shapeType !== 'line' && layer.fillOpacity > 0) targetCtx.fill();
        if (layer.strokeWidth > 0) targetCtx.stroke();
        targetCtx.restore();
      }

async function drawLayerSource(targetCtx, layer) {
        if (layer.type === 'image') {
          const imgCanvas = await getProcessedImageLayer(layer);
          targetCtx.save();
          targetCtx.translate(layer.x + layer.w / 2, layer.y + layer.h / 2);
          targetCtx.rotate((layer.rotation || 0) * Math.PI / 180);
          targetCtx.drawImage(imgCanvas, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
          targetCtx.restore();
        } else if (layer.type === 'text') drawTextLayer(targetCtx, layer);
        else if (layer.type === 'shape') drawShapeLayer(targetCtx, layer);
      }

function documentCanvas() {
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(state.width));
        out.height = Math.max(1, Math.round(state.height));
        return out;
      }

function outerEffectCanvas(source, config, glow = false) {
        const out = documentCanvas();
        if (!config?.enabled || Number(config.blur) <= 0 || Number(config.opacity) <= 0) return out;
        const octx = out.getContext('2d');
        octx.save();
        octx.shadowColor = rgba(config.color || '#000000', clamp(Number(config.opacity) || 0,0,100)/100);
        octx.shadowBlur = Math.max(0, Number(config.blur) || 0);
        octx.shadowOffsetX = glow ? 0 : Number(config.offsetX) || 0;
        octx.shadowOffsetY = glow ? 0 : Number(config.offsetY) || 0;
        octx.drawImage(source, 0, 0);
        if (glow) octx.drawImage(source, 0, 0);
        octx.restore();
        octx.globalCompositeOperation = 'destination-out';
        octx.drawImage(source, 0, 0);
        return out;
      }
