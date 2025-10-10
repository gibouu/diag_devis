import { q, getVal, getChecked } from './helpers.js';
import { calculateTotal, getDisplayPackLabel } from './calc.js';

function upperSafe(str){ return (str || '').toUpperCase(); }
function capitalize(str){
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export async function exportToExcelExcelJS(){
  const status = q('inv_status');
  if (status) status.textContent = 'Loading template…';
  try {
    const resp = await fetch('./assets/DEVIS.xlsx');
    if (!resp.ok) throw new Error(`Template not found (HTTP ${resp.status})`);
    const ab = await resp.arrayBuffer();

    if (status) status.textContent = 'Preparing workbook…';
    if (typeof ExcelJS === 'undefined') throw new Error('ExcelJS not loaded');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(ab);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error('No worksheet in template');

    const civChoice = [...document.querySelectorAll('input[name="inv_civ"]')].find(x => x.checked)?.value || 'M.';
    const company = getVal('inv_company');
    const first = getVal('inv_first');
    const last = getVal('inv_last');
    const allowNoFirst = getChecked('inv_no_first');
    const lastUpper = upperSafe(last);
    const firstCap = capitalize(first);
    let fullName;
    if (civChoice === 'company') {
      fullName = upperSafe(company);
    } else if (civChoice === 'both' || civChoice === 'M_MME') {
      fullName = `M. et Mme ${lastUpper}`;
    } else if (!firstCap && allowNoFirst) {
      fullName = `${civChoice} ${lastUpper}`.trim();
    } else {
      fullName = `${civChoice} ${lastUpper} ${firstCap}`.trim();
    }

    const num = getVal('inv_num');
    const street = getVal('inv_street');
    const postal = getVal('inv_postal');
    const city = getVal('inv_city');
    const designation = getVal('inv_designation');
    const description = getVal('inv_description');
    const typeBien = getVal('inv_type_bien');

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;
    const b9Pattern = `${dd}${mm}/${yyyy}`;

    const { area, total, packSummary, erpSelected } = calculateTotal();

    let derivedTypeBien = typeBien;
    if (typeBien === 'APPARTEMENT') {
      const packLabel = getDisplayPackLabel(area);
      derivedTypeBien = packLabel ? `APPARTEMENT ${packLabel}` : typeBien;
    }

    const displayType = (() => {
      if (!derivedTypeBien) return '';
      const parts = String(derivedTypeBien).split(/\s+/);
      return parts.map((part, idx) => {
        if (!part) return part;
        if (idx === 0) return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        return part.toUpperCase();
      }).join(' ');
    })();

    const nonERPNames = packSummary?.names || [];
    const packPart = (packSummary?.count > 0) ? `1 Pack ${nonERPNames.join(', ')}` : '';
    const erpPart = erpSelected ? 'ERP (incl. sonorisation, solarisation)' : '';
    const longSentence = [packPart, erpPart].filter(Boolean).join(' · ');

    if (status) status.textContent = 'Filling cells…';
    ws.getCell('B12').value = todayStr;
    ws.getCell('B9').value = b9Pattern;
    ws.getCell('D8').value = fullName;
    ws.getCell('D9').value = `${num}, ${street}`;
    ws.getCell('D10').value = `${postal} ${city}`;
    ws.getCell('E39').value = Number(total);
    ws.getCell('B21').value = designation;
    ws.getCell('B26').value = `${num}, ${street}`;
    ws.getCell('B27').value = `${postal} ${city}`;
    ws.getCell('A21').value = displayType;

    if (status) status.textContent = 'Creating file…';
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DEVIS_${(civChoice === 'company' ? company : lastUpper) || 'CLIENT'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    console.error('[exportToExcelExcelJS] failed', error);
    if (status) status.textContent = `Failed: ${error.message}`;
    throw error;
  }
}
