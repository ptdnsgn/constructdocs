"use strict";
// src/prompts/boqPrompts.ts
// Builds the Gemini prompts for BOQ Part A and Part B.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPromptA = buildPromptA;
exports.buildPromptB = buildPromptB;
// ── Safe integer for prompt injection ────────────────────────────────────────
function n(val, fallback) {
    const num = Number(val);
    return isFinite(num) && num > 0 && num < 500000 ? Math.round(num) : fallback;
}
// ─────────────────────────────────────────────────────────────────────────────
// BOQ PROMPT A — Divisions 1–15 + 23 (Structure, Envelope, Cranes)
// ─────────────────────────────────────────────────────────────────────────────
function buildPromptA(formData, cf, geoQtys, craneData, bp) {
    const gq = {
        factoryLength: n(geoQtys.factoryLength, 123),
        factoryWidth: n(geoQtys.factoryWidth, 70),
        factoryFootprint: n(geoQtys.factoryFootprint, 8498),
        mainRoofSheetArea: n(geoQtys.mainRoofSheetArea, 8540),
        insulatedRoofArea: n(geoQtys.insulatedRoofArea, 8540),
        canopyArea: n(geoQtys.canopyArea, 770),
        metalWallArea: n(geoQtys.metalWallArea, 3900),
        brickBaseArea: n(geoQtys.brickBaseArea, 386),
        groundFloorArea: n(geoQtys.groundFloorArea, 8498),
        steelRafterTon: n(geoQtys.steelRafterTon, 467),
        steelPurlinTon: n(geoQtys.steelPurlinTon, 153),
        sitePerimeter: n(geoQtys.sitePerimeter, 500),
        roadArea: n(geoQtys.roadArea, 2339)
    };
    return `You are a Senior Quantity Surveyor preparing Part A of a Preliminary Cost Estimate (Class D) for a Vietnamese construction project. Return ONLY raw JSON — no markdown, no backticks.

PROJECT: ${formData.projectName} | Client: ${formData.clientName} | Location: ${formData.location}
Building Type: ${formData.buildingType} | Spec Level: ${formData.specLevel}

BUILDING PACKAGES:
${bp.summary}
Factory footprint: ${gq.factoryFootprint} m²


Factory footprint: ${gq.factoryFootprint} m²

USER-PROVIDED CONTEXT — treat as confirmed facts, higher priority than drawing extraction:
- Structural system: ${formData.structuralSystem || 'Extract from drawing'}
- Foundation type:   ${formData.foundationType || 'Use QS allowance'}
- Clear height:      ${formData.clearHeight || 'Extract from drawing'} m
- MEP scope:         ${formData.mepScope || 'Civil only — MEP by others'}
- Crane:             ${formData.craneRequired || 'Extract from drawing'}
- Site condition:    ${formData.siteCondition || 'Unknown'}

- Additional notes:  ${formData.additionalNotes || 'None'}
- Steel rafter:      ${formData.steelRafterKgm2 || 55} kg/m² (USE THIS for Div 7 rafter tonnage)
- Purlin/girt:       ${formData.steelPurlinKgm2 || 18} kg/m² (USE THIS for Div 7 purlin tonnage)
- Roof waste:        ${formData.roofWastePct || 10}% already applied to roof quantities above
- Cladding waste:    ${formData.claddingWastePct || 10}% already applied to wall quantities above
- Finish waste:      ${formData.finishWastePct || 10}% — apply to all floor/wall tile items
- Min opening deduct: ${formData.minOpeningDeductM2 || 1.0} m² — deduct openings larger than this from wall areas


CONFIRMED FROM DRAWING — DO NOT MARK THESE AS TBC:
${cf.confirmedSummary}

MANDATORY QUANTITIES — USE THESE EXACT NUMBERS, DO NOT RECALCULATE:
  Div 2  Site clearance         = ${gq.factoryFootprint} m²
  Div 4  Ground floor slab      = ${gq.groundFloorArea} m² (thickness 150mm already applied)
  Div 6  Rebar foundation       = ${Math.round(gq.groundFloorArea * 0.060)} ton
  Div 6  Rebar ground slab      = ${Math.round(gq.groundFloorArea * 0.030)} ton
  Div 7  Steel rafter           = ${gq.steelRafterTon} ton
  Div 7  Purlin and girt        = ${gq.steelPurlinTon} ton
  Div 8  Brick base wall        = ${gq.brickBaseArea} m²
  Div 12 Roof sheet (insulated) = ${gq.mainRoofSheetArea} m²  (slope factor already applied)
  Div 12 Roof insulation        = ${gq.insulatedRoofArea} m²  (NOT canopy)
  Div 12 Canopy (no insulation) = ${gq.canopyArea} m²
  Div 13 Metal wall cladding    = ${gq.metalWallArea} m²
  Div 15 External plaster       = ${gq.brickBaseArea} m²
  Div 20 Epoxy floor            = ${gq.groundFloorArea} m²

CRANE DATA:
${craneData.promptNote}

DIVISION ORDER (follow exactly): 1 → 2 → 3 → 4 → 5 → 6 → 7 → 23 → 8 → 9 → 12 → 13 → 14 → 15
Division 23 (Cranes) MUST appear after Division 7. Do NOT skip it.

QUANTITY RULES:
1. Confirmed fact above → use it directly
2. Mandatory quantity above → copy exactly, do NOT recalculate
3. Standard allowance → use Vietnam benchmark, label Source "QS Allowance"
4. Specialist item → label Status "Specialist Quotation Required", still give a range
5. Maximum 3 TBC in all of Part A

VIETNAM BENCHMARK RATES (VND excl VAT):
Site clearance (m²): 20,000–60,000 | Soil excavation (m³): 80,000–200,000
Lean concrete (m³): 1,200,000–1,600,000 | Foundation concrete #250 (m³): 2,000,000–3,000,000
Ground slab concrete #250 (m³): 1,800,000–2,500,000 | Rebar (ton): 18,000,000–25,000,000
Steel rafter (ton): 28,000,000–42,000,000 | Purlin/girt (ton): 22,000,000–36,000,000
Brick wall ext (m²): 200,000–380,000 | Roof metal sheet (m²): 200,000–350,000
Roof insulation glasswool (m²): 150,000–280,000 | Metal wall cladding (m²): 200,000–450,000
Steel gutter (m): 300,000–700,000 | PVC downspout (m): 100,000–250,000
External plaster (m²): 80,000–150,000 | Epoxy floor 0.3mm (m²): 150,000–400,000
Single girder crane 1.5T (set): 350,000,000–700,000,000
Double girder crane 5T (set): 800,000,000–1,500,000,000

REQUIRED JSON FORMAT:
{
  "projectSummary": {
    "projectName": "${formData.projectName}",
    "clientName": "${formData.clientName}",
    "location": "${formData.location}",
    "buildingType": "${formData.buildingType}",
    "specLevel": "${formData.specLevel}",
    "detectedType": "${cf.projectType}",
    "totalFloorArea": "${gq.factoryFootprint} m²",
    "numFloors": "1F factory + 2F office",
    "estimateClass": "Class D — Order of Magnitude ±30% to ±50%",
    "totalBase": 0,
    "totalLow": 0,
    "totalHigh": 0
  },
  "boqItems": [
    ["No.", "Section", "Description", "Unit", "Qty", "Rate Range (VND/unit)", "Amount Low (VND)", "Amount Base (VND)", "Amount High (VND)", "Source", "Status", "Confidence", "Remarks"],
    ["", "0100", "DIVISION 1: PRELIMINARIES WORK", "", "", "", "", "", "", "", "Section", "", ""],
    ...all items...
    ["TOTAL-A", "", "SUBTOTAL PART A (Base)", "", "", "", lowTotal, baseTotal, highTotal, "", "Summary", "", ""]
  ]
}

CRITICAL: Last row must be SUBTOTAL PART A with actual summed numbers — not zero.`;
}
// ─────────────────────────────────────────────────────────────────────────────
// BOQ PROMPT B — Divisions 16–28 + 33 + 34 + 35 + Supporting Tables
// ─────────────────────────────────────────────────────────────────────────────
function buildPromptB(formData, cf, geoQtys, craneData, bp, boqTotals) {
    const gq = {
        factoryFootprint: n(geoQtys.factoryFootprint, 8498),
        insulatedRoofArea: n(geoQtys.insulatedRoofArea, 8540),
        canopyArea: n(geoQtys.canopyArea, 770),
        metalWallArea: n(geoQtys.metalWallArea, 3900),
        groundFloorArea: n(geoQtys.groundFloorArea, 8498),
        sitePerimeter: n(geoQtys.sitePerimeter, 500),
        roadArea: n(geoQtys.roadArea, 2339),
        greenArea: n(geoQtys.greenArea, 3559)
    };
    const totalArea = n(bp.totalArea || geoQtys.factoryFootprint, 8498);
    return `You are a Senior Quantity Surveyor completing Part B of a Preliminary Cost Estimate (Class D). Return ONLY raw JSON — no markdown, no backticks.

PROJECT: ${formData.projectName} | ${formData.location}
Part A Total: ${boqTotals.totalBase.toLocaleString()} VND (base)
Factory footprint: ${gq.factoryFootprint} m² | Total all buildings: ${totalArea} m²


USER-PROVIDED CONTEXT:
- Structural system: ${formData.structuralSystem || 'Extract from drawing'}
- Foundation type:   ${formData.foundationType || 'Use QS allowance'}
- Clear height:      ${formData.clearHeight || 'Extract from drawing'} m
- MEP scope:         ${formData.mepScope || 'Civil only — MEP by others'}
- Crane:             ${formData.craneRequired || 'Extract from drawing'}
- Site condition:    ${formData.siteCondition || 'Unknown'}

- Additional notes:  ${formData.additionalNotes || 'None'}
- Finish waste:      ${formData.finishWastePct || 10}% — apply to all floor/wall tile items
- Min opening deduct: ${formData.minOpeningDeductM2 || 1.0} m² — deduct openings larger than this

CONFIRMED FROM DRAWING:
${cf.confirmedSummary}


MANDATORY QUANTITIES FOR PART B:
  Div 20 Epoxy floor          = ${gq.groundFloorArea} m²
  Div 24 Fence perimeter      = ${gq.sitePerimeter} m
  Div 25 Road/traffic area    = ${gq.roadArea} m²
  Div 33 Green/grass area     = ${gq.greenArea} m²

DOOR SCHEDULE (from drawing G-07/G-08/G-09):
  Steel Shutter Door (SH1 W5×H5m): 2 sets | Steel Shutter Door (SH2 W5×H3m): 2 sets
  Steel Double Sliding Door (SSD1 W6×H3m): 2 sets | (SSD2 W5×H3m): 2 sets
  Steel Single Swing Door (SD): 12 sets | Fire Door EI60 (FSD): 3 sets
  Aluminium Single Swing Door (AD): 6 sets | Aluminium Sliding Window (AW): 24 sets
  Aluminium Fix Window: 8 sets | Louvre with insect net (LV): 10 sets

MANDATORY DIVISION LIST — include ALL in this order:
16 → 17 → 18 → 19 → 20 → 21 → 22 → 24 → 25 → 26 → 27 → 28 → 33 → 34 → 35

Divisions 33 (Landscaping), 34 (Sub-buildings), 35 (Signboards) are REQUIRED.
If response is long, reduce items per division — do NOT skip any division.

QUANTITY RULES: Max 2 TBC in all of Part B. Use QS Allowance for unknowns.

RATES (VND excl VAT):
Epoxy floor 0.3mm (m²): 150,000–400,000 | Steel shutter door W5×H5m (set): 15,000,000–35,000,000
Fire door EI60 (set): 8,000,000–18,000,000 | Aluminium door (set): 4,000,000–10,000,000
Gypsum board T-bar ceiling (m²): 200,000–450,000 | Paint internal (m²): 60,000–120,000
Concrete fence H=2.0m (m): 400,000–900,000 | Steel+brick fence H=2.0m (m): 800,000–1,500,000
Concrete road t=200mm (m²): 450,000–700,000 | Drainage pipe D200 uPVC (m): 150,000–400,000
Grass (m²): 30,000–80,000 | Utility block (lot): 500,000,000–1,200,000,000
Car+bike parking shelter (lot): 150,000,000–350,000,000 | Flag pole SUS (set): 25,000,000–60,000,000
Signboard main gate (set): 30,000,000–80,000,000

REQUIRED JSON FORMAT:
{
  "boqItems": [
    ...all Part B rows in same 13-column format as Part A...
    ["", "3300", "DIVISION 33: LANDSCAPING WORK", "", "", "", "", "", "", "", "Section", "", ""],
    ...landscaping items...
    ["", "3400", "DIVISION 34: SUB-BUILDING WORKS", "", "", "", "", "", "", "", "Section", "", ""],
    ...sub-building items...
    ["", "3500", "DIVISION 35: SIGNBOARD AND BRANDING", "", "", "", "", "", "", "", "Section", "", ""],
    ...signboard items...
    ["TOTAL-B", "", "SUBTOTAL PART B (Base)", "", "", "", lowTotal, baseTotal, highTotal, "", "Summary", "", ""]
  ],
  "takeOffDetail": [["No.","Element","Source","Method","Dim A","Dim B","Factor","Net Qty","Unit","Notes"], ...],
  "assumptions": [["ID","Element","Assumption","Value Used","Basis","Impact","Priority"], ...],
  "clarificationQuestions": [["No.","Question","What It Affects","Impact","Priority"], ...],
  "riskRegister": [["No.","Risk","Category","Probability","Cost Impact","Action"], ...],
  "hiddenItemsChecklist": [["Item","Category","Included?","In BOQ?","Notes"], ...],
  "crossCheck": [["Element","This Estimate","Benchmark Low","Benchmark High","Within Range?","Notes"], ...]
}`;
}
