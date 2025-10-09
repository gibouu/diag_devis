import * as H from './helpers.js';
import * as S from './state.js';
import * as D from './diagnostics.js';
import * as C from './calc.js';
import * as I from './invoice.js';

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
      el.style.display = idx <= currentStep ? '' : 'none';
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
      const result = H.q('result'); if (result) result.innerHTML = '';
      I.syncInvoiceFromSelections();
    });
  });

  const refreshStudetteAvailability = () => {
    const areaInput = H.q('area');
    const areaVal = Math.max(0, Number(areaInput?.value || 0));
    const studette = H.q('opt_studette');
    if (!studette) return;
    const propIsHouse = (S.state.propType === 'house');
    if (propIsHouse || areaVal >= 20) {
      studette.checked = false;
      studette.disabled = true;
    } else {
      studette.disabled = false;
    }
  };

  const areaInput = H.q('area');
  if (areaInput) {
    areaInput.addEventListener('input', () => {
      const value = Math.max(0, Number(areaInput.value || 0));
      const derivedPackEl = H.q('derivedPack');
      if (derivedPackEl) derivedPackEl.textContent = C.getDisplayPackLabel(value);
      const result = H.q('result'); if (result) result.innerHTML = '';
      refreshStudetteAvailability();
      I.syncInvoiceFromSelections();
    });
  }

  document.querySelectorAll('input[name="propType"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const checked = document.querySelector('input[name="propType"]:checked');
      const value = checked ? checked.value : 'apartment';
      S.updateState({ propType: value });
      const result = H.q('result'); if (result) result.innerHTML = '';
      refreshStudetteAvailability();
      I.syncInvoiceFromSelections();
    });
  });

  document.querySelectorAll('input[name="jobType"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const result = H.q('result'); if (result) result.innerHTML = '';
      I.syncInvoiceFromSelections();
    });
  });

  const diagList = H.q('diagnosticsList');
  if (diagList) {
    diagList.addEventListener('click', () => {
      setTimeout(() => {
        const result = H.q('result'); if (result) result.innerHTML = '';
        I.syncInvoiceFromSelections();
      }, 50);
    });
  }

  ['opt_studette','opt_agent'].forEach((id) => {
    const el = H.q(id);
    if (el) el.addEventListener('change', () => {
      const result = H.q('result'); if (result) result.innerHTML = '';
      I.syncInvoiceFromSelections();
    });
  });

  refreshStudetteAvailability();
  I.syncInvoiceFromSelections();

  const resetWizard = () => {
    currentStep = 0;
    showStep(currentStep);

    const jobNormal = document.querySelector('input[name="jobType"][value="normal"]');
    if (jobNormal) jobNormal.checked = true;
    const propApartment = document.querySelector('input[name="propType"][value="apartment"]');
    if (propApartment) propApartment.checked = true;
    S.updateState({ selectedDiagIds: [], propType: 'apartment' });

    const purposeRent = document.querySelector('input[name="purpose"][value="rent"]');
    if (purposeRent) purposeRent.checked = true;

    const studette = H.q('opt_studette'); if (studette) { studette.checked = false; studette.disabled = false; }
    const agent = H.q('opt_agent'); if (agent) agent.checked = false;

    if (areaInput) {
      areaInput.value = areaInput.defaultValue || '60';
      areaInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    refreshStudetteAvailability();

    D.renderDiagnosticsList();

    const result = H.q('result'); if (result) result.innerHTML = '';
    if (resultCard) resultCard.style.display = 'none';
    const invoiceStep = H.q('stepInvoice'); if (invoiceStep) invoiceStep.style.display = 'none';

    const invoiceFields = ['inv_company','inv_first','inv_last','inv_num','inv_street','inv_postal','inv_city','inv_designation','inv_description','inv_search'];
    invoiceFields.forEach((id) => {
      const el = H.q(id);
      if (!el) return;
      if ('defaultValue' in el) el.value = el.defaultValue;
      else el.value = '';
    });
    const suggestions = H.q('addr_suggestions');
    if (suggestions) { suggestions.innerHTML = ''; suggestions.style.display = 'none'; }
    const addrStatus = H.q('addr_status'); if (addrStatus) addrStatus.textContent = '';
    const status = H.q('inv_status'); if (status) status.textContent = '';

    document.querySelectorAll('input[name="inv_civ"]').forEach((radio) => {
      radio.checked = (radio.value === 'M.');
    });
    const civDefault = document.querySelector('input[name="inv_civ"][value="M."]');
    if (civDefault) civDefault.dispatchEvent(new Event('change', { bubbles: true }));

    I.hidePostExportActions();
    I.syncInvoiceFromSelections();
    I.validateInvoice();
  };

  const newInvoiceBtn = H.q('newInvoice');
  if (newInvoiceBtn) {
    newInvoiceBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      resetWizard();
    });
  }

  // wire calculate button with validation before rendering
  H.safeOn('calc','click', () => {
    I.hidePostExportActions();
    const jobType = [...document.querySelectorAll('input[name="jobType"]')].find(r => r.checked)?.value || 'normal';
    const areaEl = H.q('area');
    const areaVal = Math.max(0, Number(areaEl?.value || 0));
    let hasError = false;
    areaEl?.classList.remove('error');
    const diagListEl = H.q('diagnosticsList');
    diagListEl?.classList.remove('error');
    if (jobType === 'normal' && areaVal <= 0) {
      areaEl?.classList.add('error');
      hasError = true;
    }
    if (jobType === 'normal') {
      const selectedIds = new Set(S.state.selectedDiagIds || []);
      if (selectedIds.size === 0) {
        diagListEl?.classList.add('error');
        hasError = true;
      }
    }
    const result = H.q('result');
    if (hasError) {
      if (result) result.innerHTML = `<p class="error-text">Please fill in the highlighted fields.</p>`;
      return;
    }
    C.renderResult();
    if (result) I.syncInvoiceFromSelections();
    const inv = H.q('stepInvoice'); if (inv) inv.style.display = '';
  });
});
