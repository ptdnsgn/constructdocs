import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import qsRouter from './routes/qs.js';

const app  = express();
const PORT = parseInt(process.env.PORT || '3000');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/qs', qsRouter);

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ConstructDocs v2 running at http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not set in .env');
  }
});