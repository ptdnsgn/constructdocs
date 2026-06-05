// src/routes/qs.ts

import { Router, Request, Response } from 'express';
import { generateQS } from '../services/qsHandler.js';
import { extractDrawingFacts, extractDrawingFactsMulti } from '../services/qsExtraction.js';
import { FormData } from '../types/index.js';

const router = Router();

// ── POST /api/qs/extract ──────────────────────────────────────────────────────
// Step 1: AI reads the drawing and returns extracted facts for user review.
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    const formData: FormData = {
      projectName:  String(body.projectName  || ''),
      clientName:   String(body.clientName   || ''),
      location:     String(body.location     || 'Vietnam'),
      buildingType: String(body.buildingType || 'Factory / Industrial Warehouse'),
      specLevel:    String(body.specLevel    || 'Standard'),
      totalArea:    0,
      numFloors:    1,
      createdBy:    String(body.createdBy    || '')
    };

    const drawingBase64   = String(body.drawingBase64   || '');
    const drawingMimeType = String(body.drawingMimeType || '');
    const drawings: { base64: string; mimeType: string }[] = Array.isArray(body.drawings)
      ? body.drawings.filter((d: { base64?: string; mimeType?: string }) => d.base64 && d.mimeType)
      : [];

    let facts = {};
    if (drawings.length > 0) {
      // Multiple screenshots path
      facts = await extractDrawingFactsMulti(formData, drawings);
    } else if (drawingBase64 && drawingMimeType) {
      // Single file fallback (backward compat)
      facts = await extractDrawingFacts(formData, drawingBase64, drawingMimeType);
    }

    res.json({ success: true, facts });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] Extract error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ── POST /api/qs/generate ─────────────────────────────────────────────────────
// Step 2: User has confirmed facts. Generate the full BOQ.
// Accepts JSON body (confirmed facts from review screen).
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (!body.projectName || !body.clientName) {
      res.status(400).json({ success: false, error: 'projectName and clientName are required' });
      return;
    }

    const formData: FormData = {
      projectName:  String(body.projectName  || ''),
      clientName:   String(body.clientName   || ''),
      location:     String(body.location     || 'Vietnam'),
      buildingType: String(body.buildingType || 'Factory / Industrial Warehouse'),
      specLevel:    String(body.specLevel    || 'Standard'),
      totalArea:    parseFloat(body.factoryFootprint || body.totalArea) || 0,
      numFloors:    parseInt(body.numFloors)  || 1,
      createdBy:    String(body.createdBy    || 'QS Team'),
      // Confirmed drawing facts
      structuralSystem: String(body.structuralSystem || ''),
      foundationType:   String(body.foundationType   || ''),
      clearHeight:      parseFloat(body.clearHeight) || 0,
      mepScope:         String(body.mepScope         || ''),
      craneRequired:    String(body.craneRequired    || ''),
      siteCondition:    String(body.siteCondition    || ''),
      additionalNotes:  String(body.additionalNotes  || ''),
      // QS parameters
      prelimPct:          parseFloat(body.prelimPct)          || 10,
      contingencyPct:     parseFloat(body.contingencyPct)     || 15,
      profitPct:          parseFloat(body.profitPct)          || 8,
      vatPct:             parseFloat(body.vatPct)             || 10,
      steelRafterKgm2:    parseFloat(body.steelRafterKgm2)    || 55,
      steelPurlinKgm2:    parseFloat(body.steelPurlinKgm2)    || 18,
      finishWastePct:     parseFloat(body.finishWastePct)     || 10,
      roofWastePct:       parseFloat(body.roofWastePct)       || 10,
      claddingWastePct:   parseFloat(body.claddingWastePct)   || 10,
      minOpeningDeductM2: parseFloat(body.minOpeningDeductM2) || 1.0
    };

    // Also pass confirmed facts directly so the BOQ prompts can use them
    // without needing to re-extract from the drawing
    const confirmedFacts = {
      roofSlope:          String(body.roofSlope          || ''),
      roofSheetSpec:      String(body.roofSheetSpec      || ''),
      roofInsulationSpec: String(body.roofInsulationSpec || ''),
      wallCladdingSpec:   String(body.wallCladdingSpec   || ''),
      structuralSystem:   String(body.structuralSystem   || ''),
      craneInfo:          String(body.craneInfo          || ''),
      factoryFootprint:   parseFloat(body.factoryFootprint) || 0,
      totalArea:          parseFloat(body.totalArea)        || 0,
      numFloors:          String(body.numFloors || '')
    };

    const drawingBase64   = String(body.drawingBase64   || '');
    const drawingMimeType = String(body.drawingMimeType || '');
    const drawings: { base64: string; mimeType: string }[] = Array.isArray(body.drawings)
      ? body.drawings.filter((d: { base64?: string; mimeType?: string }) => d.base64 && d.mimeType)
      : [];

    // Use first drawing for backward compat with generateQS signature
    const resolvedBase64    = drawings.length > 0 ? drawings[0].base64    : drawingBase64;
    const resolvedMimeType  = drawings.length > 0 ? drawings[0].mimeType  : drawingMimeType;

    const result = await generateQS(formData, resolvedBase64 || undefined, resolvedMimeType || undefined, confirmedFacts);

    if (!result.success || !result.excelBuffer) {
      res.status(500).json({ success: false, error: result.error || 'Generation failed' });
      return;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Job-Id', result.jobId || '');
    res.send(result.excelBuffer);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] Generate error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ── GET /api/qs/health ────────────────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '2.1.0', geminiKeySet: !!process.env.GEMINI_API_KEY });
});

export default router;
