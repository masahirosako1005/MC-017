// 運営向け API（ADMIN_MODE=1 のときだけ登録、U-09〜U-12）。ログインは作らない（ダミー）。
// 役割は X-Operator（association | shop-s8 | shop-s9 | shop-s11）で、別の店の URL は 404（自分の店だけ、ADR-024）。
import { Router, type Response } from 'express';
import type { Ctx } from '../services/context.ts';
import {
  campaignBodySchema, noteParamsSchema, operatorSchema,
  shopOf, shopParamsSchema, summaryQuerySchema, voicesQuerySchema, type Operator,
} from '../../../shared/admin.ts';
import type { ShopId } from '../../../shared/master/campaigns.ts';
import { emptyBodySchema } from '../../../shared/schemas.ts';
import { HttpError, parse } from '../http/errors.ts';
import { summaryOf } from '../services/admin-metrics-service.ts';
import {
  createCampaign, demandOf, listCampaigns,
} from '../services/campaign-service.ts';
import { confirmVoice, shopSummaryOf, voicesOf } from '../services/shop-summary-service.ts';

function operatorOf(res: Response): Operator {
  const v = res.locals.operator;
  if (typeof v !== 'string') throw new HttpError(400, 'bad_request');
  return parse(operatorSchema, v);
}

/** 観光協会だけ。ほかは 404 */
function onlyAssociation(res: Response): void {
  if (operatorOf(res) !== 'association') throw new HttpError(404, 'not_found');
}

/** URL の店が自分の店のときだけ。allowAssociation なら観光協会も（集計の閲覧）。ほかは 404 */
function onlyOwnShop(res: Response, shopId: ShopId, allowAssociation = false): void {
  const op = operatorOf(res);
  if (allowAssociation && op === 'association') return;
  if (shopOf(op) !== shopId) throw new HttpError(404, 'not_found');
}

function daysOf(v: 'all' | '7' | '28' | '90'): number | null {
  return v === 'all' ? null : Number(v);
}

export function adminRoutes(ctx: Ctx): Router {
  const r = Router();

  r.use('/admin', (req, res, next) => {
    const h = req.get('x-operator');
    const p = operatorSchema.safeParse(h);
    if (!p.success) {
      next(new HttpError(400, 'bad_request'));
      return;
    }
    res.locals.operator = p.data;
    next();
  });

  r.get('/admin/summary', (req, res) => {
    onlyAssociation(res);
    const q = parse(summaryQuerySchema, req.query);
    res.json(summaryOf(ctx, daysOf(q.days)));
  });

  r.get('/admin/shops/:shopId/summary', (req, res) => {
    const { shopId } = parse(shopParamsSchema, req.params);
    onlyOwnShop(res, shopId, true);
    const q = parse(summaryQuerySchema, req.query);
    res.json(shopSummaryOf(ctx, shopId, daysOf(q.days)));
  });

  r.get('/admin/shops/:shopId/demand', (req, res) => {
    const { shopId } = parse(shopParamsSchema, req.params);
    onlyOwnShop(res, shopId);
    res.json(demandOf(ctx, shopId));
  });

  r.get('/admin/shops/:shopId/campaigns', (req, res) => {
    const { shopId } = parse(shopParamsSchema, req.params);
    onlyOwnShop(res, shopId);
    res.json(listCampaigns(ctx, shopId));
  });

  r.post('/admin/shops/:shopId/campaigns', (req, res) => {
    const { shopId } = parse(shopParamsSchema, req.params);
    onlyOwnShop(res, shopId);
    const body = parse(campaignBodySchema, req.body);
    res.json(createCampaign(ctx, shopId, body));
  });

  r.get('/admin/shops/:shopId/voices', (req, res) => {
    const { shopId } = parse(shopParamsSchema, req.params);
    onlyOwnShop(res, shopId);
    const q = parse(voicesQuerySchema, req.query);
    res.json(voicesOf(ctx, shopId, q.show));
  });

  r.post('/admin/shops/:shopId/voices/:noteId/confirm', (req, res) => {
    const p = parse(noteParamsSchema, req.params);
    onlyOwnShop(res, p.shopId);
    parse(emptyBodySchema, req.body ?? {});
    res.json(confirmVoice(ctx, p.shopId, p.noteId));
  });

  return r;
}
