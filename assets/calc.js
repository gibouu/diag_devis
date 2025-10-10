import { q, getVal, getChecked, escapeHtml } from './helpers.js';
import { state } from './state.js';
import { getSelectedDiagnostics } from './diagnostics.js';

export function derivePackFromArea(area){
  if (area < 30) return 'F1';
  if (area < 45) return 'F2';
  if (area < 60) return 'F3';
  if (area < 80) return 'F4';
  if (area <= 100) return 'F5';
  return 'F6+';
}
export function getDisplayPackLabel(area){
  if (area < 30) return 'F1';
  if (area < 45) return 'F2';
  if (area < 60) return 'F3';
  if (area < 80) return 'F3/F4';
  if (area <= 100) return 'F5';
  return 'F6+';
}
export function roundCurrency(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }

const BUNDLE_PRICES = {
  band_45: {
    rent: { 2:150, 3:180, 4:200, 5:250, 6:300 },
    sale: { 2:150, 3:180, 4:225, 5:275, 6:340, 7:380 }
  },
  band_80: {
    rent: { 2:180, 3:200, 4:250, 5:300, 6:350 },
    sale: { 2:180, 3:210, 4:265, 5:310, 6:370, 7:420 }
  },
  band_100: {
    rent: { 2:200, 3:220, 4:270, 5:320, 6:370 },
    sale: { 2:200, 3:230, 4:280, 5:330, 6:385, 7:455 }
  }
};

function getAreaBand(area){
  if (area <= 45) return 'band_45';
  if (area <= 80) return 'band_80';
  return 'band_100';
}

export function calculateTotal() {
  const purpose = [...document.querySelectorAll('input[name="purpose"]')].find(r => r.checked)?.value || 'rent';
  const area = Math.max(0, Number(getVal('area') || 0));
  const pack = derivePackFromArea(area);
  const derivedPackEl = q('derivedPack');
  if (derivedPackEl) derivedPackEl.textContent = getDisplayPackLabel(area);

  const optStudette = getChecked('opt_studette');
  const optAgent = getChecked('opt_agent');
  const propIsHouse = (state.propType === 'house');

  const selectedAll = getSelectedDiagnostics();
  const erpSelected = selectedAll.some(s => s.id === 'ERP');
  const selectedNonERP = selectedAll.filter(s => s.id !== 'ERP');

  const factor = area <= 100 ? 1 : (area / 100);
  const jobType = [...document.querySelectorAll('input[name="jobType"]')].find(r => r.checked)?.value || 'normal';

  if (jobType === 'parking') {
    const base = 170;
    const lines = [{ name: 'Parking (Amiante + Termites)', pack, purpose, base, factor: 1, price: base }];
    let total = base;
    if (erpSelected) {
      const erpBase = Number(state.prices?.['ERP']?.[pack]?.[purpose] ?? 40);
      const erpPrice = optAgent ? 0 : erpBase;
      total += erpPrice;
      lines.push({ name: optAgent ? 'ERP (agent - free)' : 'ERP avec Nuisances Sonores Aeriennes', pack, purpose, base: erpBase, factor: 1, price: erpPrice });
    }
    return {
      area,
      pack,
      purpose,
      factor: 1,
      lines,
      total: roundCurrency(total),
      packSummary: { names: ['AMIANTE','TERMITES'], count: 2, price: base, factor: 1, bundle: true },
      erpSelected
    };
  }
  if (jobType === 'cave') {
    const base = 170;
    const lines = [{ name: 'Cave only', pack, purpose: 'sale', base, factor: 1, price: base }];
    let total = base;
    if (erpSelected) {
      const erpBase = Number(state.prices?.['ERP']?.[pack]?.['sale'] ?? 40);
      const erpPrice = optAgent ? 0 : erpBase;
      total += erpPrice;
      lines.push({ name: optAgent ? 'ERP (agent - free)' : 'ERP avec Nuisances Sonores Aeriennes', pack, purpose: 'sale', base: erpBase, factor: 1, price: erpPrice });
    }
    return {
      area,
      pack,
      purpose: 'sale',
      factor: 1,
      lines,
      total: roundCurrency(total),
      packSummary: { names: ['CAVE'], count: 1, price: base, factor: 1, bundle: false },
      erpSelected
    };
  }

  let lines = [];
  let diagnosticsSubtotal = 0;

  const count = selectedNonERP.length;
  const band = getAreaBand(area);
  const bundleMap = BUNDLE_PRICES[band]?.[purpose] || {};
  let usedBundle = false;

  if (count >= 2 && bundleMap[count]) {
    lines = selectedNonERP.map(d => ({ name: d.name, pack, purpose, base: 0, factor: 1, price: 0 }));
    const baseBundle = bundleMap[count];
    diagnosticsSubtotal = roundCurrency(baseBundle * (area <= 100 ? 1 : factor));
    usedBundle = true;
  } else {
    selectedNonERP.forEach(diag => {
      const pricePack = area > 100 ? 'F5' : pack;
      const base = Number(state.prices?.[diag.id]?.[pricePack]?.[purpose] ?? 0);
      const price = roundCurrency(base * (area <= 100 ? 1 : factor));
      diagnosticsSubtotal += price;
      lines.push({ name: diag.name, pack: pricePack, purpose, base, factor: (area <= 100 ? 1 : factor), price });
    });
  }

  if (optStudette || area < 20) {
    const cap = purpose === 'sale' ? 300 : 250;
    if (diagnosticsSubtotal > cap) diagnosticsSubtotal = cap;
  }

  let addonsSubtotal = 0;
  if (propIsHouse) {
    addonsSubtotal += 50;
    lines.push({ name: 'Pavilion / House surcharge', pack, purpose, base: 50, factor: 1, price: 50 });
  }

  if (erpSelected) {
    const pricePack = area > 100 ? 'F5' : pack;
    const erpBase = Number(state.prices?.['ERP']?.[pricePack]?.[purpose] ?? 40);
    const erpPrice = optAgent ? 0 : roundCurrency(erpBase * (area <= 100 ? 1 : factor));
    addonsSubtotal += erpPrice;
    lines.push({ name: optAgent ? 'ERP (agent - free)' : 'ERP avec Nuisances Sonores Aeriennes', pack, purpose, base: erpBase, factor: (area <= 100 ? 1 : factor), price: erpPrice });
  }

  const total = roundCurrency(diagnosticsSubtotal + addonsSubtotal);
  const packSummary = { names: selectedNonERP.map(s => s.name), count, price: diagnosticsSubtotal, factor: (area <= 100 ? 1 : factor), bundle: usedBundle };

  return { area, pack, purpose, factor, lines, total, packSummary, erpSelected };
}

export function renderResult() {
  const out = q('result');
  if (!out) return;
  const result = calculateTotal();
  const { area, purpose, lines = [], total = 0, packSummary = {} } = result;

  if ((packSummary.count || 0) === 0 && lines.filter(l => l.price > 0).length === 0) {
    out.innerHTML = `<p class="muted">Select at least one diagnostic.</p>`;
    return;
  }

  const purposeLabel = purpose === 'rent' ? 'Renting' : 'Sale';
  const items = [];
  if (packSummary && packSummary.count > 0) {
    const label = `${packSummary.names.join(', ')} · Pack ${packSummary.count} diagnostics`;
    items.push({ label, price: packSummary.price.toFixed(2) });
    if (packSummary.factor > 1) items.push({ label: `Factor × ${packSummary.factor.toFixed(2)}`, price: '' });
  }
  lines.forEach((line) => {
    if (!line.name) return;
    if (line.price <= 0) return;
    items.push({ label: line.name, price: line.price.toFixed(2) });
  });

  let html = '';
  html += `<p class="small muted">Pack: <span class="pill">${getDisplayPackLabel(area)}</span> · Purpose: <span class="pill">${purposeLabel}</span> · Area: <span class="pill">${area} m²</span></p>`;
  html += `<table><thead><tr><th>Item</th><th class="right nowrap">Price</th></tr></thead><tbody>`;
  items.forEach((item) => {
    html += `<tr><td>${escapeHtml(item.label)}</td><td class="right">${escapeHtml(String(item.price))}</td></tr>`;
  });
  html += `</tbody><tfoot><tr><th class="right total">Total</th><th class="right total">${total.toFixed(2)}</th></tr></tfoot></table>`;
  out.innerHTML = html;
}
