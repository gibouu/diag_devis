import { q, safeOn, getVal, getChecked, debounce, setStatusText } from './helpers.js';
import { calculateTotal, getDisplayPackLabel } from './calc.js';
import { exportToExcelExcelJS } from './export.js';

function togglePostExportActions(show){
  const container = q('postExportActions');
  if (!container) return;
  container.style.display = show ? 'flex' : 'none';
}

export function hidePostExportActions(){
  togglePostExportActions(false);
}

function formatPropertyLabel(value){
  if (!value) return '';
  const parts = String(value).split(/\s+/);
  return parts.map((part, idx) => {
    if (!part) return part;
    if (idx === 0) return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    return part.toUpperCase();
  }).join(' ');
}

export function validateInvoice(){
  const civ = [...document.querySelectorAll('input[name="inv_civ"]')].find(x => x.checked)?.value || 'M.';
  const company = getVal('inv_company');
  const first = getVal('inv_first');
  const last = getVal('inv_last');
  const allowNoFirst = getChecked('inv_no_first');
  const num = getVal('inv_num');
  const street = getVal('inv_street');
  const postal = getVal('inv_postal');
  const city = getVal('inv_city');
  const designation = getVal('inv_designation');
  const description = getVal('inv_description');
  const typeBien = getVal('inv_type_bien');

  let hasName = false;
  if (civ === 'company') hasName = company.length > 0;
  else if (civ === 'both' || civ === 'M_MME') hasName = last.length > 0;
  else if (allowNoFirst) hasName = last.length > 0;
  else hasName = (first.length > 0 && last.length > 0);

  const ok = hasName && num && street && postal && city && designation && description && typeBien;
  const btn = q('continueInvoice');
  if (btn) btn.disabled = !ok;
  return ok;
}

function sanitizeStreetName(str){
  if (!str) return '';
  return String(str).replace(/^\s*\d+\s*(bis|ter|quater)?\s*[,-]?\s*/i, '').trim();
}

export async function geocodeAddress(query){
  const status = q('addr_status');
  if (status) setStatusText(status, 'Recherche…');
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error('Lookup failed');
    const data = await resp.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    if (!features.length) {
      if (status) setStatusText(status, 'Aucun résultat');
      return null;
    }
    const best = features[0];
    const props = best.properties || {};
    return {
      number: props.housenumber || '',
      street: sanitizeStreetName(props.name || ''),
      postal: props.postcode || '',
      city: props.city || '',
      raw: best
    };
  } catch (error) {
    console.error('[geocodeAddress] failed', error);
    if (status) setStatusText(status, 'Erreur lors de la recherche');
    return null;
  }
}

async function suggestAddresses(query){
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`;
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return [];
    const data = await resp.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    return features.map((f) => ({
      label: f.properties?.label || '',
      number: f.properties?.housenumber || '',
      street: sanitizeStreetName(f.properties?.name || ''),
      postal: f.properties?.postcode || '',
      city: f.properties?.city || ''
    }));
  } catch (error) {
    console.warn('[suggestAddresses] failed', error);
    return [];
  }
}

export async function onLookupAddress(){
  const query = getVal('inv_search');
  const status = q('addr_status');
  if (!query) {
    if (status) setStatusText(status, 'Enter an address to search');
    return;
  }
  const data = await geocodeAddress(query);
  if (!data) return;
  const numEl = q('inv_num'); if (numEl) numEl.value = data.number || '';
  const streetEl = q('inv_street'); if (streetEl) streetEl.value = sanitizeStreetName(data.street || '');
  const postalEl = q('inv_postal'); if (postalEl) postalEl.value = data.postal || '';
  const cityEl = q('inv_city'); if (cityEl) cityEl.value = data.city || '';
  if (status) setStatusText(status, 'Address filled');
  validateInvoice();
}

function attachAddressSuggestions(){
  const input = q('inv_search');
  const menu = q('addr_suggestions');
  if (!input || !menu) return;

  const update = debounce(async () => {
    const query = input.value.trim();
    if (query.length < 3) {
      menu.style.display = 'none';
      menu.innerHTML = '';
      return;
    }
    const suggestions = await suggestAddresses(query);
    if (!suggestions.length) {
      menu.style.display = 'none';
      menu.innerHTML = '';
      return;
    }
    menu.innerHTML = '';
    suggestions.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.textContent = s.label;
      item.addEventListener('click', () => {
        const numEl = q('inv_num'); if (numEl) numEl.value = s.number || '';
        const streetEl = q('inv_street'); if (streetEl) streetEl.value = s.street || '';
        const postalEl = q('inv_postal'); if (postalEl) postalEl.value = s.postal || '';
        const cityEl = q('inv_city'); if (cityEl) cityEl.value = s.city || '';
        input.value = s.label || '';
        menu.style.display = 'none';
        validateInvoice();
      });
      menu.appendChild(item);
    });
    menu.style.display = '';
  }, 250);

  input.addEventListener('input', update);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      menu.style.display = 'none';
      update();
    }
  });
  document.addEventListener('click', (ev) => {
    if (ev.target === input) return;
    if (!menu.contains(ev.target)) menu.style.display = 'none';
  });
}

export function syncInvoiceFromSelections(){
  try {
    const area = Number(getVal('area') || 0);
    const res = calculateTotal();
    const packLabel = getDisplayPackLabel ? getDisplayPackLabel(area) : (res?.pack || '');
    const packSummary = res?.packSummary || { names: [], count: 0 };
    const erpSelected = !!res?.erpSelected;
    const jobType = [...document.querySelectorAll('input[name="jobType"]')].find(r => r.checked)?.value || 'normal';
    const propType = [...document.querySelectorAll('input[name="propType"]')].find(r => r.checked)?.value || 'apartment';

    const nonERPNames = Array.isArray(packSummary.names) ? packSummary.names : [];
    const packPart = (packSummary.count > 0) ? `1 Pack ${nonERPNames.join(', ')}` : '';
    const erpPart = erpSelected ? 'ERP (incl. sonorisation, solarisation)' : '';
    const designation = [packPart, erpPart].filter(Boolean).join(' · ');

    const desEl = q('inv_designation');
    if (desEl) desEl.value = designation || '';

    const typeEl = q('inv_type_bien');
    if (typeEl) {
      let newVal;
      if (jobType === 'cave') newVal = 'CAVE';
      else if (jobType === 'parking') newVal = 'PARKING';
      else newVal = (propType === 'house') ? 'MAISON' : (packLabel ? `APPARTEMENT ${packLabel}` : 'APPARTEMENT');

      if (typeEl.tagName === 'SELECT') {
        const exists = Array.from(typeEl.options).some(o => o.value === newVal || o.text === newVal);
        if (!exists) {
          const opt = document.createElement('option');
          opt.value = newVal;
          opt.text = newVal;
          typeEl.appendChild(opt);
        }
      }
      typeEl.value = newVal;

      const descLabel = formatPropertyLabel(newVal);
      const descEl = q('inv_description');
      if (descEl) descEl.value = descLabel;
    }
  } catch (error) {
    console.warn('syncInvoiceFromSelections failed', error);
  }
}

export function setupCivVisibility(){
  const update = () => {
    const civ = [...document.querySelectorAll('input[name="inv_civ"]')].find(r => r.checked)?.value || 'M.';
    const nameRow = q('inv_name_row');
    const companyRow = q('inv_company_row');
    const noFirst = q('inv_no_first');
    if (civ === 'company') {
      if (nameRow) nameRow.style.display = 'none';
      if (companyRow) companyRow.style.display = '';
      if (noFirst) { noFirst.checked = false; noFirst.disabled = true; }
    } else {
      if (nameRow) nameRow.style.display = '';
      if (companyRow) companyRow.style.display = 'none';
      if (noFirst) noFirst.disabled = false;
    }
    validateInvoice();
  };
  document.querySelectorAll('input[name="inv_civ"]').forEach((el) => {
    el.addEventListener('change', update);
  });
  setTimeout(update, 20);
}

export function setupContinueHandler(){
  const attach = () => {
    const btn = q('continueInvoice');
    if (!btn || btn.__bound) return;
    btn.onclick = null;
    btn.__bound = true;
    btn.addEventListener('click', async () => {
      const status = q('inv_status');
      if (!validateInvoice()) {
        if (status) setStatusText(status, 'Please complete the required invoice fields.');
        setTimeout(() => { if (status) setStatusText(status, ''); }, 4000);
        return;
      }
      if (status) setStatusText(status, 'Generating…');
      btn.disabled = true;
      try {
        await exportToExcelExcelJS();
        if (status) setStatusText(status, 'Done. Check your downloads.');
        togglePostExportActions(true);
      } catch (error) {
        console.error(error);
        if (status) setStatusText(status, 'Failed to generate.');
      } finally {
        btn.disabled = false;
        setTimeout(() => { if (status) setStatusText(status, ''); }, 4000);
      }
    });

    const invoiceInputs = ['inv_company','inv_first','inv_last','inv_num','inv_street','inv_postal','inv_city','inv_designation','inv_description','inv_type_bien'];
    invoiceInputs.forEach((id) => {
      const el = q(id);
      if (el) el.addEventListener('input', validateInvoice);
    });
    safeOn('area', 'input', () => { syncInvoiceFromSelections(); validateInvoice(); });
    document.querySelectorAll('input[name="purpose"]').forEach(el => el.addEventListener('change', syncInvoiceFromSelections));
    document.querySelectorAll('input[name="jobType"]').forEach(el => el.addEventListener('change', syncInvoiceFromSelections));
    document.querySelectorAll('input[name="propType"]').forEach(el => el.addEventListener('change', syncInvoiceFromSelections));

    const diagList = q('diagnosticsList');
    if (diagList) {
      diagList.addEventListener('click', () => {
        setTimeout(syncInvoiceFromSelections, 50);
      });
    }

    safeOn('calc', 'click', () => { setTimeout(syncInvoiceFromSelections, 50); });
    attachAddressSuggestions();
    syncInvoiceFromSelections();
    validateInvoice();
    hidePostExportActions();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
}
