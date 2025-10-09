import { makeDefaultPrices as _makeDefaultPrices, seedSpecDefaults as _seedSpecDefaults } from './_placeholders.js';
// (or paste existing implementations below)
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

export const storage = {
  getState() { try{ const raw = localStorage.getItem('diagnostics_pricer_state'); if(!raw) return null; return JSON.parse(raw);}catch{return null;} },
  setState(s){ localStorage.setItem('diagnostics_pricer_state', JSON.stringify(s)); }
};

export let state = storage.getState() || {
  diagnostics: DEFAULT_DIAGNOSTICS,
  prices: _seedSpecDefaults(_makeDefaultPrices(DEFAULT_DIAGNOSTICS)),
  selectedDiagIds: [],
  propType: 'apartment'
};

export function setState(next){ state = next; storage.setState(state); }
export function updateState(part){ state = { ...state, ...part }; storage.setState(state); }