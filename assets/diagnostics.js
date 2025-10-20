import { q } from './helpers.js';
import { state, updateState } from './state.js';

// paste/tweak your renderDiagnosticsList / toggleSelectedDiagnostic / getSelectedDiagnostics here
export function toggleSelectedDiagnostic(id){
  const set = new Set(state.selectedDiagIds || []);
  if (set.has(id)) set.delete(id); else set.add(id);
  updateState({ selectedDiagIds: Array.from(set) });
}
export function getSelectedDiagnostics(){
  const purpose = [...document.querySelectorAll('input[name="purpose"]')].find(r => r.checked)?.value || 'rent';
  const selectedIds = new Set(state.selectedDiagIds || []);
  return state.diagnostics.filter(d => {
    if (!selectedIds.has(d.id)) return false;
    if (purpose === 'rent' && d.id === 'TERMITES') return false;
    return true;
  });
}
export function renderDiagnosticsList(){
  const list = q('diagnosticsList');
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
    chip.textContent = diag.name + (disabled ? ' (vente uniquement)' : '');
    chip.disabled = disabled;
    chip.addEventListener('click', () => { toggleSelectedDiagnostic(diag.id); renderDiagnosticsList(); });
    list.appendChild(chip);
  });
}
