'use strict';
function init() {
        buildFilterGrid();
        bindEventsDone = true;
        initEvents();
        syncTextStyleSegment();
        syncShapeSegment();
        syncCanvasSize();
        refreshUI();
        updateHistoryButtons();
      }

let bindEventsDone = false;

init();

const observer = new MutationObserver(() => {
        if (state.layers.some(l => l.type === 'image')) updateFilterPreviews();
      });

observer.observe($('#layerList'), { childList:true });
