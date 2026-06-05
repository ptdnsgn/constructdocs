// src/services/gemini.ts
// Wraps the Gemini API with retry logic and no execution time limits.

import { GoogleGenerativeAI, Part } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const MODEL = 'gemini-2.5-flash';

// ── Retry helper ─────────────────────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
  baseDelayMs = 15000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        message.includes('429') ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('rate') ||
        message.includes('quota');

      if (isRateLimit && attempt < maxAttempts) {
        const waitMs = baseDelayMs * attempt; // 15s, 30s, 45s
        console.log(`[Gemini] Rate limit hit (attempt ${attempt}) — waiting ${waitMs / 1000}s`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Gemini: max attempts exceeded');
}

// ── Text-only call ────────────────────────────────────────────────────────────
export async function geminiText(
  prompt: string,
  maxOutputTokens = 32768
): Promise<string> {
  return withRetry(async () => {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { maxOutputTokens }
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  });
}

// ── Text + file (PDF or image) ────────────────────────────────────────────────
export async function geminiWithFile(
  prompt: string,
  fileBase64: string,
  mimeType: string,
  maxOutputTokens = 8192
): Promise<string> {
  return withRetry(async () => {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { maxOutputTokens }
    });

    const parts: Part[] = [
      { inlineData: { mimeType, data: fileBase64 } },
      { text: prompt }
    ];

    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    return result.response.text();
  });
}

// ── Text + multiple files (images or PDFs) ───────────────────────────────────
export async function geminiWithFiles(
  prompt: string,
  files: { base64: string; mimeType: string; label?: string }[],
  maxOutputTokens = 8192
): Promise<string> {
  return withRetry(async () => {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { maxOutputTokens }
    });

    const parts: Part[] = [];

    files.forEach((f, i) => {
      const label = f.label || `Image ${i + 1}`;
      parts.push({ text: `--- ${label} ---` });
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } });
    });

    parts.push({ text: prompt });

    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    return result.response.text();
  });
}

// ── Strip markdown code fences from Gemini response ──────────────────────────
export function stripFences(raw: string): string {
  return raw
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/m, '')
    .trim();
}

// ── Parse JSON from Gemini response with truncation recovery ─────────────────
export function parseGeminiJson<T>(raw: string, label: string): T | null {
  const cleaned = stripFences(raw);

  // Attempt 1: full parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.log(`[Gemini] ${label}: full JSON parse failed — trying salvage`);
  }

  // Attempt 2: salvage truncated response
  // Find the last complete BOQ row: ends with ] followed by , and [
  try {
    const arrayStart = cleaned.indexOf('"boqItems"');
    if (arrayStart === -1) return null;

    let lastGoodEnd = -1;
    const pattern = /\]\s*,\s*\[/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cleaned)) !== null) {
      lastGoodEnd = match.index + 1;
    }
    if (lastGoodEnd === -1) return null;

    const openBracket = cleaned.indexOf('[', arrayStart);
    const salvaged =
      '{"boqItems":' +
      cleaned.substring(openBracket, lastGoodEnd + 1) +
      ']}';
    const fixed = salvaged.replace(/,\s*([\}\]])/g, '$1');
    const result = JSON.parse(fixed) as T;
    console.log(`[Gemini] ${label}: salvaged partial response`);
    return result;
  } catch {
    console.log(`[Gemini] ${label}: salvage also failed`);
    return null;
  }
}
