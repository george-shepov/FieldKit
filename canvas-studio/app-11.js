'use strict';
async function downloadExport() {
        if (!state.layers.length) return toast('Open an image first.', 'error');
        const format = $('#exportFormat').value;
        const quality = parseInt($('#exportQuality').value)/100;
        const out = document.createElement('canvas');
        out.width = state.width; out.height = state.height;
        await renderComposite(out, false, format === 'image/jpeg' ? '#ffffff' : null);
        const blob = await new Promise(resolve => out.toBlob(resolve, format, quality));
        if (!blob) return toast('Export failed in this browser.', 'error');
        const url = URL.createObjectURL(blob);
        const ext = format === 'image/png' ? 'png' : format === 'image/jpeg' ? 'jpg' : 'webp';
        const a = document.createElement('a');
        a.href = url;
        a.download = `${($('#exportFilename').value || 'canvas-studio-export').replace(/[^\w.-]+/g,'-')}.${ext}`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast(`Exported ${ext.toUpperCase()} successfully.`, 'success');
      }

function openFile(asLayer = false) {
        fileInput.dataset.asLayer = asLayer ? 'true' : 'false';
        fileInput.click();
      }

function bindRange(id, valueId, onInput, suffix = '') {
        const input = $('#'+id);
        input.addEventListener('input', () => {
          $('#'+valueId).textContent = `${input.value}${suffix}`;
          onInput?.(parseFloat(input.value));
        });
        input.addEventListener('change', () => pushHistory('Adjust setting'));
      }
