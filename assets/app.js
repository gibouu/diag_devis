(function(){
  // Quick runtime error reporting to surface the real failure
  window.addEventListener('error', (ev) => {
    console.error('[runtime error]', ev.error || ev.message, (ev.filename || '') + ':' + (ev.lineno||0) + ':' + (ev.colno||0));
    const s = document.getElementById('inv_status'); if (s) s.textContent = 'Runtime error: see console';
  });
  window.addEventListener('unhandledrejection', (ev) => {
    console.error('[unhandledrejection]', ev.reason);
    const s = document.getElementById('inv_status'); if (s) s.textContent = 'Promise rejection: see console';
  });

  // Safe DOM helpers to avoid TypeErrors when elements are missing
  function q(id){ return document.getElementById(id); }
  function safeOn(id, ev, handler){
    const el = q(id);
    if (!el) { console.warn(`safeOn: missing element #${id}`); return; }
    try { el.addEventListener(ev, handler); }
    catch (e) { console.error(`safeOn attach failed #${id}`, e); }
  }

  // Safe form accessors: return trimmed string or boolean without throwing if node missing
  function getVal(id) {
    const el = q(id);
    if (!el) return '';
    // support inputs/selects/textarea
    return (el.value == null) ? '' : String(el.value).trim();
  }
  function getChecked(id) {
    const el = q(id);
    return !!(el && el.checked);
  }
  function setStatusText(s, txt) { if (s) s.textContent = txt; }

  // Config and persistence
  const DEFAULT_DIAGNOSTICS = [
    { id: 'AMIANTE', name: 'AMIANTE' },
    { id: 'DPE', name: 'DPE' },
    { id: 'CARREZ_BOUTIN', name: 'CARREZ/BOUTIN' },
    { id: 'PLOMB', name: 'PLOMB' },
    { id: 'TERMITES', name: 'TERMITES' },
    { id: 'GAZ', name: 'GAZ' },
    { id: 'ELECTRICITE', name: 'ELECTRICITE' },
    { id: 'ERP', name: 'ERP' } // optional ERP diagnostic (can be selected or billed as addon)
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
    // include ERP at the end of the order and provide a base price (40) for ERP across packs
    const order = ['AMIANTE','DPE','CARREZ_BOUTIN','PLOMB','TERMITES','GAZ','ELECTRICITE','ERP'];
    const f1 = [100,120,120,130,100,130,130,40];
    const f2 = [100,120,120,130,100,130,130,40];
    const f3 = [120,140,140,150,130,130,130,40];
    const f4 = [120,190,160,170,130,130,130,40];
    const f5 = [130,190,180,190,160,130,130,40];
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
    // safe reads
    const purpose = [...document.querySelectorAll('input[name="purpose"]')].find(r => r.checked)?.value || 'rent';
    const area = Math.max(0, Number(getVal('area') || 0));
    const pack = derivePackFromArea(area);
    const derivedPackEl = q('derivedPack');
    if (derivedPackEl) derivedPackEl.textContent = getDisplayPackLabel(area);

    const optStudette = getChecked('opt_studette');
    const optAgent = getChecked('opt_agent');
    const optPavilion = (state.propType === 'house');

    // selectedAll may include ERP; ERP must NOT count towards pack/bundles
    const selectedAll = getSelectedDiagnostics(); // objects with id,name
    const erpSelected = selectedAll.some(s => s.id === 'ERP');
    const selectedNonERP = selectedAll.filter(s => s.id !== 'ERP'); // used for pack/bundle

    const factor = area <= 100 ? 1 : (area / 100);
    const jobType = [...document.querySelectorAll('input[name="jobType"]')].find(r => r.checked)?.value || 'normal';

    // special job types keep original behavior; ERP only added if selected
    if (jobType === 'parking') {
      // represent the bundle via packSummary only; do not push a duplicate priced line
      const base = 170;
      let total = base;
      const packSummary = { names: ['AMIANTE','TERMITES'], count: 2, price: base, factor: 1, bundle: true };
      const lines = [];
      if (erpSelected) {
        const erpBase = Number(state.prices?.['ERP']?.[pack]?.[purpose] ?? 40);
        const erpPrice = optAgent ? 0 : erpBase;
        total += erpPrice;
        lines.push({ name: optAgent ? 'ERP (agent - free)' : 'ERP avec Nuisances Sonores Aériennes', pack, purpose, base: erpBase, factor: 1, price: erpPrice });
      }
      return { area, pack, purpose, factor: 1, lines, total: roundCurrency(total), packSummary, erpSelected };
    }
    if (jobType === 'cave') {
      const base = 170;
      let total = base;
      const packSummary = { names: ['CAVE'], count: 1, price: base, factor: 1, bundle: true };
      const lines = [];
      if (erpSelected) {
        const erpBase = Number(state.prices?.['ERP']?.[pack]?.[purpose] ?? 40);
        const erpPrice = optAgent ? 0 : erpBase;
        total += erpPrice;
        lines.push({ name: optAgent ? 'ERP (agent - free)' : 'ERP avec Nuisances Sonores Aériennes', pack, purpose: 'sale', base: erpBase, factor: 1, price: erpPrice });
      }
      return { area, pack, purpose: 'sale', factor: 1, lines, total: roundCurrency(total), packSummary, erpSelected };
    }

    let lines = [];
    let diagnosticsSubtotal = 0;

    const count = selectedNonERP.length; // ERP excluded for counting/bundles
    const band = getAreaBand(area);
    const bundleMap = BUNDLE_PRICES[band]?.[purpose] || {};
    let usedBundle = false;

    if (count >= 2 && bundleMap[count]) {
      // bundle applies only to non-ERP diagnostics
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
    if (optPavilion) {
      addonsSubtotal += 50;
      lines.push({ name: 'Pavilion / House surcharge', pack, purpose, base: 50, factor: 1, price: 50 });
    }

    // ERP is always an addon (never part of pack). Add it only if selected.
    if (erpSelected) {
      const pricePack = area > 100 ? 'F5' : pack;
      const erpBase = Number(state.prices?.['ERP']?.[pricePack]?.[purpose] ?? 40);
      const erpPrice = optAgent ? 0 : roundCurrency(erpBase * (area <= 100 ? 1 : factor));
      addonsSubtotal += erpPrice;
      lines.push({ name: optAgent ? 'ERP (agent - free)' : 'EERP avec Nuisances Sonores Aériennes', pack, purpose, base: erpBase, factor: (area <= 100 ? 1 : factor), price: erpPrice });
    }

    const total = roundCurrency(diagnosticsSubtotal + addonsSubtotal);
    const selectedNames = selectedNonERP.map(s => s.name); // non-ERP names for packSummary
    const packSummary = { names: selectedNames, count, price: diagnosticsSubtotal, factor: (area <= 100 ? 1 : factor), bundle: usedBundle };
    return { area, pack, purpose, factor, lines, total, packSummary, erpSelected };
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
    const agree = getChecked('agree_terms');
    let hasName;
    if (civ === 'company') hasName = company.length > 0;
    else if (civ === 'both' || civ === 'M_MME') hasName = last.length > 0;
    else hasName = allowNoFirst ? (last.length > 0) : (first.length > 0 && last.length > 0);
    const ok = hasName && num && street && postal && city && designation && description && typeBien && agree;
    const btn = q('continueInvoice'); if (btn) btn.disabled = !ok;
    const invErr = q('inv_error'); if (invErr) invErr.style.display = ok ? 'none' : '';
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

  // use safe helpers (q / safeOn) so missing elements don't throw
  safeOn('nextToType', 'click', () => {
    const btn = q('nextToType'); if (btn) btn.style.display = 'none';
    const step = q('stepType'); if (step) step.style.display = '';
  });
  safeOn('nextToPurpose', 'click', () => {
    const btn = q('nextToPurpose'); if (btn) btn.style.display = 'none';
    const step = q('stepPurpose'); if (step) step.style.display = '';
  });
  safeOn('nextToDiags', 'click', () => {
    const btn = q('nextToDiags'); if (btn) btn.style.display = 'none';
    const step = q('stepDiags'); if (step) step.style.display = '';
    // render diagnostics once visible
    if (typeof renderDiagnosticsList === 'function') renderDiagnosticsList();
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
      const company   = getVal('inv_company');
      const first     = getVal('inv_first');
      const last      = getVal('inv_last');
      // support an explicit "no first name" checkbox (optional)
      const allowNoFirst = getChecked('inv_no_first');
       const lastUpper = last.toUpperCase();
       const firstCap = first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
       let fullName;
       if (civChoice === 'company') {
         fullName = company.toUpperCase();
       } else if (civChoice === 'both' || civChoice === 'M_MME') {
         // "M. et Mme LAST"
         fullName = `M. et Mme ${lastUpper}`;
       } else {
         // M. or Mme — if first is missing but allowed, omit it
         fullName = `${civChoice} ${lastUpper}` + (firstCap && !(!firstCap && allowNoFirst) ? ` ${firstCap}` : '');
       }
 
      const num   = getVal('inv_num');
      const street= getVal('inv_street');
      const postal= getVal('inv_postal');
      const city  = getVal('inv_city');
      const designation = getVal('inv_designation');
      const description = getVal('inv_description');
      const typeBien    = getVal('inv_type_bien');

      const now = new Date();
      const dd = now.getDate(), mm = now.getMonth() + 1, yyyy = now.getFullYear();
      const todayStr = `${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${yyyy}`;
      const b9Pattern = `${dd}${mm}/${yyyy}`;

      const { area, pack, purpose, factor, lines, total, packSummary, erpSelected } = calculateTotal();

      // Derive the apartment type from area/pack so the devis matches the calculated size/price
      let derivedTypeBien = typeBien;
      if (typeBien === 'APPARTEMENT') {
        // Show F3/F4 based on calculated size
        const packLabel = getDisplayPackLabel(area);
        derivedTypeBien = packLabel ? `APPARTEMENT ${packLabel}` : typeBien;
      }

      // Build a clear short sentence starting with '1 pack' using non-ERP diagnostics
      const nonERPNames = packSummary?.names || [];
      const packPart = (packSummary?.count > 0) ? `1 Pack ${nonERPNames.join(', ')}` : '';
      const erpPart = erpSelected ? 'ERP avec Nuisances Sonores Aériennes' : '';
      const longSentence = [packPart, erpPart].filter(Boolean).join(' · ');

      status.textContent = 'Filling cells…';
      ws.getCell('B12').value = todayStr;
      ws.getCell('B9').value  = b9Pattern;
      ws.getCell('D8').value  = fullName;
      ws.getCell('D9').value  = `${num}, ${street}`;
      ws.getCell('D10').value = `${postal} ${city}`;
      ws.getCell('E39').value = Number(total);
      ws.getCell('B21').value = designation;
      // append long sentence to the description only when non-empty
      ws.getCell('B25').value = description + (longSentence ? ` — ${longSentence}` : '');
      ws.getCell('B26').value = `${num}, ${street}`;
      ws.getCell('B27').value = `${postal} ${city}`;
      // set the apartment/type field to the derived value
      ws.getCell('A21').value = derivedTypeBien;

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

  // Sync invoice fields (designation, description, type) from current selections
  function syncInvoiceFromSelections() {
    try {
      const area = Number(getVal('area') || 0);
      const res = calculateTotal(); // safe: calculateTotal uses getVal/getChecked
      const packLabel = getDisplayPackLabel ? getDisplayPackLabel(area) : (res?.pack || '');
      const packSummary = res?.packSummary || { names: [], count: 0 };
      const erpSelected = !!res?.erpSelected;
      const jobType = [...document.querySelectorAll('input[name="jobType"]')].find(r => r.checked)?.value || 'normal';
      const propType = [...document.querySelectorAll('input[name="propType"]')].find(r => r.checked)?.value || 'apartment';

      // Build designation: pack part (non-ERP diagnostics) + ERP part if selected
      const nonERPNames = Array.isArray(packSummary.names) ? packSummary.names : [];
      const packPart = (packSummary.count > 0) ? `1 Pack ${nonERPNames.join(', ')}` : '';
      const erpPart = erpSelected ? 'ERP avec Nuisances Sonores Aériennes' : '';
      const designation = [packPart, erpPart].filter(Boolean).join(' · ');

      // Write to DOM safely — BACKGROUND/derived values take precedence
      const desEl = q('inv_designation');
      if (desEl) {
        // Always set derived designation (background precedence). Clear if empty.
        desEl.value = designation || '';
      }

      // Description: show derived pack + area (keeps existing user text if nothing derived)
      const descEl = q('inv_description');
      if (descEl) {
        // Always set derived description when available, otherwise leave empty
        descEl.value = packLabel ? `${packLabel} — ${Math.round(area)} m²` : '';
      }

      // Type de bien select: set according to jobType / propType
      const typeEl = q('inv_type_bien');
      if (typeEl) {
        // Build a user-friendly value. For apartments include the pack label (APPARTEMENT F3/F4/etc.)
        let newVal;
        if (jobType === 'cave') newVal = 'CAVE';
        else if (jobType === 'parking') newVal = 'PARKING';
        else {
          newVal = (propType === 'house') ? 'MAISON' : (packLabel ? `APPARTEMENT ${packLabel}` : 'APPARTEMENT');
        }
        // If it's a <select>, ensure the option exists then set value; otherwise set .value directly
        if (typeEl.tagName === 'SELECT') {
          const exists = Array.from(typeEl.options).some(o => o.value === newVal || o.text === newVal);
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = newVal; opt.text = newVal;
            typeEl.appendChild(opt);
          }
        }
        typeEl.value = newVal;
      }
    } catch (e) {
      console.warn('syncInvoiceFromSelections failed', e);
    }
  }

  // Hook sync to relevant inputs / interactions
  (function attachSyncHooks(){
    safeOn('area', 'input', syncInvoiceFromSelections);
    document.querySelectorAll('input[name="purpose"]').forEach(el => el.addEventListener('change', syncInvoiceFromSelections));
    document.querySelectorAll('input[name="jobType"]').forEach(el => el.addEventListener('change', syncInvoiceFromSelections));
    document.querySelectorAll('input[name="propType"]').forEach(el => el.addEventListener('change', syncInvoiceFromSelections));
    safeOn('opt_agent', 'change', syncInvoiceFromSelections);
    safeOn('opt_studette', 'change', syncInvoiceFromSelections);

    // diagnostics list delegation — catch clicks in that container
    const diagList = q('diagnosticsList');
    if (diagList) {
      diagList.addEventListener('click', () => {
        // small delay if the click toggles selection code elsewhere
        setTimeout(syncInvoiceFromSelections, 50);
      });
    }

    // recalc / UI buttons
    safeOn('calc', 'click', () => { setTimeout(syncInvoiceFromSelections, 50); });
    // run once on load
    setTimeout(syncInvoiceFromSelections, 100);
  })();

  renderDiagnosticsList();
  state.prices = normalizePrices(state.diagnostics, state.prices);
})();
(function setupCivVisibility(){
  function updateCivVisibility(){
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
    // Run validate so button state updates
    if (typeof validateInvoice === 'function') validateInvoice();
  }

  document.querySelectorAll('input[name="inv_civ"]').forEach(r => r.addEventListener('change', updateCivVisibility));
  // also update on load
  setTimeout(updateCivVisibility, 20);
})();
