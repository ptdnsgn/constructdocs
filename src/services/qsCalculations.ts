// src/services/qsCalculations.ts
// Pure calculation functions — no API calls, no side effects.


import {
  DrawingFacts, CriticalFacts, GeoQuantities, CraneData, BuildingPackages, FormData
} from '../types/index.js';


// ── Safe integer helper ───────────────────────────────────────────────────────
function safeInt(val: unknown, fallback: number): number {
  const n = Number(val);
  return isFinite(n) && n > 0 && n < 500000 ? Math.round(n) : fallback;
}

// ── Extract first number from a string like "9102 m² (Total: 8498+198...)" ──
function firstNumber(str: string): number {
  const m = String(str).match(/(\d[\d,]*\.?\d*)/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// validateCriticalFacts
// ─────────────────────────────────────────────────────────────────────────────
export function validateCriticalFacts(
  drawingFacts: DrawingFacts,
  formData: { totalArea?: number; buildingType?: string }
): CriticalFacts {
  const df = drawingFacts || {};

  const roofSlope =
    df.roofSlope && df.roofSlope !== 'NOT SHOWN' ? df.roofSlope.trim() : null;
  const roofSheetSpec =
    df.roofSheetSpec && df.roofSheetSpec !== 'NOT SHOWN' ? df.roofSheetSpec.trim() : null;
  const roofInsulationSpec =
    df.roofInsulationSpec && df.roofInsulationSpec !== 'NOT SHOWN'
      ? df.roofInsulationSpec.trim()
      : null;
  const wallSpec =
    df.wallCladdingSpec && df.wallCladdingSpec !== 'NOT SHOWN'
      ? df.wallCladdingSpec.trim()
      : 'Brick wall 1m height base + Metal sheet wall above to eave';
  const structuralSystem =
    df.structuralSystem && df.structuralSystem !== 'NOT SHOWN'
      ? df.structuralSystem.trim()
      : 'Steel frame (portal frame) with RC foundations and ground beams';

  const userArea = Number(formData.totalArea) || 0;

  // Use first number only to avoid concatenation bug
  const drawingArea = df.totalFloorAreaFromDrawing
    ? firstNumber(df.totalFloorAreaFromDrawing)
    : 0;
  const footprint = df.buildingFootprintFromDrawing
    ? firstNumber(df.buildingFootprintFromDrawing)
    : 0;

  const gfa = drawingArea > 0 ? drawingArea : userArea > 0 ? userArea : 9102;
  const factoryFP = footprint > 0 ? footprint : userArea > 0 ? userArea : 8498;

  let confirmedSummary = '';
  if (roofSlope) confirmedSummary += `\n- Roof Slope: ${roofSlope}`;
  if (roofSheetSpec) confirmedSummary += `\n- Roof Sheet: ${roofSheetSpec}`;
  if (roofInsulationSpec) confirmedSummary += `\n- Insulation: ${roofInsulationSpec}`;
  if (wallSpec) confirmedSummary += `\n- Wall Cladding: ${wallSpec}`;
  if (structuralSystem) confirmedSummary += `\n- Structure: ${structuralSystem}`;
  if (!confirmedSummary) {
    confirmedSummary = '\n- No drawing facts confirmed — use QS allowances throughout.';
  }

  console.log(
    `[QS] criticalFacts: type=${df.projectType || 'unknown'} ` +
    `gfa=${gfa} footprint=${factoryFP} ` +
    `roofSlope=${roofSlope || 'NOT CONFIRMED'}`
  );

  return {
    projectType: String(df.projectType || formData.buildingType || 'new_factory_warehouse')
      .toLowerCase().replace(/\s+/g, '_'),
    roofSlope,
    roofSheetSpec,
    roofInsulationSpec,
    wallCladdingSpec: wallSpec,
    structuralSystem,
    gfa,
    factoryFootprint: factoryFP,
    userArea,
    confirmedSummary,
    confirmedItems: Array.isArray(df.confirmedItems) ? df.confirmedItems : [],
    boqCandidateItems: Array.isArray(df.boqCandidateItems) ? df.boqCandidateItems : [],
    roomAreas: Array.isArray(df.roomAreas) ? df.roomAreas : [],
    workPackages: Array.isArray(df.workPackages) ? df.workPackages : []
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateGeometricQuantities
// ─────────────────────────────────────────────────────────────────────────────

export function calculateGeometricQuantities(
  drawingFacts: DrawingFacts,
  userArea: number,
  formData?: Partial<FormData>
): GeoQuantities {

  let factoryLength = 0;
  let factoryWidth = 0;

  // Try to parse dimensions from drawing extraction
  if (drawingFacts.mainFactoryRoofDimensions &&
      drawingFacts.mainFactoryRoofDimensions !== 'NOT SHOWN') {
    const m = String(drawingFacts.mainFactoryRoofDimensions)
      .match(/(\d+[\.,]?\d*)\s*[xX×]\s*(\d+[\.,]?\d*)/);
    if (m) {
      let d1 = parseFloat(m[1].replace(',', '.'));
      let d2 = parseFloat(m[2].replace(',', '.'));
      // Convert mm to m if values look like mm
      if (d1 >= 1000) d1 = d1 / 1000;
      if (d2 >= 1000) d2 = d2 / 1000;
      factoryLength = d1;
      factoryWidth = d2;
    }
  }

  // Fallback: estimate dimensions from area
  const baseArea = userArea > 0 ? userArea : 8498;
  if (factoryLength === 0 || factoryWidth === 0) {
    factoryWidth = Math.round(Math.sqrt(baseArea / 1.76));
    factoryLength = Math.round(baseArea / (factoryWidth || 1));
  }

  const factoryFootprint = factoryLength * factoryWidth;

  // Sanity check
  if (!isFinite(factoryFootprint) || factoryFootprint < 100 || factoryFootprint > 200000) {
    factoryWidth = 70;
    factoryLength = 123;
  }

  // Roof
  const slopePctRaw = drawingFacts.roofSlope
    ? String(drawingFacts.roofSlope).replace(/[^0-9.]/g, '')
    : '10';
  const slopePct = parseFloat(slopePctRaw) / 100 || 0.10;
  const slopeFactor = Math.sqrt(1 + slopePct * slopePct);
  const fp = factoryLength * factoryWidth;
  
  // Apply waste factors from QS parameters
  const roofWasteFactor     = 1 + ((formData?.roofWastePct     || 10) / 100);
  const claddingWasteFactor = 1 + ((formData?.claddingWastePct || 10) / 100);

  const mainRoofSheetArea = Math.round(fp * slopeFactor * roofWasteFactor);
  const canopyArea = Math.round(2 * 5.5 * factoryWidth * roofWasteFactor);
  const insulatedRoofArea = mainRoofSheetArea;

  // Walls
  const perimeter = 2 * (factoryLength + factoryWidth);
  const eaveHeight = formData?.clearHeight || 10.0;
  const brickHeight = 1.0;
  const metalWallArea = Math.round(perimeter * (eaveHeight - brickHeight) * 0.85 * claddingWasteFactor);
  const ridgeExtra = (factoryWidth / 2) * slopePct;
  const gableExtra = Math.round(2 * 0.5 * factoryWidth * ridgeExtra);
  const totalMetalWallArea = metalWallArea + gableExtra;
  const brickBaseArea = Math.round(perimeter * brickHeight);

  // Steel — use QS benchmark parameters
  const rafterKgm2 = (formData?.steelRafterKgm2 || 55) / 1000;
  const purlinKgm2 = (formData?.steelPurlinKgm2 || 18) / 1000;
  const steelRafterTon = Math.round(fp * rafterKgm2);
  const steelPurlinTon = Math.round(fp * purlinKgm2);

  // Apply safety caps
  const gq: GeoQuantities = {
    factoryLength:        safeInt(factoryLength,          123),
    factoryWidth:         safeInt(factoryWidth,            70),
    factoryFootprint:     safeInt(fp,                    8498),
    slopeFactor:          slopeFactor.toFixed(4),
    mainRoofSheetArea:    safeInt(mainRoofSheetArea,     8540),
    canopyArea:           safeInt(canopyArea,              770),
    totalRoofSheetArea:   safeInt(mainRoofSheetArea + canopyArea, 9310),
    insulatedRoofArea:    safeInt(insulatedRoofArea,     8540),
    nonInsulatedRoofArea: safeInt(canopyArea,              770),
    perimeter:            safeInt(perimeter,               386),
    metalWallArea:        safeInt(totalMetalWallArea,    3900),
    brickBaseArea:        safeInt(brickBaseArea,           386),
    groundFloorArea:      safeInt(fp,                    8498),
    siteArea:             15000,
    sitePerimeter:        500,
    roadArea:             2339,
    greenArea:            3559,
    steelRafterTon:       safeInt(steelRafterTon,          467),
    steelPurlinTon:       safeInt(steelPurlinTon,          153)
  };

  console.log(
    `[QS] geoQtys: ${gq.factoryLength}x${gq.factoryWidth}m ` +
    `roof=${gq.mainRoofSheetArea}m² wall=${gq.metalWallArea}m² ` +
    `steel=${gq.steelRafterTon}t`
  );

  return gq;
}

// ─────────────────────────────────────────────────────────────────────────────
// extractCraneData
// ─────────────────────────────────────────────────────────────────────────────
export function extractCraneData(drawingFacts: DrawingFacts): CraneData {
  const df = drawingFacts || {};
  const craneDescriptions: string[] = [];

  const sources = [
    ...(Array.isArray(df.boqCandidateItems) ? df.boqCandidateItems : []),
    ...(Array.isArray(df.confirmedItems) ? df.confirmedItems : [])
  ];

  sources.forEach(item => {
    const text = (Array.isArray(item) ? item.join(' ') : String(item)).toLowerCase();
    if (text.includes('crane') || text.includes('cẩu')) {
      craneDescriptions.push(String(Array.isArray(item) ? item.join(' ') : item).substring(0, 200));
    }
  });

  if (craneDescriptions.length === 0) {
    return {
      found: false,
      promptNote:
        'No crane data confirmed from drawing. For a factory project, include a crane allowance ' +
        'line in Division 23 marked as "QS Allowance — confirm crane specification with client". ' +
        'Do NOT use TBC.'
    };
  }

  return {
    found: true,
    count: craneDescriptions.length,
    descriptions: craneDescriptions,
    promptNote:
      'The following crane items are confirmed or likely visible on the drawing. ' +
      'Price each in Division 23 as a set:\n' + craneDescriptions.join('\n')
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// identifyBuildingPackages
// ─────────────────────────────────────────────────────────────────────────────
export function identifyBuildingPackages(
  drawingFacts: DrawingFacts,
  userArea: number
): BuildingPackages {
  const df = drawingFacts || {};
  const packages: BuildingPackages['packages'] = [];

  // Try from workPackages extraction
  if (Array.isArray(df.workPackages) && df.workPackages.length > 1) {
    (df.workPackages as unknown[][]).forEach(row => {
      if (!Array.isArray(row) || String(row[0]) === 'Package') return;
      const name = String(row[0] || '').trim();
      if (name) packages.push({ name, scopeNote: String(row[1] || ''), confidence: String(row[2] || '') });
    });
  }

  // Standard Lotus Astec fallback (matches the drawing area schedule)
  if (packages.length === 0) {
    const standardPackages: BuildingPackages['packages'] = [
      { name: 'FACTORY (Main Building)',              area: 8498, floors: 1, type: 'factory',    note: '(62×8)+(70×107)+(64×8)' },
      { name: 'OFFICE / CANTEEN / MEDICAL / REST RM', area: 396,  floors: 2, type: 'office',     note: '5.5m×36m×2 floors' },
      { name: 'UTILITY BLOCK',                        area: 125,  floors: 1, type: 'utility',    note: '5m×25m' },
      { name: 'GARBAGE / SCRAP ROOM',                 area: 80,   floors: 1, type: 'utility',    note: '5m×16m' },
      { name: 'CAR + BIKE PARKING',                   area: 138,  floors: 1, type: 'carpark',    note: '6m×23m' },
      { name: 'LPG ROOM',                             area: 30,   floors: 1, type: 'utility',    note: '3m×10m' },
      { name: 'GUARDHOUSE 1',                         area: 14,   floors: 1, type: 'guardhouse', note: '' },
      { name: 'GUARDHOUSE 2',                         area: 14,   floors: 1, type: 'guardhouse', note: '' }
    ];
    packages.push(...standardPackages);
  }

  const totalArea = packages.reduce((s, p) => s + (p.area || 0), 0);

  return {
    packages,
    totalArea,
    summary: packages
      .map(p =>
        `• ${p.name}: ${p.area ? p.area + ' m²' : 'area TBC'}` +
        (p.floors && p.floors > 1 ? ` (${p.floors} floors)` : '') +
        (p.note ? ` — ${p.note}` : '')
      )
      .join('\n')
  };
}
