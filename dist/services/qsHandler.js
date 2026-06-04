"use strict";
// src/services/qsHandler.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQS = generateQS;
const gemini_js_1 = require("./gemini.js");
const qsExtraction_js_1 = require("./qsExtraction.js");
const qsCalculations_js_1 = require("./qsCalculations.js");
const boqPrompts_js_1 = require("../prompts/boqPrompts.js");
const quantityInjector_js_1 = require("./quantityInjector.js");
const excelBuilder_js_1 = require("./excelBuilder.js");
const uuid_1 = require("uuid");
async function generateQS(formData, drawingBase64, drawingMimeType, confirmedFacts) {
    const jobId = (0, uuid_1.v4)();
    console.log(`[QS] Job ${jobId} — ${formData.projectName}`);
    try {
        // ── Step 1: Build drawingFacts from confirmed QS review ──────────────────
        // If the user confirmed facts in the review screen, use those directly.
        // Only re-extract from drawing if no confirmed facts were provided.
        let drawingFacts = {};
        if (confirmedFacts && (confirmedFacts.roofSlope || confirmedFacts.roofSheetSpec || confirmedFacts.factoryFootprint)) {
            // User already reviewed extraction — build drawingFacts from confirmed values
            console.log('[QS] Using QS-confirmed facts (skipping re-extraction)');
            drawingFacts = {
                roofSlope: confirmedFacts.roofSlope || '',
                roofSheetSpec: confirmedFacts.roofSheetSpec || '',
                roofInsulationSpec: confirmedFacts.roofInsulationSpec || '',
                wallCladdingSpec: confirmedFacts.wallCladdingSpec || '',
                structuralSystem: confirmedFacts.structuralSystem || '',
                buildingFootprintFromDrawing: String(confirmedFacts.factoryFootprint || ''),
                totalFloorAreaFromDrawing: String(confirmedFacts.totalArea || ''),
                numberOfFloorsFromDrawing: confirmedFacts.numFloors || '',
                confirmedItems: confirmedFacts.craneInfo
                    ? confirmedFacts.craneInfo.split('\n').filter(Boolean)
                    : []
            };
        }
        else if (drawingBase64 && drawingMimeType) {
            // No confirmed facts — extract fresh from drawing
            console.log('[QS] Re-extracting drawing facts...');
            drawingFacts = await (0, qsExtraction_js_1.extractDrawingFacts)(formData, drawingBase64, drawingMimeType);
        }
        // ── Step 2: Calculate derived values ─────────────────────────────────────
        const criticalFacts = (0, qsCalculations_js_1.validateCriticalFacts)(drawingFacts, formData);
        const geoQtys = (0, qsCalculations_js_1.calculateGeometricQuantities)(drawingFacts, formData.totalArea, formData);
        const craneData = (0, qsCalculations_js_1.extractCraneData)(drawingFacts);
        const buildingPackages = (0, qsCalculations_js_1.identifyBuildingPackages)(drawingFacts, formData.totalArea);
        console.log(`[QS] Geometry: ${geoQtys.factoryLength}×${geoQtys.factoryWidth}m roof=${geoQtys.mainRoofSheetArea}m²`);
        // ── Step 3: Generate Part A and Part B IN PARALLEL ────────────────────────
        console.log('[QS] Generating BOQ Parts A + B in parallel...');
        const [rawA, rawB] = await Promise.all([
            (0, gemini_js_1.geminiText)((0, boqPrompts_js_1.buildPromptA)(formData, criticalFacts, geoQtys, craneData, buildingPackages), 32768),
            (0, gemini_js_1.geminiText)((0, boqPrompts_js_1.buildPromptB)(formData, criticalFacts, geoQtys, craneData, buildingPackages, { totalBase: 0, totalLow: 0, totalHigh: 0 }), 32768)
        ]);
        // ── Step 4: Parse ─────────────────────────────────────────────────────────
        const boqDataA = (0, gemini_js_1.parseGeminiJson)(rawA, 'BOQ Part A') || {};
        const boqDataB = (0, gemini_js_1.parseGeminiJson)(rawB, 'BOQ Part B') || {};
        // ── Step 5: Merge ─────────────────────────────────────────────────────────
        let boqData = {
            ...boqDataA,
            ...boqDataB,
            boqItems: [
                ...(Array.isArray(boqDataA.boqItems) ? boqDataA.boqItems : []),
                ...(Array.isArray(boqDataB.boqItems) ? boqDataB.boqItems : [])
            ]
        };
        // ── Step 6: Grand total using QS parameters ───────────────────────────────
        const partASubtotal = extractSubtotal(boqDataA);
        const partBSubtotal = extractSubtotal(boqDataB);
        const directTotal = partASubtotal + partBSubtotal;
        const prelimPct = (formData.prelimPct || 10) / 100;
        const contingencyPct = (formData.contingencyPct || 15) / 100;
        const profitPct = (formData.profitPct || 8) / 100;
        const vatPct = (formData.vatPct || 10) / 100;
        const prelims = Math.round(directTotal * prelimPct);
        const contingency = Math.round(directTotal * contingencyPct);
        const profit = Math.round(directTotal * profitPct);
        const beforeVAT = directTotal + prelims + contingency + profit;
        const vat = Math.round(beforeVAT * vatPct);
        const totalBase = beforeVAT + vat;
        console.log(`[QS] A=${(partASubtotal / 1e9).toFixed(1)}B  B=${(partBSubtotal / 1e9).toFixed(1)}B  Total=${(totalBase / 1e9).toFixed(1)}B VND`);
        if (boqData.projectSummary) {
            boqData.projectSummary.totalBase = totalBase;
            boqData.projectSummary.totalLow = Math.round(totalBase * 0.75);
            boqData.projectSummary.totalHigh = Math.round(totalBase * 1.35);
        }
        boqData.boqItems?.push(['', '', '', '', '', '', '', '', '', '', 'Section', '', ''], ['P1', '', `Preliminaries (${formData.prelimPct || 10}%)`, 'lot', 1, '', Math.round(prelims * 0.8), prelims, Math.round(prelims * 1.2), 'QS Parameter', 'Estimated', 'Low', ''], ['P2', '', `Contingency (${formData.contingencyPct || 15}%)`, 'lot', 1, '', Math.round(contingency * 0.9), contingency, Math.round(contingency * 1.1), 'QS Parameter', 'Estimated', 'Low', ''], ['P3', '', `Profit / Markup (${formData.profitPct || 8}%)`, 'lot', 1, '', Math.round(profit * 0.9), profit, Math.round(profit * 1.1), 'QS Parameter', 'Confirmed', 'High', ''], ['P4', '', `VAT (${formData.vatPct || 10}%)`, 'lot', 1, '', Math.round(vat * 0.9), vat, Math.round(vat * 1.1), 'QS Parameter', 'Confirmed', 'High', ''], ['TOTAL', '', 'GRAND TOTAL (incl. VAT) — Class D ±30–50%', '', '', '', Math.round(totalBase * 0.75), totalBase, Math.round(totalBase * 1.35), '', 'Summary', '', '']);
        // ── Step 7: Post-processing ───────────────────────────────────────────────
        boqData = (0, quantityInjector_js_1.applyCalculatedQuantities)(boqData, geoQtys);
        boqData = (0, quantityInjector_js_1.ensureRequiredDivisions)(boqData, geoQtys, craneData);
        console.log(`[QS] Final: ${boqData.boqItems?.length || 0} rows`);
        // ── Step 8: Excel ─────────────────────────────────────────────────────────
        const excelBuffer = await (0, excelBuilder_js_1.buildExcelBuffer)(boqData, formData, criticalFacts);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `QS_${formData.projectName.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
        return { success: true, jobId, excelBuffer, filename };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[QS] Job ${jobId} failed:`, message);
        return { success: false, error: message };
    }
}
function extractSubtotal(data) {
    if (!Array.isArray(data.boqItems))
        return 0;
    for (const row of data.boqItems) {
        if (!Array.isArray(row))
            continue;
        const label = String(row[0] || '') + String(row[2] || '');
        if (label.toUpperCase().includes('SUBTOTAL') || label.toUpperCase().includes('TOTAL-')) {
            const val = Number(row[7]);
            if (isFinite(val) && val > 0)
                return val;
        }
    }
    return data.boqItems.reduce((sum, row) => {
        if (!Array.isArray(row))
            return sum;
        const status = String(row[10] || '').toLowerCase();
        if (status === 'section' || status === 'summary')
            return sum;
        const val = Number(row[7]);
        return sum + (isFinite(val) ? val : 0);
    }, 0);
}
