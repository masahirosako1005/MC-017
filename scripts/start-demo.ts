// `npm run start:demo`: DEMO_MODE=1 で起動する（PowerShell でも cmd でも同じ書き方で動かすため）。VOICEVOX も一緒に起動する
import { ensureVoicevox } from './launch-voicevox.ts';

process.env.DEMO_MODE = '1';
await ensureVoicevox();
await import('../app/server/src/main.ts');
