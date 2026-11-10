// `npm run start:admin`: 運営向け画面つき（ADMIN_MODE=1）で、デモ（DEMO_MODE=1・ダミーの利用者つき）で起動する
export {};
process.env.DEMO_MODE = '1';
process.env.ADMIN_MODE = '1';
await import('../app/server/src/main.ts');
