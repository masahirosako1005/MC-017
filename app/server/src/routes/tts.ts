// API 16・17（ADR-011）
import { Router } from 'express';
import { noQuerySchema, ttsBodySchema } from '../../../shared/schemas.ts';
import { parse } from '../http/errors.ts';
import type { Tts } from '../services/tts-service.ts';

export function ttsRoutes(tts: Tts): Router {
  const r = Router();

  r.get('/tts/status', (req, res) => {
    parse(noQuerySchema, req.query);
    res.json(tts.status());
  });

  r.post('/tts', async (req, res) => {
    const body = parse(ttsBodySchema, req.body);
    const wav = await tts.synth(body.avatarId, body.text);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.send(wav);
  });

  return r;
}
