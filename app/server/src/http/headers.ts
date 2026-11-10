import type { RequestHandler } from 'express';

// 非機能・セキュリティ設計 §1、ADR-003。HSTS は送らない（ユーザー指定）。
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: https://cyberjapandata.gsi.go.jp",
  "style-src 'self'",
  'media-src blob:',
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

export const PERMISSIONS_POLICY = [
  'accelerometer=()', 'autoplay=(self)', 'camera=()', 'display-capture=()', 'geolocation=()', 'gyroscope=()',
  'magnetometer=()', 'microphone=()', 'midi=()', 'payment=()', 'usb=()', 'serial=()', 'bluetooth=()',
  'xr-spatial-tracking=()', 'browsing-topics=()',
].join(', ');

export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', req.path.startsWith('/api/') || req.path === '/api' ? 'no-store' : 'no-cache');
  next();
};
