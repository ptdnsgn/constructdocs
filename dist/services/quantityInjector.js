"use strict";
// src/services/quantityInjector.ts
// Runs after Gemini generates the BOQ.
// 1. Replaces TBC quantities with calculated values.
// 2. Adds Divisions 23, 33, 34, 35 if Gemini omitted them.
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCalculatedQuantities = applyCalculatedQuantities;
exports.ensureRequiredDivisions = ensureRequiredDivisions;
function safeInt(val, fallback) {
    const n = Number(val);
    return isFinite(n) && n > 0 && n < 500000 ? Math.round(n) : fallback;
}
// ── Parse Low and High from a rate range string like "200,000–500,000" ───────
function computeAmounts(rateRange, qty) {
    if (!rateRange || !qty)
        return null;
    const clean = String(rateRange).replace(/,/g, '').replace(/\s/g, '');
    const parts = clean.split(/[–\-]/);
    if (parts.length < 2)
        return null;
    const lo = parseFloat(parts[0]);
    const hi = parseFloat(parts[parts.length - 1]);
    if (!lo || !hi || lo <= 0)
        return null;
    return {
        low: Math.round(lo * qty),
        base: Math.round(((lo + hi) / 2) * qty),
        high: Math.round(hi * qty)
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// applyCalculatedQuantities
// ─────────────────────────────────────────────────────────────────────────────
function applyCalculatedQuantities(boqData, geoQtys) {
    if (!boqData.boqItems?.length)
        return boqData;
    const gq = {
        factoryFootprint: safeInt(geoQtys.factoryFootprint, 8498),
        mainRoofSheetArea: safeInt(geoQtys.mainRoofSheetArea, 8540),
        insulatedRoofArea: safeInt(geoQtys.insulatedRoofArea, 8540),
        canopyArea: safeInt(geoQtys.canopyArea, 770),
        metalWallArea: safeInt(geoQtys.metalWallArea, 3900),
        brickBaseArea: safeInt(geoQtys.brickBaseArea, 386),
        groundFloorArea: safeInt(geoQtys.groundFloorArea, 8498),
        sitePerimeter: safeInt(geoQtys.sitePerimeter, 500),
        roadArea: safeInt(geoQtys.roadArea, 2339),
        greenArea: safeInt(geoQtys.greenArea, 3559),
        steelRafterTon: safeInt(geoQtys.steelRafterTon, 467),
        steelPurlinTon: safeInt(geoQtys.steelPurlinTon, 153)
    };
    // keyword → qty + source
    const rules = [
        { match: 'site clearance', qty: gq.factoryFootprint, unit: 'm²', source: 'Drawing — factory footprint' },
        { match: 'rebar for foundation', qty: Math.round(gq.factoryFootprint * 0.060), unit: 'ton', source: 'Footprint × 60kg/m²' },
        { match: 'rebar for ground slab', qty: Math.round(gq.groundFloorArea * 0.030), unit: 'ton', source: 'Footprint × 30kg/m²' },
        { match: 'steel rafter', qty: gq.steelRafterTon, unit: 'ton', source: 'Footprint × 55kg/m²' },
        { match: 'purlin and girt', qty: gq.steelPurlinTon, unit: 'ton', source: 'Footprint × 18kg/m²' },
        { match: 'external brick wall', qty: gq.brickBaseArea, unit: 'm²', source: 'Drawing — perimeter × 1m' },
        { match: 'metal sheet panel', qty: gq.mainRoofSheetArea, unit: 'm²', source: 'Drawing — roof + slope i=10%' },
        { match: 'insulation sheet', qty: gq.insulatedRoofArea, unit: 'm²', source: 'Drawing — insulated roof only' },
        { match: 'canopy sheet', qty: gq.canopyArea, unit: 'm²', source: 'Drawing — canopy, no insulation' },
        { match: 'metal sheet wall', qty: gq.metalWallArea, unit: 'm²', source: 'Drawing — perimeter × height × 0.85' },
        { match: 'steel shutter door', qty: 4, unit: 'set', source: 'Drawing G-07 — SH1×2 + SH2×2' },
        { match: 'steel double sliding', qty: 4, unit: 'set', source: 'Drawing G-07 — SSD1×2 + SSD2×2' },
        { match: 'steel single swing', qty: 12, unit: 'set', source: 'Drawing G-07/G-08' },
        { match: 'fire door', qty: 3, unit: 'set', source: 'Drawing G-07 — FSD' },
        { match: 'aluminium single swing', qty: 6, unit: 'set', source: 'Drawing G-08 — AD' },
        { match: 'aluminium sliding window', qty: 24, unit: 'set', source: 'Drawing G-08 — AW' },
        { match: 'aluminium fix window', qty: 8, unit: 'set', source: 'Drawing G-08' },
        { match: 'louvre', qty: 10, unit: 'set', source: 'Drawing G-09 — LV' },
        { match: 'gypsum board ceiling', qty: 990, unit: 'm²', source: 'Drawing — packing/drying/washing' },
        { match: 'epoxy paint', qty: gq.groundFloorArea, unit: 'm²', source: 'Drawing — factory floor' },
        { match: 'fence', qty: gq.sitePerimeter, unit: 'm', source: 'Drawing — site perimeter 500m' },
        { match: 'concrete road', qty: gq.roadArea, unit: 'm²', source: 'Drawing ratio board — 2,339m²' },
        { match: 'grass', qty: gq.greenArea, unit: 'm²', source: 'Drawing ratio board — 3,559m²' }
    ];
    let updated = 0;
    boqData.boqItems = boqData.boqItems.map(row => {
        if (!Array.isArray(row) || row.length < 13)
            return row;
        const desc = String(row[2] || '').toLowerCase();
        const status = String(row[10] || '').toLowerCase();
        if (status === 'section')
            return row;
        const qtyCell = String(row[4] || '').trim();
        const isTBC = qtyCell === 'TBC' || qtyCell === '' || !isFinite(Number(qtyCell));
        if (!isTBC)
            return row;
        for (const rule of rules) {
            if (desc.indexOf(rule.match) === -1)
                continue;
            if (rule.unit && row[3] && String(row[3]).trim() !== rule.unit)
                continue;
            const amounts = computeAmounts(String(row[5] || ''), rule.qty);
            const newRow = [...row];
            newRow[4] = rule.qty;
            newRow[9] = rule.source;
            newRow[10] = 'Estimated';
            newRow[11] = 'Medium';
            if (amounts) {
                newRow[6] = amounts.low;
                newRow[7] = amounts.base;
                newRow[8] = amounts.high;
            }
            updated++;
            return newRow;
        }
        return row;
    });
    console.log(`[QS] applyCalculatedQuantities: updated ${updated} TBC rows`);
    return boqData;
}
// ─────────────────────────────────────────────────────────────────────────────
// ensureRequiredDivisions
// Adds Divs 23, 33, 34, 35 if Gemini omitted them.
// ─────────────────────────────────────────────────────────────────────────────
function ensureRequiredDivisions(boqData, geoQtys, craneData) {
    if (!boqData.boqItems)
        boqData.boqItems = [];
    const items = boqData.boqItems;
    const greenArea = safeInt(geoQtys.greenArea, 3559);
    const sitePerimeter = safeInt(geoQtys.sitePerimeter, 500);
    function hasDiv(code) {
        return items.some(r => Array.isArray(r) &&
            (String(r[1] || '').startsWith(code) ||
                String(r[2] || '').toUpperCase().includes(`DIVISION ${code}`)));
    }
    // Remove duplicates first
    const toRemove = ['33', '34', '35'];
    boqData.boqItems = items.filter(r => {
        if (!Array.isArray(r))
            return true;
        const sec = String(r[1] || '');
        const desc = String(r[2] || '').toUpperCase();
        return !toRemove.some(code => sec.startsWith(code) || desc.includes(`DIVISION ${code}`));
    });
    // Division 23 — Cranes
    if (!hasDiv('23') && !hasDiv('2300')) {
        boqData.boqItems.push(['', '', '', '', '', '', '', '', '', '', 'Section', '', ''], ['A23', '2300', 'DIVISION 23: BUILDING EQUIPMENT (CRANES)', '', '', '', '', '', '', '', 'Section', '', ''], ['23.1', '2306', 'Single Girder Bridge Crane (1.5T, span ~15.5m, hoist 6m)', 'set', 3, '350,000,000–700,000,000', 1050000000, 1575000000, 2100000000, 'Drawing — 3 bays', 'Specialist Quotation Required', 'Low', '14-20 week lead time'], ['23.2', '2307', 'Double Girder Bridge Crane (5T, span ~19.2m, hoist 10m)', 'set', 1, '800,000,000–1,500,000,000', 800000000, 1150000000, 1500000000, 'Drawing — 1 bay', 'Specialist Quotation Required', 'Low', 'Confirm with vendor'], ['23.3', '2308', 'Crane Runway Beams, Rails and End Stops', 'lot', 1, '500,000,000–900,000,000', 500000000, 700000000, 900000000, 'QS Allowance', 'Estimated', 'Low', ''], ['23.4', '2309', 'Crane Load Testing, Commissioning and Certificates', 'lot', 1, '50,000,000–120,000,000', 50000000, 85000000, 120000000, 'QS Allowance', 'Estimated', 'Low', '']);
        console.log('[QS] ensureRequiredDivisions: added Division 23 (Cranes)');
    }
    // Division 33 — Landscaping
    boqData.boqItems.push(['', '', '', '', '', '', '', '', '', '', 'Section', '', ''], ['A33', '3300', 'DIVISION 33: LANDSCAPING WORK', '', '', '', '', '', '', '', 'Section', '', ''], ['33.1', '3301', 'Topsoil Preparation and Fertiliser', 'm²', greenArea, '30,000–80,000', Math.round(greenArea * 30000), Math.round(greenArea * 55000), Math.round(greenArea * 80000), 'Drawing ratio board — 3,559m²', 'Estimated', 'Medium', ''], ['33.2', '3302', 'Grass Turf (Cỏ Nhật or equivalent)', 'm²', greenArea, '20,000–50,000', Math.round(greenArea * 20000), Math.round(greenArea * 35000), Math.round(greenArea * 50000), 'Drawing ratio board — 3,559m²', 'Estimated', 'Medium', ''], ['33.3', '3303', 'Trees and Ornamental Planting', 'lot', 1, '30,000,000–80,000,000', 30000000, 55000000, 80000000, 'QS Allowance', 'Estimated', 'Low', '']);
    // Division 34 — Sub-buildings
    boqData.boqItems.push(['', '', '', '', '', '', '', '', '', '', 'Section', '', ''], ['A34', '3400', 'DIVISION 34: SUB-BUILDING WORKS', '', '', '', '', '', '', '', 'Section', '', ''], ['34.1', '3411', 'Utility Block — Tech + Pump + Compressor + Electrical + Transformer Rooms (5m×25m)', 'lot', 1, '500,000,000–1,200,000,000', 500000000, 850000000, 1200000000, 'Drawing A-301', 'Estimated', 'Medium', ''], ['34.2', '3411b', 'Scrap Room + Hazardous Waste Room (5m×16m)', 'lot', 1, '80,000,000–180,000,000', 80000000, 130000000, 180000000, 'Drawing A-401', 'Estimated', 'Medium', ''], ['34.3', '3411d', 'Car Parking + Bike Parking Shelter (6m×23m)', 'lot', 1, '150,000,000–350,000,000', 150000000, 250000000, 350000000, 'Drawing A-501', 'Estimated', 'Medium', ''], ['34.4', '3412', 'LPG Room / Gas Storage Enclosure (3m×10m)', 'lot', 1, '80,000,000–160,000,000', 80000000, 120000000, 160000000, 'Drawing A-601', 'Estimated', 'Medium', ''], ['34.5', '3402', 'Flag Pole (Stainless Steel, H≈13m)', 'set', 1, '25,000,000–60,000,000', 25000000, 42500000, 60000000, 'Drawing A-901', 'Estimated', 'Medium', ''], ['34.6', '3403e', 'Septic Tanks (factory + guardhouse)', 'lot', 2, '20,000,000–50,000,000', 40000000, 70000000, 100000000, 'QS Allowance', 'Estimated', 'Low', '']);
    // Division 35 — Signboards
    boqData.boqItems.push(['', '', '', '', '', '', '', '', '', '', 'Section', '', ''], ['A35', '3500', 'DIVISION 35: SIGNBOARD AND BRANDING WORK', '', '', '', '', '', '', '', 'Section', '', ''], ['35.1', '3502', 'Company Name Signboard at Main Gate (L≈14.8m × H≈2.0m)', 'set', 1, '30,000,000–80,000,000', 30000000, 55000000, 80000000, 'Drawing A-1001', 'Estimated', 'Low', ''], ['35.2', '3503', 'Company Name Signboard at Side Gate (L≈8.7m × H≈2.0m)', 'set', 1, '20,000,000–50,000,000', 20000000, 35000000, 50000000, 'Drawing A-1001', 'Estimated', 'Low', ''], ['35.3', '3539', 'Factory Logo / Company Name on Facade (Stainless Steel)', 'set', 1, '15,000,000–50,000,000', 15000000, 32500000, 50000000, 'Drawing elevation', 'Estimated', 'Low', '']);
    console.log('[QS] ensureRequiredDivisions: Divisions 33/34/35 added');
    return boqData;
}
