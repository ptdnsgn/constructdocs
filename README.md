# ConstructDocs v2

AI-powered QS Preliminary Cost Estimate generator.
Built with Node.js + TypeScript. No execution time limits.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env and add your Gemini API key
```

### 3. Run in development
```bash
npm run dev
```
Open http://localhost:3000

### 4. Build for production
```bash
npm run build
npm start
```

## Project Structure

```
src/
  index.ts                  # Express server entry point
  types/index.ts            # TypeScript interfaces
  routes/qs.ts              # API routes
  services/
    gemini.ts               # Gemini API wrapper with retry
    qsExtraction.ts         # Drawing facts extraction
    qsCalculations.ts       # Geometry, cranes, packages
    qsHandler.ts            # Main orchestration (Part A + B in parallel)
    quantityInjector.ts     # Post-processing TBC replacements
    excelBuilder.ts         # 8-tab Excel output
  prompts/
    boqPrompts.ts           # Part A and Part B Gemini prompts
public/
  index.html                # Frontend UI
```

## Key Improvements Over Apps Script

| Feature | Apps Script | Node.js v2 |
|---|---|---|
| Execution time limit | 6 minutes hard cap | None |
| Part A + B generation | Sequential (slow) | Parallel with Promise.all |
| TypeScript | No | Yes — full type safety |
| Error handling | Limited | Proper try/catch + retry |
| Debugging | Logger only | console.log + any tool |
| Deployment | Tied to Google | Any cloud provider |

## Deployment

### Railway (recommended for quick start)
1. Push to GitHub
2. Connect repo to Railway
3. Set GEMINI_API_KEY environment variable
4. Deploy

### Cloud Run
```bash
gcloud run deploy constructdocs \
  --source . \
  --set-env-vars GEMINI_API_KEY=your_key \
  --allow-unauthenticated
```

## API

### POST /api/qs/generate
Multipart form data:
- `projectName` (required)
- `clientName` (required)
- `location`
- `buildingType`
- `specLevel`
- `totalArea`
- `numFloors`
- `createdBy`
- `drawing` (optional — PDF file)

Returns: Excel file (.xlsx) as download

### GET /api/qs/health
Returns server status and whether Gemini key is set.
