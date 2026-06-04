"use strict";
// src/services/gemini.ts
// Wraps the Gemini API with retry logic and no execution time limits.
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiText = geminiText;
exports.geminiWithFile = geminiWithFile;
exports.stripFences = stripFences;
exports.parseGeminiJson = parseGeminiJson;
const generative_ai_1 = require("@google/generative-ai");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const MODEL = 'gemini-2.5-flash';
// ── Retry helper ─────────────────────────────────────────────────────────────
async function withRetry(fn, maxAttempts = 4, baseDelayMs = 15000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const isRateLimit = message.includes('429') ||
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
async function geminiText(prompt, maxOutputTokens = 32768) {
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
async function geminiWithFile(prompt, fileBase64, mimeType, maxOutputTokens = 8192) {
    return withRetry(async () => {
        const model = genAI.getGenerativeModel({
            model: MODEL,
            generationConfig: { maxOutputTokens }
        });
        const parts = [
            { inlineData: { mimeType, data: fileBase64 } },
            { text: prompt }
        ];
        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        return result.response.text();
    });
}
// ── Strip markdown code fences from Gemini response ──────────────────────────
function stripFences(raw) {
    return raw
        .replace(/^```json\s*/im, '')
        .replace(/^```\s*/im, '')
        .replace(/```\s*$/m, '')
        .trim();
}
// ── Parse JSON from Gemini response with truncation recovery ─────────────────
function parseGeminiJson(raw, label) {
    const cleaned = stripFences(raw);
    // Attempt 1: full parse
    try {
        return JSON.parse(cleaned);
    }
    catch {
        console.log(`[Gemini] ${label}: full JSON parse failed — trying salvage`);
    }
    // Attempt 2: salvage truncated response
    // Find the last complete BOQ row: ends with ] followed by , and [
    try {
        const arrayStart = cleaned.indexOf('"boqItems"');
        if (arrayStart === -1)
            return null;
        let lastGoodEnd = -1;
        const pattern = /\]\s*,\s*\[/g;
        let match;
        while ((match = pattern.exec(cleaned)) !== null) {
            lastGoodEnd = match.index + 1;
        }
        if (lastGoodEnd === -1)
            return null;
        const openBracket = cleaned.indexOf('[', arrayStart);
        const salvaged = '{"boqItems":' +
            cleaned.substring(openBracket, lastGoodEnd + 1) +
            ']}';
        const fixed = salvaged.replace(/,\s*([\}\]])/g, '$1');
        const result = JSON.parse(fixed);
        console.log(`[Gemini] ${label}: salvaged partial response`);
        return result;
    }
    catch {
        console.log(`[Gemini] ${label}: salvage also failed`);
        return null;
    }
}
