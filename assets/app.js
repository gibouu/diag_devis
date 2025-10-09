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

  const stepIds = ['stepArea', 'stepType', 'stepPurpose', 'stepDiags'];
  let currentStep = 0;

  const resultCard = H.q('resultCard');

  const showStep = (index) => {
    currentStep = Math.min(Math.max(index, 0), stepIds.length - 1);
    stepIds.forEach((id, idx) => {
      const el = H.q(id);
      if (!el) return;
      el.style.display = idx === currentStep ? '' : 'none';
    });
    if (resultCard) {
      resultCard.style.display = currentStep >= stepIds.length - 1 ? '' : 'none';
    }
    if (currentStep === stepIds.length - 1) {
      D.renderDiagnosticsList();
    }
  };

  const stepTriggers = [
    ['nextToType', 1],
    ['nextToPurpose', 2],
    ['nextToDiags', 3]
  ];
  stepTriggers.forEach(([btnId, targetIndex]) => {
    H.safeOn(btnId, 'click', () => showStep(targetIndex));
  });

  // ensure initial visibility reflects JS controlled steps
  showStep(currentStep);

  document.querySelectorAll('input[name="purpose"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      D.renderDiagnosticsList();
    });
  });

  // wire calculate button to renderResult and to show invoice only after calc
  H.safeOn('calc','click', () => {
    C.renderResult();
    const inv = H.q('stepInvoice'); if (inv) inv.style.display = '';
  });
});
