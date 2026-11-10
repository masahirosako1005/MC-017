import { z } from 'zod';

const envSchema = z.strictObject({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_PATH: z.string().min(1).max(260).default('data/app.db'),
  SAMPLE_DATA_DIR: z.string().min(1).max(260).default('C:\\AI-Sprint\\sample-data'),
  DEMO_MODE: z.enum(['0', '1']).default('0'),
  ADMIN_MODE: z.enum(['0', '1']).default('1'),
  VOICEVOX_PORT: z.coerce.number().int().min(1).max(65535).default(50021),
});

export interface Env {
  port: number;
  dbPath: string;
  sampleDataDir: string;
  demoMode: boolean;
  /** 1 のときだけ /admin と /api/admin/* を出す（運営向け、U-09〜U-12） */
  adminMode: boolean;
  voicevoxPort: number;
}

/** 使う環境変数だけを取り出して検証する（ほかの環境変数は見ない） */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const picked: Record<string, string> = {};
  for (const key of Object.keys(envSchema.shape)) {
    const v = source[key];
    if (v !== undefined && v !== '') picked[key] = v;
  }
  const r = envSchema.safeParse(picked);
  if (!r.success) {
    const keys = r.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`環境変数が正しくありません: ${keys}`);
  }
  return {
    port: r.data.PORT,
    dbPath: r.data.DB_PATH,
    sampleDataDir: r.data.SAMPLE_DATA_DIR,
    demoMode: r.data.DEMO_MODE === '1',
    adminMode: r.data.ADMIN_MODE === '1',
    voicevoxPort: r.data.VOICEVOX_PORT,
  };
}
