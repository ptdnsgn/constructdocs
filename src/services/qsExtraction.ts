// src/services/qsExtraction.ts
// Sends drawing screenshots to Gemini and extracts structured facts.

import { geminiWithFile, geminiWithFiles, parseGeminiJson } from './gemini.js';
import { DrawingFacts, FormData } from '../types/index.js';

function buildExtractionPrompt(formData: FormData): string {
  return `You are a senior architectural QS analyst. Analyse this construction drawing and extract the following facts as a JSON object.

Return ONLY raw JSON — no markdown, no backticks, no explanation.

{
  "projectType": "new_factory_warehouse | office_building | renovation | mixed_scope",
  "drawingTitle": "exact title from title block",
  "projectNameFromDrawing": "project name",
  "clientFromDrawing": "client name",
  "locationFromDrawing": "full location from drawing",
  "issueDate": "date from drawing",
  "scopeSummary": "2-sentence summary of the construction scope",
  "mainUse": "Factory / Industrial Warehouse | Office | etc.",
  "measurementBasis": "m² for areas, mm for dimensions",
  "buildingFootprintFromDrawing": "single number only e.g. 8498",
  "totalFloorAreaFromDrawing": "single number only e.g. 9102",
  "mainFactoryRoofDimensions": "e.g. 70 × 123 (in metres)",
  "numberOfFloorsFromDrawing": "e.g. 1F factory + 2F office",
  "roofSlope": "copy exactly from roof plan note e.g. i=10%",
  "roofSheetSpec": "copy exactly from roof plan note e.g. Galvanized finish profile metal sheet",
  "roofInsulationSpec": "copy exactly from roof plan note e.g. glass wool insulation t=50 (12kg/m³) w/aluminium face & galvanized wire mesh",
  "wallCladdingSpec": "copy exactly from elevation note e.g. Brick 1m height & Metal sheet to roof",
  "structuralSystem": "e.g. Steel portal frame with RC foundations",
  "confirmedItems": ["item 1", "item 2"],
  "boqCandidateItems": [["description","qty","unit","source"], ...],
  "roomAreas": [["Room Name","Area m²","Floor","Notes"], ...],
  "workPackages": [["Package","Scope note","Confidence"], ...]
}

IMPORTANT RULES:
- For buildingFootprintFromDrawing and totalFloorAreaFromDrawing: return a SINGLE NUMBER only, not a formula or sentence.
- Copy roof and wall specs EXACTLY from the drawing notes — do not paraphrase.
- If a value is not shown on this drawing, use the string "NOT SHOWN".
- Do not guess or invent values.

User context: Project="${formData.projectName}", Location="${formData.location}", Area≈${formData.totalArea}m²`;
}

// Single drawing (backward compat)
export async function extractDrawingFacts(
  formData: FormData,
  drawingBase64: string,
  drawingMimeType: string
): Promise<DrawingFacts> {
  return extractDrawingFactsMulti(formData, [{ base64: drawingBase64, mimeType: drawingMimeType }]);
}

// Multiple drawings (screenshots)
export async function extractDrawingFactsMulti(
  formData: FormData,
  drawings: { base64: string; mimeType: string; label?: string }[]
): Promise<DrawingFacts> {
  try {
    const prompt = buildExtractionPrompt(formData);

    let raw: string;
    if (drawings.length === 1) {
      raw = await geminiWithFile(prompt, drawings[0].base64, drawings[0].mimeType, 8192);
    } else {
      const labeled = drawings.map((d, i) => ({
        ...d,
        label: d.label || getAutoLabel(i, drawings.length)
      }));
      raw = await geminiWithFiles(prompt, labeled, 8192);
    }

    console.log('[QS] Extraction raw (first 500 chars):', raw.substring(0, 500));

    const parsed = parseGeminiJson<DrawingFacts>(raw, 'Extraction');
    if (!parsed) {
      console.log('[QS] Extraction: JSON parse failed — returning empty facts');
      return buildEmptyFacts();
    }

    console.log(
      '[QS] Extraction success:',
      `roofSlope=${parsed.roofSlope || 'NULL'}`,
      `roofSheet=${parsed.roofSheetSpec ? 'CONFIRMED' : 'NULL'}`,
      `footprint=${parsed.buildingFootprintFromDrawing || 'NULL'}`
    );

    return parsed;
  } catch (err) {
    console.error('[QS] Extraction failed:', err);
    return buildEmptyFacts();
  }
}

// Auto-label images based on position when user doesn't provide labels
function getAutoLabel(index: number, total: number): string {
  const labels = [
    'Screenshot 1 — Area Schedule / Floor Plan',
    'Screenshot 2 — Roof Plan or Section',
    'Screenshot 3 — Wall Elevation or Section',
    'Screenshot 4 — Foundation or Pile Plan',
    'Screenshot 5 — Crane or Equipment Drawing'
  ];
  return labels[index] || `Screenshot ${index + 1} of ${total}`;
}

function buildEmptyFacts(): DrawingFacts {
  return {
    projectType: 'unknown',
    scopeSummary: 'Drawing facts could not be extracted. Estimate relies on user input.',
    confirmedItems: []
  };
}
