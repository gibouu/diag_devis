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

const PACK_AREA_LIMITS = { F1: 30, F2: 45, F3: 60, F4: 80, F5: 100 };
const PACK_SEQUENCE = ['F1', 'F2', 'F3', 'F4', 'F5'];
const BAND_AREA_LIMITS = { band_45: 45, band_80: 80, band_100: 100 };

function getAreaBand(area){
  if (area <= 45) return 'band_45';
  if (area <= 80) return 'band_80';
  return 'band_100';
}

function asNumber(value, fallback = 0){
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPhilippeInfoForDiag(diagId, purpose){
  const pricesByPack = state.prices?.[diagId];
  if (!pricesByPack) return null;
  const base = asNumber(pricesByPack?.F5?.[purpose], 0);
  if (base <= 0) return null;
  for (let idx = PACK_SEQUENCE.length - 2; idx >= 0; idx--) {
    const pack = PACK_SEQUENCE[idx];
    const candidate = asNumber(pricesByPack?.[pack]?.[purpose], 0);
    if (candidate <= 0) continue;
    const baseArea = PACK_AREA_LIMITS.F5;
    const lowerArea = PACK_AREA_LIMITS[pack];
    if (!baseArea || !lowerArea || lowerArea >= baseArea) continue;
    const diffPrice = base - candidate;
    if (diffPrice <= 0) continue;
    return { basePrice: base, diffPrice, stepArea: baseArea - lowerArea };
  }
  return { basePrice: base, diffPrice: 0, stepArea: null };
}

function getPhilippeInfoForBundle(count, purpose){
  const base = asNumber(BUNDLE_PRICES.band_100?.[purpose]?.[count], 0);
  if (base <= 0) return null;
  const lowerBands = ['band_80','band_45'];
  for (const band of lowerBands) {
    const lower = asNumber(BUNDLE_PRICES[band]?.[purpose]?.[count], 0);
    if (lower <= 0 || lower >= base) continue;
    const baseArea = BAND_AREA_LIMITS.band_100;
    const lowerArea = BAND_AREA_LIMITS[band];
    if (!baseArea || !lowerArea || lowerArea >= baseArea) continue;
    return { basePrice: base, diffPrice: base - lower, stepArea: baseArea - lowerArea };
  }
  return { basePrice: base, diffPrice: 0, stepArea: null };
}

function computeScaledAmount(area, method, basePrice, philippeInfo){
  const normalizedBase = asNumber(basePrice, 0);
  const extraArea = Math.max(0, area - 100);
  if (extraArea <= 0) {
    return {
      price: roundCurrency(normalizedBase),
      adjustment: null
    };
  }

  if (method === 'philippe' && philippeInfo && asNumber(philippeInfo.diffPrice, 0) > 0 && asNumber(philippeInfo.stepArea, 0) > 0) {
    const diffPrice = asNumber(philippeInfo.diffPrice, 0);
    const stepArea = asNumber(philippeInfo.stepArea, 0);
    const steps = extraArea / stepArea;
    const increment = diffPrice * steps;
    const price = roundCurrency(normalizedBase + increment);
    return {
      price,
      adjustment: {
        type: 'philippe',
        diffPrice,
        stepArea,
        steps,
        extraArea
      }
    };
  }

  const factor = area / 100;
  const price = roundCurrency(normalizedBase * factor);
  return {
    price,
    adjustment: (factor > 1) ? { type: 'factor', factor } : null
  };
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
  const scalingMethod = (state.scalingMethod === 'philippe') ? 'philippe' : 'factor';
  const philippeNotes = [];
  const jobType = [...document.querySelectorAll('input[name="jobType"]')].find(r => r.checked)?.value || 'normal';

  if (jobType === 'parking') {
    const base = 170;
    const lines = [{ name: 'Parking (amiante + termites)', pack, purpose, base, factor: 1, price: base }];
    let total = base;
    if (erpSelected) {
      const erpBase = Number(state.prices?.['ERP']?.[pack]?.[purpose] ?? 40);
      const erpPrice = optAgent ? 0 : erpBase;
      total += erpPrice;
      lines.push({ name: optAgent ? 'ERP (mandataire - offert)' : 'ERP avec nuisances sonores aeriennes', pack, purpose, base: erpBase, factor: 1, price: erpPrice });
    }
    return {
      area,
      pack,
      purpose,
      factor: 1,
      lines,
      total: roundCurrency(total),
      packSummary: { names: ['AMIANTE','TERMITES'], count: 2, price: base, factor: 1, bundle: true, adjustment: null },
      erpSelected,
      philippeNotes: []
    };
  }
  if (jobType === 'cave') {
    const base = 170;
    const lines = [{ name: 'Cave uniquement', pack, purpose: 'sale', base, factor: 1, price: base }];
    let total = base;
    if (erpSelected) {
      const erpBase = Number(state.prices?.['ERP']?.[pack]?.['sale'] ?? 40);
      const erpPrice = optAgent ? 0 : erpBase;
      total += erpPrice;
      lines.push({ name: optAgent ? 'ERP (mandataire - offert)' : 'ERP avec nuisances sonores aeriennes', pack, purpose: 'sale', base: erpBase, factor: 1, price: erpPrice });
    }
    return {
      area,
      pack,
      purpose: 'sale',
      factor: 1,
      lines,
      total: roundCurrency(total),
      packSummary: { names: ['CAVE'], count: 1, price: base, factor: 1, bundle: false, adjustment: null },
      erpSelected,
      philippeNotes: []
    };
  }

  let lines = [];
  let diagnosticsSubtotal = 0;

  const count = selectedNonERP.length;
  const band = getAreaBand(area);
  const bundleMap = BUNDLE_PRICES[band]?.[purpose] || {};
  let usedBundle = false;
  let bundleAdjustment = null;
  let bundleBase = null;

  if (count >= 2 && bundleMap[count]) {
    lines = selectedNonERP.map(d => ({ name: d.name, pack, purpose, base: 0, factor: 1, price: 0 }));
    const baseBundle = bundleMap[count];
    bundleBase = baseBundle;
    const philippeInfo = getPhilippeInfoForBundle(count, purpose);
    const scaling = computeScaledAmount(area, scalingMethod, baseBundle, philippeInfo);
    diagnosticsSubtotal = scaling.price;
    if (scaling.adjustment) {
      bundleAdjustment = scaling.adjustment;
      if (bundleAdjustment.type === 'philippe') {
        const note = `Pack ${count} diagnostics : Difference ${bundleAdjustment.diffPrice.toFixed(2)} EUR × ${(bundleAdjustment.steps).toFixed(2)} ((${bundleAdjustment.extraArea.toFixed(2)} m²) / ${bundleAdjustment.stepArea.toFixed(2)} m²)`;
        philippeNotes.push(note);
        bundleAdjustment.notes = [note];
      }
    } else if (scalingMethod === 'philippe' && area > 100) {
      philippeNotes.push(`Pack ${count} diagnostics : Methode Philippe indisponible - retour au multiplicateur`);
    }
    usedBundle = true;
  } else {
    selectedNonERP.forEach(diag => {
      const pricePack = area > 100 ? 'F5' : pack;
      const base = Number(state.prices?.[diag.id]?.[pricePack]?.[purpose] ?? 0);
      let price = roundCurrency(base);
      let scalingAdjustment = null;
      if (area > 100) {
        const philippeInfo = getPhilippeInfoForDiag(diag.id, purpose);
        const scaling = computeScaledAmount(area, scalingMethod, base, philippeInfo);
        price = scaling.price;
        scalingAdjustment = scaling.adjustment;
        if (scalingAdjustment?.type === 'philippe') {
          const diffLabel = `${diag.name} : Difference ${scalingAdjustment.diffPrice.toFixed(2)} EUR × ${(scalingAdjustment.steps).toFixed(2)} ((${scalingAdjustment.extraArea.toFixed(2)} m²) / ${scalingAdjustment.stepArea.toFixed(2)} m²)`;
          scalingAdjustment.note = diffLabel;
          philippeNotes.push(diffLabel);
        } else if (scalingMethod === 'philippe' && area > 100 && !scalingAdjustment) {
          philippeNotes.push(`${diag.name} : Methode Philippe indisponible - retour au multiplicateur`);
        }
      }
      diagnosticsSubtotal += price;
      lines.push({
        name: diag.name,
        pack: pricePack,
        purpose,
        base,
        factor: (area <= 100 ? 1 : factor),
        price,
        adjustment: scalingAdjustment
      });
    });
  }

  if (optStudette || area < 20) {
    const cap = purpose === 'sale' ? 300 : 250;
    if (diagnosticsSubtotal > cap) diagnosticsSubtotal = cap;
  }

  let addonsSubtotal = 0;
  if (propIsHouse) {
    addonsSubtotal += 50;
    lines.push({ name: 'Majoration maison / pavillon', pack, purpose, base: 50, factor: 1, price: 50 });
  }

  if (erpSelected) {
    const pricePack = area > 100 ? 'F5' : pack;
    const erpBase = Number(state.prices?.['ERP']?.[pricePack]?.[purpose] ?? 40);
    // ERP is a flat add-on that should not scale with surface multipliers
    const erpPrice = optAgent ? 0 : roundCurrency(erpBase);
    addonsSubtotal += erpPrice;
    lines.push({
      name: optAgent ? 'ERP (mandataire - offert)' : 'ERP avec nuisances sonores aeriennes',
      pack: pricePack,
      purpose,
      base: erpBase,
      factor: 1,
      price: erpPrice
    });
  }

  const total = roundCurrency(diagnosticsSubtotal + addonsSubtotal);
  const packSummary = {
    names: selectedNonERP.map(s => s.name),
    count,
    price: diagnosticsSubtotal,
    bundle: usedBundle,
    base: bundleBase,
    adjustment: null
  };

  if (area > 100) {
    if (bundleAdjustment) {
      packSummary.adjustment = bundleAdjustment;
    } else if (philippeNotes.length > 0) {
      packSummary.adjustment = { type: 'philippe', notes: [...philippeNotes] };
    } else {
      packSummary.adjustment = (factor > 1) ? { type: 'factor', factor } : null;
    }
  } else if (factor > 1) {
    packSummary.adjustment = { type: 'factor', factor };
  }

  return { area, pack, purpose, factor, lines, total, packSummary, erpSelected, philippeNotes };
}

export function renderResult() {
  const out = q('result');
  if (!out) return;
  const result = calculateTotal();
  const { area, purpose, lines = [], total = 0, packSummary = {}, philippeNotes = [] } = result;

  if ((packSummary.count || 0) === 0 && lines.filter(l => l.price > 0).length === 0) {
    out.innerHTML = `<p class="muted">Selectionnez au moins un diagnostic.</p>`;
    return;
  }

  const purposeLabel = purpose === 'rent' ? 'Location' : 'Vente';
  const items = [];
  if (packSummary && packSummary.count > 0) {
    const label = `${packSummary.names.join(', ')} · Pack ${packSummary.count} diagnostics`;
    items.push({ label, price: packSummary.price.toFixed(2) });
    const adjustment = packSummary.adjustment;
    if (adjustment?.type === 'factor' && adjustment.factor > 1) {
      items.push({ label: `Multiplicateur × ${adjustment.factor.toFixed(2)}`, price: '' });
    } else if (adjustment?.type === 'philippe') {
      const notes = Array.isArray(adjustment.notes) && adjustment.notes.length > 0 ? adjustment.notes : philippeNotes;
      notes.forEach((note) => {
        items.push({ label: note, price: '' });
      });
    }
  }
  lines.forEach((line) => {
    if (!line.name) return;
    if (line.price <= 0) return;
    items.push({ label: line.name, price: line.price.toFixed(2) });
  });

  let html = '';
  html += `<p class="small muted">Pack : <span class="pill">${getDisplayPackLabel(area)}</span> · Objectif : <span class="pill">${purposeLabel}</span> · Surface : <span class="pill">${area} m²</span></p>`;
  html += `<table><thead><tr><th>Element</th><th class="right nowrap">Prix</th></tr></thead><tbody>`;
  items.forEach((item) => {
    html += `<tr><td>${escapeHtml(item.label)}</td><td class="right">${escapeHtml(String(item.price))}</td></tr>`;
  });
  html += `</tbody><tfoot><tr><th class="right total">Total</th><th class="right total">${total.toFixed(2)}</th></tr></tfoot></table>`;
  out.innerHTML = html;
}
