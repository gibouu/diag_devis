import * as H from './helpers.js';
import * as S from './state.js';
import * as D from './diagnostics.js';
import * as C from './calc.js';
import * as I from './invoice.js';
import * as X from './export.js';

document.addEventListener('DOMContentLoaded', () => {
  // small bootstrap: render diagnostics and attach UI hooks
  D.renderDiagnosticsList();
  I.setupCivVisibility();
  I.setupContinueHandler();
  // wire calculate button to renderResult and to show invoice only after calc
  H.safeOn('calc','click', () => {
    C.renderResult();
    const inv = H.q('stepInvoice'); if (inv) inv.style.display = '';
  });
  // attach other step navigation manually if needed (or keep step logic inside invoice.js / steps.js)
});
