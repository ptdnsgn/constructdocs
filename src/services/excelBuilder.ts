// src/services/excelBuilder.ts
// Builds the 8-tab Excel workbook from BOQ data using exceljs.

import ExcelJS from 'exceljs';
import { BOQData, FormData, CriticalFacts } from '../types/index.js';

// ── Colour palette ────────────────────────────────────────────────────────────
const COLOURS = {
  headerBg:    '1F3864',  // dark navy
  headerFg:    'FFFFFF',
  sectionBg:   'D6E4F0',  // light blue
  sectionFg:   '1F3864',
  totalBg:     '1F3864',
  totalFg:     'FFFFFF',
  estimatedBg: 'FFFFFF',
  tbcBg:       'FFF2CC',  // light yellow — flags TBC rows
  altRowBg:    'F2F7FC',
  confirmed:   'E2EFDA',  // light green
  specialist:  'FCE4D6'   // light orange
};

function currency(num: number | string): string {
  const n = Number(num);
  return isFinite(n) ? n.toLocaleString('vi-VN') : String(num);
}

export async function buildExcelBuffer(
  boqData: BOQData,
  formData: FormData,
  criticalFacts: CriticalFacts
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ConstructDocs v2';
  wb.created = new Date();

  // ── Sheet 1: Summary ─────────────────────────────────────────────────────
  buildSummarySheet(wb, boqData, formData, criticalFacts);

  // ── Sheet 2: BOQ ─────────────────────────────────────────────────────────
  buildBOQSheet(wb, boqData);

  // ── Sheet 3: Take-Off ────────────────────────────────────────────────────
  buildGenericSheet(wb, '📐 Take-Off', boqData.takeOffDetail || [], [
    'No.', 'Element', 'Source', 'Method', 'Dim A', 'Dim B', 'Factor', 'Net Qty', 'Unit', 'Notes'
  ]);

  // ── Sheet 4: Assumptions ─────────────────────────────────────────────────
  buildGenericSheet(wb, '📝 Assumptions', boqData.assumptions || [], [
    'ID', 'Element', 'Assumption Made', 'Value Used', 'Basis', 'Impact if Wrong', 'Priority'
  ]);

  // ── Sheet 5: RFI / Clarification ─────────────────────────────────────────
  buildGenericSheet(wb, '❓ RFI', boqData.clarificationQuestions || [], [
    'No.', 'Question', 'What It Affects', 'Impact if Unanswered', 'Priority'
  ]);

  // ── Sheet 6: Risk Register ────────────────────────────────────────────────
  buildGenericSheet(wb, '⚠️ Risk Register', boqData.riskRegister || [], [
    'No.', 'Risk Description', 'Category', 'Probability', 'Cost Impact (VND)', 'Action Required'
  ]);

  // ── Sheet 7: Hidden Items ─────────────────────────────────────────────────
  buildGenericSheet(wb, '🔍 Hidden Items', boqData.hiddenItemsChecklist || [], [
    'Item', 'Category', 'Included in Scope?', 'In BOQ?', 'Notes'
  ]);

  // ── Sheet 8: Cross-Check ─────────────────────────────────────────────────
  buildGenericSheet(wb, '✅ Cross-Check', boqData.crossCheck || [], [
    'Element', 'This Estimate (VND/m²)', 'Benchmark Low', 'Benchmark High', 'Within Range?', 'Notes'
  ]);

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as Buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Sheet
// ─────────────────────────────────────────────────────────────────────────────
function buildSummarySheet(
  wb: ExcelJS.Workbook,
  boqData: BOQData,
  formData: FormData,
  cf: CriticalFacts
): void {
  const ws = wb.addWorksheet('📊 Summary');
  ws.columns = [
    { width: 30 }, { width: 50 }, { width: 20 }
  ];

  const addHeader = (title: string) => {
    const row = ws.addRow([title]);
    row.font = { bold: true, color: { argb: 'FF' + COLOURS.headerFg }, size: 11 };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOURS.headerBg } };
    ws.mergeCells(`A${row.number}:C${row.number}`);
  };

  const addRow = (label: string, value: string | number, highlight = false) => {
    const row = ws.addRow([label, value]);
    if (highlight) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOURS.confirmed } };
    }
    row.getCell(1).font = { bold: true };
  };

  addHeader('PRELIMINARY QS COST ESTIMATE — PROJECT SUMMARY');
  ws.addRow([]);

  addHeader('PROJECT INFORMATION');
  addRow('Project Name', formData.projectName);
  addRow('Client', formData.clientName);
  addRow('Location', formData.location);
  addRow('Building Type', formData.buildingType);
  addRow('Specification Level', formData.specLevel);
  addRow('Total Floor Area', `${formData.totalArea} m²`);
  addRow('Prepared By', formData.createdBy);
  addRow('Date', new Date().toLocaleDateString('vi-VN'));
  ws.addRow([]);

  addHeader('ESTIMATE SUMMARY');
  const ps = boqData.projectSummary;
  const totalBase  = ps?.totalBase  || 0;
  const totalLow   = ps?.totalLow   || Math.round(totalBase * 0.75);
  const totalHigh  = ps?.totalHigh  || Math.round(totalBase * 1.35);

  addRow('Estimate Class', 'Class D — Order of Magnitude (±30% to ±50%)');
  addRow('Total (Low Scenario)',  `${currency(totalLow)} VND`,  false);
  addRow('Total (Base Scenario)', `${currency(totalBase)} VND`, true);
  addRow('Total (High Scenario)', `${currency(totalHigh)} VND`, false);
  const gfa = cf.factoryFootprint || formData.totalArea;
  if (gfa > 0 && totalBase > 0) {
    addRow('Rate per m² GFA (Base)', `${currency(Math.round(totalBase / gfa))} VND/m²`);
  }
  ws.addRow([]);

  addHeader('CONFIRMED INFORMATION (FROM DRAWING)');
  if (cf.roofSlope)          addRow('Roof Slope',     cf.roofSlope,          true);
  if (cf.roofSheetSpec)      addRow('Roof Sheet',      cf.roofSheetSpec,      true);
  if (cf.roofInsulationSpec) addRow('Insulation',      cf.roofInsulationSpec, true);
  if (cf.wallCladdingSpec)   addRow('Wall Cladding',   cf.wallCladdingSpec,   true);
  if (cf.structuralSystem)   addRow('Structural System', cf.structuralSystem, true);
  if (!cf.roofSlope && !cf.roofSheetSpec) {
    ws.addRow(['No confirmed information extracted from drawing.', '', '']);
  }
  ws.addRow([]);

  addHeader('EXCLUSIONS');
  const exclusions = [
    'VAT (10%)',
    'MEP systems (electrical, plumbing, HVAC, fire fighting) — allowance only',
    'Furniture and loose equipment',
    'Land cost and legal fees',
    'Detailed geotechnical investigation',
    'Authority fees and permits'
  ];
  exclusions.forEach(e => ws.addRow(['', e, '']));
}

// ─────────────────────────────────────────────────────────────────────────────
// BOQ Sheet
// ─────────────────────────────────────────────────────────────────────────────
function buildBOQSheet(wb: ExcelJS.Workbook, boqData: BOQData): void {
  const ws = wb.addWorksheet('📋 BOQ');

  ws.columns = [
    { header: 'No.',              key: 'no',       width: 8  },
    { header: 'Section',          key: 'section',  width: 10 },
    { header: 'Description',      key: 'desc',     width: 50 },
    { header: 'Unit',             key: 'unit',     width: 8  },
    { header: 'Qty',              key: 'qty',      width: 12 },
    { header: 'Rate Range (VND)', key: 'rate',     width: 22 },
    { header: 'Amount Low (VND)', key: 'low',      width: 18 },
    { header: 'Amount Base (VND)',key: 'base',     width: 18 },
    { header: 'Amount High (VND)',key: 'high',     width: 18 },
    { header: 'Source',           key: 'source',   width: 22 },
    { header: 'Status',           key: 'status',   width: 20 },
    { header: 'Confidence',       key: 'conf',     width: 12 },
    { header: 'Remarks',          key: 'remarks',  width: 30 }
  ];

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOURS.headerBg } };
  headerRow.alignment = { wrapText: true, vertical: 'middle' };
  headerRow.height = 30;

  let altRow = false;
  (boqData.boqItems || []).forEach(row => {
    if (!Array.isArray(row)) return;

    const status = String(row[10] || '').toLowerCase();
    const isSection = status === 'section';
    const isSummary = status === 'summary';
    const isTBC     = String(row[4] || '').trim() === 'TBC';
    const isSpecialist = String(row[10] || '').toLowerCase().includes('specialist');

    const exRow = ws.addRow(row);

    if (isSection) {
      exRow.font = { bold: true, color: { argb: 'FF' + COLOURS.sectionFg } };
      exRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOURS.sectionBg } };
      ws.mergeCells(`C${exRow.number}:M${exRow.number}`);
    } else if (isSummary) {
      exRow.font = { bold: true, color: { argb: 'FF' + COLOURS.totalFg } };
      exRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOURS.totalBg } };
    } else if (isTBC) {
      exRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOURS.tbcBg } };
    } else if (isSpecialist) {
      exRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOURS.specialist } };
    } else {
      altRow = !altRow;
      if (altRow) {
        exRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOURS.altRowBg } };
      }
    }

    // Right-align numeric columns
    [5, 7, 8, 9].forEach(col => {
      const cell = exRow.getCell(col);
      if (typeof cell.value === 'number') {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0';
      }
    });
  });

  // Freeze header row
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic sheet builder (Take-Off, Assumptions, RFI, Risk, Hidden, CrossCheck)
// ─────────────────────────────────────────────────────────────────────────────
function buildGenericSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: unknown[][],
  headers: string[]
): void {
  const ws = wb.addWorksheet(name);
  ws.columns = headers.map(h => ({ header: h, width: Math.max(h.length + 4, 20) }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOURS.headerBg } };

  let alt = false;
  rows.forEach(row => {
    if (!Array.isArray(row) || row[0] === headers[0]) return; // skip duplicate headers
    const exRow = ws.addRow(row);
    alt = !alt;
    if (alt) {
      exRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOURS.altRowBg } };
    }
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
}
