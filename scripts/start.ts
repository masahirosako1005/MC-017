// `npm start`: VOICEVOX ENGINE を先に起動してから、アプリのサーバーを起動する
import { ensureVoicevox } from './launch-voicevox.ts';

await ensureVoicevox();
await import('../app/server/src/main.ts');
