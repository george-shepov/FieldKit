'use strict';
function filterCss(adjustments) {
        const strength = (adjustments.filterStrength ?? 100) / 100;
        const param = (adjustments.filterParam ?? 50) / 100;
        const b = 1 + (adjustments.brightness || 0) / 100;
        const c = 1 + (adjustments.contrast || 0) / 100;
        const s = 1 + (adjustments.saturation || 0) / 100;
        const parts = [`brightness(${b})`, `contrast(${c})`, `saturate(${Math.max(0, s)})`];
        switch (adjustments.filter) {
          case 'vintage': parts.push(`sepia(${.62 * strength})`, `contrast(${1 - .12 * strength})`, `saturate(${1 - .28 * strength})`, `hue-rotate(${-8 * param}deg)`); break;
          case 'mono': parts.push(`grayscale(${strength})`); break;
          case 'noir': parts.push(`grayscale(${strength})`, `contrast(${1 + .65 * strength})`, `brightness(${1 - .12 * strength})`); break;
          case 'warm': parts.push(`sepia(${.34 * strength})`, `saturate(${1 + .45 * strength})`, `hue-rotate(${-18 * param * strength}deg)`); break;
          case 'cool': parts.push(`saturate(${1 + .2 * strength})`, `hue-rotate(${22 * param * strength}deg)`, `contrast(${1 + .1 * strength})`); break;
          case 'dream': parts.push(`blur(${1.6 * param * strength}px)`, `brightness(${1 + .12 * strength})`, `saturate(${1 + .3 * strength})`); break;
          case 'dramatic': parts.push(`contrast(${1 + (.3 + .25 * param) * strength})`, `saturate(${1 + .42 * strength})`); break;
          case 'invert': parts.push(`invert(${strength})`); break;
          case 'faded': parts.push(`contrast(${1 - .25 * strength})`, `brightness(${1 + .1 * strength})`, `saturate(${1 - .35 * strength})`); break;
        }
        return parts.join(' ');
      }

function sharpenCanvas(sourceCanvas, amount) {
        if (!amount) return sourceCanvas;
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;
        if (w * h > 10_000_000) return sourceCanvas;
        const sctx = sourceCanvas.getContext('2d', { willReadFrequently:true });
        let imageData;
        try { imageData = sctx.getImageData(0, 0, w, h); } catch { return sourceCanvas; }
        const src = imageData.data;
        const out = new Uint8ClampedArray(src);
        const a = clamp(amount / 100, 0, 1) * 1.35;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = (y * w + x) * 4;
            for (let ch = 0; ch < 3; ch++) {
              const center = src[i + ch];
              const neighbors = src[i - 4 + ch] + src[i + 4 + ch] + src[i - w * 4 + ch] + src[i + w * 4 + ch];
              out[i + ch] = clamp(center + a * (4 * center - neighbors), 0, 255);
            }
          }
        }
        imageData.data.set(out);
        sctx.putImageData(imageData, 0, 0);
        return sourceCanvas;
      }

function applyBackgroundRemoval(sourceCanvas, removal) {
        if (!removal?.enabled) return sourceCanvas;
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;
        if (w * h > 14_000_000) {
          toast('Background removal is limited on very large layers. Resize the layer first.', 'error');
          return sourceCanvas;
        }
        const rctx = sourceCanvas.getContext('2d', { willReadFrequently:true });
        let imageData;
        try { imageData = rctx.getImageData(0, 0, w, h); } catch { return sourceCanvas; }
        const data = imageData.data;
        const color = String(removal.color || '#ffffff').replace('#','');
        const bg = [parseInt(color.slice(0,2),16), parseInt(color.slice(2,4),16), parseInt(color.slice(4,6),16)];
        const tolerance = clamp(Number(removal.tolerance) || 0, 0, 100);
        const softness = clamp(Number(removal.softness) || 0, 0, 50);
        const despill = clamp(Number(removal.despill) || 0, 0, 100) / 100;
        for (let i = 0; i < data.length; i += 4) {
          if (!data[i+3]) continue;
          const dr = data[i] - bg[0], dg = data[i+1] - bg[1], db = data[i+2] - bg[2];
          const distance = Math.sqrt(dr*dr + dg*dg + db*db) / 4.41673;
          let keep = 1;
          if (softness <= 0) keep = distance <= tolerance ? 0 : 1;
          else if (distance <= tolerance) keep = 0;
          else if (distance < tolerance + softness) {
            const t = (distance - tolerance) / softness;
            keep = t * t * (3 - 2 * t);
          }
          if (despill && keep < 1) {
            const neutral = (data[i] + data[i+1] + data[i+2]) / 3;
            const strength = despill * (1 - keep);
            data[i] += (neutral - data[i]) * strength;
            data[i+1] += (neutral - data[i+1]) * strength;
            data[i+2] += (neutral - data[i+2]) * strength;
          }
          data[i+3] = Math.round(data[i+3] * keep);
        }
        rctx.putImageData(imageData, 0, 0);
        return sourceCanvas;
      }
