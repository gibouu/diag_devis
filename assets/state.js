export const DEFAULT_DIAGNOSTICS = [
  { id: 'AMIANTE', name: 'AMIANTE' },
  { id: 'DPE', name: 'DPE' },
  { id: 'CARREZ_BOUTIN', name: 'CARREZ/BOUTIN' },
  { id: 'PLOMB', name: 'PLOMB' },
  { id: 'TERMITES', name: 'TERMITES' },
  { id: 'GAZ', name: 'GAZ' },
  { id: 'ELECTRICITE', name: 'ELECTRICITE' },
  { id: 'ERP', name: 'ERP' }
];
export const PACKS = ['F1','F2','F3','F4','F5','F6+'];
export const PURPOSES = ['rent','sale'];

const STORAGE_KEY = 'diagnostics_pricer_state';

function clearPersistedState(){
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage access issues (e.g. private mode)
  }
}

export const storage = {
  getState() {
    clearPersistedState();
    return null;
  },
  setState(){
    clearPersistedState();
  }
};

export function makeDefaultPrices(diags = DEFAULT_DIAGNOSTICS){
  const prices = {};
  diags.forEach((diag) => {
    prices[diag.id] = {};
    PACKS.forEach((pack) => {
      prices[diag.id][pack] = { rent: 0, sale: 0 };
    });
  });
  return prices;
}

export function seedSpecDefaults(prices){
  const order = ['AMIANTE','DPE','CARREZ_BOUTIN','PLOMB','TERMITES','GAZ','ELECTRICITE','ERP'];
  const seedByPack = {
    F1: [100,120,120,130,100,130,130,40],
    F2: [100,120,120,130,100,130,130,40],
    F3: [120,140,140,150,130,130,130,40],
    F4: [120,190,160,170,130,130,130,40],
    F5: [130,190,180,190,160,130,130,40]
  };
  order.forEach((id, idx) => {
    Object.entries(seedByPack).forEach(([pack, seedArray]) => {
      prices[id] = prices[id] || {};
      prices[id][pack] = prices[id][pack] || { rent: 0, sale: 0 };
      const value = seedArray[idx];
      prices[id][pack].rent = value;
      prices[id][pack].sale = value;
    });
  });
  return prices;
}

export function normalizePrices(diags, prices){
  const next = {};
  diags.forEach((diag) => {
    next[diag.id] = next[diag.id] || {};
    PACKS.forEach((pack) => {
      next[diag.id][pack] = { rent: 0, sale: 0, ...(prices?.[diag.id]?.[pack] || {}) };
    });
  });
  return next;
}

export let state = storage.getState() || {
  diagnostics: DEFAULT_DIAGNOSTICS,
  prices: seedSpecDefaults(makeDefaultPrices(DEFAULT_DIAGNOSTICS)),
  selectedDiagIds: [],
  propType: 'apartment'
};
state.prices = normalizePrices(state.diagnostics, state.prices);

export function setState(next){
  const merged = { ...state, ...next };
  const diagnostics = merged.diagnostics || state.diagnostics;
  const prices = merged.prices || state.prices;
  state = {
    ...merged,
    diagnostics,
    prices: normalizePrices(diagnostics, prices)
  };
  const persistable = { ...state, selectedDiagIds: [] };
  storage.setState(persistable);
}
export function updateState(part){
  setState({ ...state, ...part });
}
