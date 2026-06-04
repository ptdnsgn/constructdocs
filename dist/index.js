"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const qs_js_1 = __importDefault(require("./routes/qs.js"));
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000');
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
app.use('/api/qs', qs_js_1.default);
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`ConstructDocs v2 running at http://localhost:${PORT}`);
    if (!process.env.GEMINI_API_KEY) {
        console.warn('WARNING: GEMINI_API_KEY is not set in .env');
    }
});
