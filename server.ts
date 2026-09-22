import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '25mb' }));

  // Gemini API client
  const apiKey = process.env.GEMINI_API_KEY || '';
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // AI Endpoint: Intelligent semantic landmark extraction using Gemini 3.8 Flash
  app.post('/api/ai-feature-landmarks', async (req, res) => {
    try {
      const { baseImageBase64, targetImageBase64, mimeType = 'image/jpeg' } = req.body;

      if (!baseImageBase64 || !targetImageBase64) {
        return res.status(400).json({ error: 'Missing base or target image data' });
      }

      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY not configured. Using client-side algorithmic registration.',
        });
      }

      const prompt = `You are a precision photogrammetry and computer vision registration expert.
Analyze these two images. Image 1 is the Master Reference Base. Image 2 is the Target Image that needs to be aligned to Image 1.

Find between 4 and 8 corresponding matching visual landmark points visible in BOTH images (such as distinct corners, high-contrast intersections, texture vertices, or prominent unique details).
For each corresponding landmark, output its (x, y) coordinates normalized to a 0 to 1000 integer grid (where 0,0 is top-left, 1000,1000 is bottom-right).

Return ONLY valid JSON strictly matching this schema:
{
  "landmarks": [
    {
      "name": "string label (e.g. leaf_tip, window_corner)",
      "base": { "x": number, "y": number },
      "target": { "x": number, "y": number }
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: baseImageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
                },
              },
              {
                inlineData: {
                  mimeType,
                  data: targetImageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text?.trim() || '{}';
      const parsedData = JSON.parse(responseText);

      return res.json({
        success: true,
        landmarks: parsedData.landmarks || [],
      });
    } catch (err: any) {
      console.error('Gemini landmark extraction error:', err);
      return res.status(500).json({
        error: err.message || 'Failed to detect landmarks with AI',
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', hasGeminiKey: !!apiKey });
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`AlignForge server running on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
