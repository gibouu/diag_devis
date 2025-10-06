(function(){
  // Config and persistence
  const DEFAULT_DIAGNOSTICS = [
    { id: 'AMIANTE', name: 'AMIANTE' },
    { id: 'DPE', name: 'DPE' },
    { id: 'CARREZ_BOUTIN', name: 'CARREZ/BOUTIN' },
    { id: 'PLOMB', name: 'PLOMB' },
    { id: 'TERMITES', name: 'TERMITES' },
    { id: 'GAZ', name: 'GAZ' },
    { id: 'ELECTRICITE', name: 'ELECTRICITE' },
  ];
  const PACKS = ['F1','F2','F3','F4','F5','F6+'];
  const PURPOSES = ['rent','sale'];

  function makeDefaultPrices(diagnostics = DEFAULT_DIAGNOSTICS) {
    const prices = {};
    diagnostics.forEach(d => {
      prices[d.id] = {};
      PACKS.forEach(p => {
        prices[d.id][p] = { rent: 0, sale: 0 };
      });
    });
    return prices;
  }

  function seedSpecDefaults(prices) {
    const order = ['AMIANTE','DPE','CARREZ_BOUTIN','PLOMB','TERMITES','GAZ','ELECTRICITE'];
    const f1 = [100,120,120,130,100,130,130];
    const f2 = [100,120,120,130,100,130,130];
    const f3 = [120,140,140,150,130,130,130];
    const f4 = [120,190,160,170,130,130,130];
    const f5 = [130,190,180,190,160,130,130];
    const byPack = { F1: f1, F2: f2, F3: f3, F4: f4, F5: f5 };
    order.forEach((id, idx) => {
      Object.entries(byPack).forEach(([pack, arr]) => {
        prices[id][pack] = { rent: arr[idx], sale: arr[idx] };
      });
    });
    return prices;
  }

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

  function getAreaBand(area) {
    if (area <= 45) return 'band_45';
    if (area <= 80) return 'band_80';
    return 'band_100';
  }

  function derivePackFromArea(area) {
    if (area < 30) return 'F1';
    if (area < 45) return 'F2';
    if (area < 60) return 'F3';
    if (area < 80) return 'F4';
    if (area <= 100) return 'F5';
    return 'F6+';
  }

  function getDisplayPackLabel(area) {
    if (area < 30) return 'F1';
    if (area < 45) return 'F2';
    if (area < 60) return 'F3';
    if (area < 80) return 'F3/F4';
    if (area <= 100) return 'F5';
    return 'F6+';
  }

  const storage = {
    getState() {
      try {
        const raw = localStorage.getItem('diagnostics_pricer_state');
        if (!raw) return null;
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    setState(state) {
      localStorage.setItem('diagnostics_pricer_state', JSON.stringify(state));
    }
  };

  let state = storage.getState() || {
    diagnostics: DEFAULT_DIAGNOSTICS,
    prices: seedSpecDefaults(makeDefaultPrices(DEFAULT_DIAGNOSTICS)),
  };

  function renderDiagnosticsList() {
    const list = document.getElementById('diagnosticsList');
    if (!list) return;
    list.innerHTML = '';
    const purpose = [...document.querySelectorAll('input[name="purpose"]')].find(r => r.checked)?.value || 'rent';
    state.diagnostics.forEach(diag => {
      const disabled = (diag.id === 'TERMITES' && purpose === 'rent');
      const chip = document.createElement('button');
      chip.type = 'button';
      const isSelected = (state.selectedDiagIds || []).includes(diag.id);
      chip.className = isSelected ? 'btn' : 'btn secondary';
      chip.dataset.diagId = diag.id;
      chip.textContent = diag.name + (disabled ? ' (sale only)' : '');
      chip.disabled = disabled;
      chip.addEventListener('click', () => {
        toggleSelectedDiagnostic(diag.id);
      renderDiagnosticsList();
      });
      list.appendChild(chip);
    });
  }

  function toggleSelectedDiagnostic(id) {
    const set = new Set(state.selectedDiagIds || []);
    if (set.has(id)) set.delete(id); else set.add(id);
    state.selectedDiagIds = Array.from(set);
  }

  function getSelectedDiagnostics() {
    const purpose = [...document.querySelectorAll('input[name="purpose"]')].find(r => r.checked)?.value || 'rent';
    const selectedIds = new Set(state.selectedDiagIds || []);
    return state.diagnostics.filter(d => {
      if (!selectedIds.has(d.id)) return false;
      if (purpose === 'rent' && d.id === 'TERMITES') return false;
      return true;
    });
  }

  function calculateTotal() {
    const areaInput = document.getElementById('area');
    const purpose = [...document.querySelectorAll('input[name="purpose"]')].find(r => r.checked)?.value || 'rent';
    const area = Math.max(0, Number(areaInput.value || 0));
    const pack = derivePackFromArea(area);
    const derivedPackEl = document.getElementById('derivedPack');
    if (derivedPackEl) derivedPackEl.textContent = getDisplayPackLabel(area);

    const optStudette = document.getElementById('opt_studette')?.checked || false;
    const optAgent = document.getElementById('opt_agent')?.checked || false;
    const optPavilion = (state.propType === 'house');

    const selected = getSelectedDiagnostics();
    const factor = area <= 100 ? 1 : (area / 100);

    const jobType = [...document.querySelectorAll('input[name="jobType"]')].find(r => r.checked)?.value || 'normal';
    if (jobType === 'parking') {
      const lines = [ { name: 'Parking (Amiante + Termites)', pack, purpose, base: 170, factor: 1, price: 170 } ];
      let total = 170;
      if (!optAgent) { total += 40; lines.push({ name: 'ERP', pack, purpose, base: 40, factor: 1, price: 40 }); } else { lines.push({ name: 'ERP (agent - free)', pack, purpose, base: 0, factor: 1, price: 0 }); }
      return { area, pack, purpose, factor: 1, lines, total: roundCurrency(total), packSummary: { names: ['AMIANTE','TERMITES'], count: 2, price: 170, factor: 1, bundle: true } };
    }
    if (jobType === 'cave') {
      const base = 170;
      const lines = [ { name: 'Cave only', pack, purpose: 'sale', base, factor: 1, price: base } ];
      if (!optAgent) { lines.push({ name: 'ERP', pack, purpose: 'sale', base: 40, factor: 1, price: 40 }); return { area, pack, purpose: 'sale', factor: 1, lines, total: roundCurrency(base + 40), packSummary: { names: ['CAVE'], count: 1, price: base, factor: 1, bundle: false } }; }
      lines.push({ name: 'ERP (agent - free)', pack, purpose: 'sale', base: 0, factor: 1, price: 0 });
      return { area, pack, purpose: 'sale', factor: 1, lines, total: roundCurrency(base), packSummary: { names: ['CAVE'], count: 1, price: base, factor: 1, bundle: false } };
    }

    let lines = [];
    let diagnosticsSubtotal = 0;

    const count = selected.length;
    const band = getAreaBand(area);

    const bundleMap = BUNDLE_PRICES[band]?.[purpose] || {};
    let usedBundle = false;
    if (count >= 2 && bundleMap[count]) {
      lines = selected.map(d => ({ name: d.name, pack, purpose, base: 0, factor: 1, price: 0 }));
      const baseBundle = bundleMap[count];
      diagnosticsSubtotal = roundCurrency(baseBundle * (area <= 100 ? 1 : factor));
      usedBundle = true;
    } else {
      selected.forEach(diag => {
        const pricePack = area > 100 ? 'F5' : pack;
        const base = Number(state.prices?.[diag.id]?.[pricePack]?.[purpose] ?? 0);
        const price = roundCurrency(base * (area <= 100 ? 1 : factor));
        diagnosticsSubtotal += price;
        lines.push({ name: diag.name, pack: pricePack, purpose, base, factor: (area <= 100 ? 1 : factor), price });
      });
    }

    if (optStudette || area < 20) {
      const cap = purpose === 'sale' ? 300 : 250;
      if (diagnosticsSubtotal > cap) {
        diagnosticsSubtotal = cap;
      }
    }

    let addonsSubtotal = 0;
    if (optPavilion) {
      addonsSubtotal += 50;
      lines.push({ name: 'Pavilion / House surcharge', pack, purpose, base: 50, factor: 1, price: 50 });
    }
    if (!optAgent) {
      addonsSubtotal += 40;
      lines.push({ name: 'ERP', pack, purpose, base: 40, factor: 1, price: 40 });
    } else {
      lines.push({ name: 'ERP (agent - free)', pack, purpose, base: 0, factor: 1, price: 0 });
    }

    const total = roundCurrency(diagnosticsSubtotal + addonsSubtotal);
    const selectedNames = selected.map(s => s.name);
    const packSummary = { names: selectedNames, count, price: diagnosticsSubtotal, factor: (area <= 100 ? 1 : factor), bundle: usedBundle };
    return { area, pack, purpose, factor, lines, total, packSummary };
  }

  function roundCurrency(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function renderResult() {
    const out = document.getElementById('result');
    const { area, pack, purpose, factor, lines, total, packSummary } = calculateTotal();

    if ((packSummary?.count || 0) === 0 && lines.length === 0) {
      out.innerHTML = `<p class="muted">Select at least one diagnostic.</p>`;
      return;
    }

    const purposeLabel = purpose === 'rent' ? 'Renting' : 'Sale';

    const items = [];
    if (packSummary && packSummary.count > 0) {
      items.push({ label: `${packSummary.names.join(', ')} · Pack ${packSummary.count} diagnostics`, price: packSummary.price.toFixed(2) });
      if (packSummary.factor > 1) {
        items.push({ label: `Factor × ${packSummary.factor.toFixed(2)}`, price: '' });
      }
    }
    lines.forEach(l => {
      if (l.name && l.price > 0) items.push({ label: l.name, price: l.price.toFixed(2) });
    });

    let html = '';
    html += `<p class="small muted">Pack: <span class="pill">${getDisplayPackLabel(area)}</span> · Purpose: <span class="pill">${purposeLabel}</span> · Area: <span class="pill">${area} m²</span></p>`;
    html += `<table><thead><tr><th>Item</th><th class="right nowrap">Price</th></tr></thead><tbody>`;
    items.forEach(it => {
      html += `<tr><td>${escapeHtml(it.label)}</td><td class="right">${escapeHtml(String(it.price))}</td></tr>`;
    });
    html += `</tbody><tfoot><tr><th class="right total">Total</th><th class="right total">${total.toFixed(2)}</th></tr></tfoot></table>`;

    out.innerHTML = html;
    const inv = document.getElementById('stepInvoice');
    if (inv) inv.style.display = '';
  }

  function validateInvoice() {
    const civ = [...document.querySelectorAll('input[name="inv_civ"]')].find(x => x.checked)?.value || 'M.';
    const company = document.getElementById('inv_company').value.trim();
    const first = document.getElementById('inv_first').value.trim();
    const last = document.getElementById('inv_last').value.trim();
    const num = document.getElementById('inv_num').value.trim();
    const street = document.getElementById('inv_street').value.trim();
    const postal = document.getElementById('inv_postal').value.trim();
    const city = document.getElementById('inv_city').value.trim();
    const designation = document.getElementById('inv_designation').value.trim();
    const description = document.getElementById('inv_description').value.trim();
    const typeBien = document.getElementById('inv_type_bien').value;
    const agree = document.getElementById('agree_terms').checked;
    const hasName = (civ === 'company') ? (company.length > 0) : (first && last);
    const ok = hasName && num && street && postal && city && designation && description && typeBien && agree;
    document.getElementById('continueInvoice').disabled = !ok;
    document.getElementById('inv_error').style.display = ok ? 'none' : 'none'; 
    return ok;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function debounce(fn, delay) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  document.getElementById('calc').addEventListener('click', () => {
    const jobType = [...document.querySelectorAll('input[name="jobType"]')].find(r => r.checked)?.value || 'normal';
    const areaEl = document.getElementById('area');
    const areaVal = Math.max(0, Number(areaEl.value || 0));
    let hasError = false;
    areaEl.classList.remove('error');
    const diagListEl = document.getElementById('diagnosticsList');
    if (diagListEl) diagListEl.classList.remove('error');
    if (jobType === 'normal' && areaVal <= 0) { areaEl.classList.add('error'); hasError = true; }
    if (jobType === 'normal') {
      const selectedIds = new Set(state.selectedDiagIds || []);
      if (selectedIds.size === 0) { if (diagListEl) diagListEl.classList.add('error'); hasError = true; }
    }
    if (hasError) {
      document.getElementById('result').innerHTML = `<p class="error-text">Please fill in the highlighted fields.</p>`;
      return;
    }
    renderResult();
  });

  document.querySelectorAll('input[name="purpose"]').forEach(r => {
    r.addEventListener('change', () => {
      renderDiagnosticsList();
      document.getElementById('result').innerHTML = '';
    });
  });
  document.getElementById('area').addEventListener('input', () => {
    const area = Math.max(0, Number(document.getElementById('area').value || 0));
    const derivedPackEl = document.getElementById('derivedPack');
    if (derivedPackEl) derivedPackEl.textContent = getDisplayPackLabel(area);
  });
  ['opt_studette','opt_cave','opt_parking','opt_agent'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      document.getElementById('result').innerHTML = '';
    });
  });

  document.getElementById('nextToType').addEventListener('click', () => {
    document.getElementById('stepType').style.display = '';
  });
  document.getElementById('nextToPurpose').addEventListener('click', () => {
    document.getElementById('stepPurpose').style.display = '';
  });
  document.getElementById('nextToDiags').addEventListener('click', () => {
    document.getElementById('stepDiags').style.display = '';
    renderDiagnosticsList();
  });
  document.querySelectorAll('input[name="propType"]').forEach(r => {
    r.addEventListener('change', () => {
      const checked = document.querySelector('input[name="propType"]:checked');
      state.propType = checked ? checked.value : 'apartment';
      document.getElementById('result').innerHTML = '';
    });
  });

  function refreshStudetteAvailability() {
    const areaVal = Math.max(0, Number(document.getElementById('area').value || 0));
    const propIsHouse = (state.propType === 'house');
    const studette = document.getElementById('opt_studette');
    if (!studette) return;
    if (propIsHouse || areaVal >= 20) {
      studette.checked = false;
      studette.disabled = true;
    } else {
      studette.disabled = false;
    }
  }
  document.getElementById('area').addEventListener('input', refreshStudetteAvailability);
  document.querySelectorAll('input[name="propType"]').forEach(r => {
    r.addEventListener('change', () => {
      const checked = document.querySelector('input[name="propType"]:checked');
      state.propType = checked ? checked.value : 'apartment';
      document.getElementById('result').innerHTML = '';
      refreshStudetteAvailability();
    });
  });
  refreshStudetteAvailability();

  function sanitizeStreetName(s) {
    if (!s) return '';
    // Remove leading house numbers like "22", "22 bis", "22,", "22-", etc.
    return String(s).replace(/^\s*\d+\s*(bis|ter|quater)?\s*[,-]?\s*/i, '').trim();
  }

  async function geocodeAddress(query) {
    const status = document.getElementById('addr_status');
    status.textContent = 'Recherche…';
    try {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`;
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error('Lookup failed');
      const data = await resp.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      if (features.length === 0) {
        status.textContent = 'Aucun résultat';
        return null;
      }
      const best = features[0];
      const p = best.properties || {};
      return { number: p.housenumber || '', street: sanitizeStreetName(p.name || ''), postal: p.postcode || '', city: p.city || '', raw: best };
    } catch (e) {
      status.textContent = 'Erreur lors de la recherche';
      return null;
    }
  }

  async function onLookupAddress() {
    const q = document.getElementById('inv_search').value.trim();
    const status = document.getElementById('addr_status');
    if (!q) { status.textContent = 'Enter an address to search'; return; }
    const data = await geocodeAddress(q);
    if (data) {
      document.getElementById('inv_num').value = data.number;
      document.getElementById('inv_street').value = sanitizeStreetName(data.street);
      document.getElementById('inv_postal').value = data.postal;
      document.getElementById('inv_city').value = data.city;
      status.textContent = 'Address filled';
      validateInvoice();
    }
  }

  const searchInput = document.getElementById('inv_search');
  if (searchInput) {
    async function suggestAddresses(query) {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`;
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) return [];
      const data = await resp.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      return features.map(f => ({
        label: f.properties?.label || '',
        number: f.properties?.housenumber || '',
        street: sanitizeStreetName(f.properties?.name || ''),
        postal: f.properties?.postcode || '',
        city: f.properties?.city || '',
      }));
    }

    async function updateSuggestions() {
      const el = document.getElementById('inv_search');
      const menu = document.getElementById('addr_suggestions');
      const q = el.value.trim();
      if (q.length < 3) { menu.style.display = 'none'; menu.innerHTML = ''; return; }
      const sugg = await suggestAddresses(q);
      if (!sugg.length) { menu.style.display = 'none'; menu.innerHTML = ''; return; }
      menu.innerHTML = '';
      sugg.forEach(s => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = s.label;
        item.addEventListener('click', () => {
          document.getElementById('inv_num').value = s.number || '';
          document.getElementById('inv_street').value = s.street || '';
          document.getElementById('inv_postal').value = s.postal || '';
          document.getElementById('inv_city').value = s.city || '';
          document.getElementById('inv_search').value = s.label || '';
          menu.style.display = 'none';
          validateInvoice();
        });
        menu.appendChild(item);
      });
      menu.style.display = '';
    }

    const debounced = debounce(updateSuggestions, 250);
    searchInput.addEventListener('input', debounced);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addr_suggestions').style.display = 'none'; updateSuggestions(); }
    });
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('addr_suggestions');
      if (!menu.contains(e.target) && e.target !== searchInput) menu.style.display = 'none';
    });
  }

  function setCellValue(ws, addr, value) {
    const existing = ws[addr] || {};
    // Preserve existing type if present; otherwise infer minimal type
    if (existing.t == null) existing.t = (typeof value === 'number') ? 'n' : 's';
    existing.v = value;
    ws[addr] = existing;
  }

  // ExcelJS-based export that preserves formatting by writing values only
  async function exportToExcelExcelJS() {
    const status = document.getElementById('inv_status');
    try {
      status.textContent = 'Loading template…';
      const resp = await fetch('./assets/DEVIS.xlsx');
      if (!resp.ok) throw new Error(`Template not found (HTTP ${resp.status})`);
      const ab = await resp.arrayBuffer();

      status.textContent = 'Preparing workbook…';
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(ab);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('No worksheet in template');

      const civChoice = [...document.querySelectorAll('input[name="inv_civ"]')].find(x => x.checked)?.value || 'M.';
      const company   = document.getElementById('inv_company').value.trim();
      const first     = document.getElementById('inv_first').value.trim();
      const last      = document.getElementById('inv_last').value.trim();
      const lastUpper = last.toUpperCase();
      const firstCap  = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
      const fullName  = (civChoice === 'company') ? company.toUpperCase() : `${civChoice} ${lastUpper} ${firstCap}`;

      const num   = document.getElementById('inv_num').value.trim();
      const street= document.getElementById('inv_street').value.trim();
      const postal= document.getElementById('inv_postal').value.trim();
      const city  = document.getElementById('inv_city').value.trim();
      const designation = document.getElementById('inv_designation').value.trim();
      const description = document.getElementById('inv_description').value.trim();
      const typeBien    = document.getElementById('inv_type_bien').value;

      const now = new Date();
      const dd = now.getDate(), mm = now.getMonth() + 1, yyyy = now.getFullYear();
      const todayStr = `${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${yyyy}`;
      const b9Pattern = `${dd}${mm}/${yyyy}`;

      const { total } = calculateTotal();

      status.textContent = 'Filling cells…';
      ws.getCell('B12').value = todayStr;
      ws.getCell('B9').value  = b9Pattern;
      ws.getCell('D8').value  = fullName;
      ws.getCell('D9').value  = `${num}, ${street}`;
      ws.getCell('D10').value = `${postal} ${city}`;
      ws.getCell('E39').value = Number(total);
      ws.getCell('B21').value = designation;
      ws.getCell('B25').value = description;
      ws.getCell('B26').value = `${num}, ${street}`;
      ws.getCell('B27').value = `${postal} ${city}`;
      ws.getCell('A21').value = typeBien;

      status.textContent = 'Creating file…';
      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement('a');
      a.href = url;
      a.download = `DEVIS_${(civChoice === 'company' ? company : lastUpper) || 'CLIENT'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      console.error('[exportToExcelExcelJS] failed:', e);
      status.textContent = `Failed: ${e.message}`;
      throw e;
    }
  }

  // Attach Continue handler robustly after DOM is ready
  (function setupContinueHandler(){
    function attach() {
      const btn = document.getElementById('continueInvoice');
      if (!btn) { return; }
      // Remove any inline onclick to avoid interference
      btn.onclick = null;
      // Avoid multiple bindings
      if (btn.__bound) return; btn.__bound = true;
      btn.addEventListener('click', async () => {
       
        const inv = document.getElementById('stepInvoice');
        if (inv) inv.style.display = '';
        const status = document.getElementById('inv_status');
        if (!validateInvoice()) {
          document.getElementById('inv_error').style.display = '';
          if (status) status.textContent = 'Please complete invoice fields and agree.';
          setTimeout(() => { if (status) status.textContent = ''; }, 4000);
          return;
        }
        if (status) status.textContent = 'Generating…';
        btn.disabled = true;
        try {
          await exportToExcelExcelJS();
          if (status) status.textContent = 'Done. Check your downloads.';
        } catch (e) {
          console.error(e);
          if (status) status.textContent = 'Failed to generate.';
        } finally {
          btn.disabled = false;
          setTimeout(() => { if (status) status.textContent = ''; }, 4000);
        }
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attach);
    } else {
      attach();
    }
  })();

  function normalizePrices(diags, prices) {
    const out = {};
    diags.forEach(d => {
      out[d.id] = out[d.id] || {};
      PACKS.forEach(p => {
        out[d.id][p] = { rent: 0, sale: 0, ...(prices?.[d.id]?.[p] || {}) };
      });
    });
    return out;
  }

  renderDiagnosticsList();
  state.prices = normalizePrices(state.diagnostics, state.prices);
})();
