import { q, safeOn, getVal, getChecked, debounce, setStatusText } from './helpers.js';
import { calculateTotal, getDisplayPackLabel } from './calc.js';
import { renderDiagnosticsList } from './diagnostics.js';

// export validateInvoice, syncInvoiceFromSelections, setupContinueHandler, setupCivVisibility, onLookupAddress
export function validateInvoice(){ /* paste logic from app.js validateInvoice */ }
export function syncInvoiceFromSelections(){ /* paste existing sync logic */ }
export function setupCivVisibility(){ /* paste civ visibility logic */ }
export function setupContinueHandler(){ /* paste continue handler logic (attach listeners) */ }

// optional: address lookup helpers used by invoice
export async function geocodeAddress(qs){ /* copy existing helper */ }
export async function onLookupAddress(){ /* copy existing onLookupAddress */ }