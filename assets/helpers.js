export function q(id){ return document.getElementById(id); }
export function safeOn(id, ev, handler){
  const el = q(id);
  if (!el) { console.warn(`safeOn: missing element #${id}`); return; }
  try { el.addEventListener(ev, handler); }
  catch (e) { console.error(`safeOn attach failed #${id}`, e); }
}
export function getVal(id){ const el = q(id); if(!el) return ''; return (el.value == null) ? '' : String(el.value).trim(); }
export function getChecked(id){ const el = q(id); return !!(el && el.checked); }
export function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
export function debounce(fn, delay){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), delay); }; }
export function setStatusText(el, txt){ if (!el) return; el.textContent = txt; }