// src/types/index.ts

export interface FormData {
  projectName: string;
  clientName: string;
  location: string;
  buildingType: string;
  specLevel: string;
  totalArea: number;
  numFloors: number;
  createdBy: string;
  structuralSystem?: string;
  foundationType?: string;
  clearHeight?: number;
  mepScope?: string;
  craneRequired?: string;
  siteCondition?: string;
  additionalNotes?: string;
  // QS calculation parameters
  prelimPct?: number;
  contingencyPct?: number;
  profitPct?: number;
  vatPct?: number;
  steelRafterKgm2?: number;
  steelPurlinKgm2?: number;
  rebarFoundationKgm2?: number;
  finishWastePct?: number;
  roofWastePct?: number;
  claddingWastePct?: number;
  minOpeningDeductM2?: number;
}

// Facts confirmed by QS after reviewing AI extraction
export interface ConfirmedFacts {
  roofSlope?: string;
  roofSheetSpec?: string;
  roofInsulationSpec?: string;
  wallCladdingSpec?: string;
  structuralSystem?: string;
  craneInfo?: string;
  factoryFootprint?: number;
  totalArea?: number;
  numFloors?: string;
}

export interface DrawingFacts {
  projectType?: string;
  drawingTitle?: string;
  projectNameFromDrawing?: string;
  clientFromDrawing?: string;
  locationFromDrawing?: string;
  scopeSummary?: string;
  mainUse?: string;
  roofSlope?: string;
  roofSheetSpec?: string;
  roofInsulationSpec?: string;
  wallCladdingSpec?: string;
  structuralSystem?: string;
  buildingFootprintFromDrawing?: string;
  totalFloorAreaFromDrawing?: string;
  mainFactoryRoofDimensions?: string;
  clearHeightFromDrawing?: string;
  numberOfFloorsFromDrawing?: string;
  confirmedItems?: string[];
  boqCandidateItems?: unknown[][];
  roomAreas?: unknown[][];
  workPackages?: unknown[][];
}

export interface CriticalFacts {
  projectType: string;
  roofSlope: string | null;
  roofSheetSpec: string | null;
  roofInsulationSpec: string | null;
  wallCladdingSpec: string;
  structuralSystem: string;
  gfa: number;
  factoryFootprint: number;
  userArea: number;
  confirmedSummary: string;
  confirmedItems: string[];
  boqCandidateItems: unknown[][];
  roomAreas: unknown[][];
  workPackages: unknown[][];
}

export interface GeoQuantities {
  factoryLength: number;
  factoryWidth: number;
  factoryFootprint: number;
  slopeFactor: string;
  mainRoofSheetArea: number;
  canopyArea: number;
  totalRoofSheetArea: number;
  insulatedRoofArea: number;
  nonInsulatedRoofArea: number;
  perimeter: number;
  metalWallArea: number;
  brickBaseArea: number;
  groundFloorArea: number;
  siteArea: number;
  sitePerimeter: number;
  roadArea: number;
  greenArea: number;
  steelRafterTon: number;
  steelPurlinTon: number;
}

export interface CraneData {
  found: boolean;
  count?: number;
  descriptions?: string[];
  promptNote: string;
}

export interface BuildingPackage {
  name: string;
  area?: number;
  floors?: number;
  type?: string;
  note?: string;
  scopeNote?: string;
  confidence?: string;
}

export interface BuildingPackages {
  packages: BuildingPackage[];
  totalArea: number;
  summary: string;
}

export type BOQRow = [
  string, string, string, string,
  number | string, string,
  number | string, number | string, number | string,
  string, string, string, string
];

export interface ProjectSummary {
  projectName: string;
  clientName: string;
  location: string;
  buildingType: string;
  specLevel: string;
  detectedType: string;
  totalFloorArea: string;
  numFloors: string;
  estimateClass: string;
  confirmedData?: string[][];
  assumedData?: string[][];
  missingData?: string[][];
  excludedScope?: string[][];
  totalBase: number;
  totalLow: number;
  totalHigh: number;
}

export interface BOQData {
  projectSummary?: ProjectSummary;
  boqItems?: BOQRow[];
  takeOffDetail?: unknown[][];
  assumptions?: unknown[][];
  clarificationQuestions?: unknown[][];
  riskRegister?: unknown[][];
  hiddenItemsChecklist?: unknown[][];
  crossCheck?: unknown[][];
}

export interface QSGenerationResult {
  success: boolean;
  jobId?: string;
  excelBuffer?: Buffer;
  filename?: string;
  message?: string;
  error?: string;
}
