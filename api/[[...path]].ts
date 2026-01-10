import { VercelRequest, VercelResponse } from '@vercel/node';
import { fail } from '../src/utils/responses';

import indexHandler from '../api_handlers/index';
import healthHandler from '../api_handlers/health';
import metadataHandler from '../api_handlers/metadata';

import ordersHandler from '../api_handlers/orders/index';
import orderByIdHandler from '../api_handlers/orders/[id]';

import quotesHandler from '../api_handlers/quotes/index';
import quoteByIdHandler from '../api_handlers/quotes/[id]';
import quoteConvertHandler from '../api_handlers/quotes/[id]/convert-to-order';
import quoteVendorApproveHandler from '../api_handlers/quotes/[id]/vendor-approve';
import quoteAdminApproveHandler from '../api_handlers/quotes/[id]/admin-approve';
import quotesVendorPendingHandler from '../api_handlers/quotes/vendor/pending';

import categoriesHandler from '../api_handlers/categories/index';
import categoryByIdHandler from '../api_handlers/categories/[id]';

import inventoryUploadHandler from '../api_handlers/inventory/upload';

import notificationsHandler from '../api_handlers/notifications/index';

import productsHandler from '../api_handlers/products/index';
import productByIdHandler from '../api_handlers/products/[id]';
import productBySlugHandler from '../api_handlers/products/slug/[slug]';

import cartHandler from '../api_handlers/cart/index';
import cartItemHandler from '../api_handlers/cart/items/[productId]';

import supportRequestsHandler from '../api_handlers/support-requests/index';
import supportRequestByIdHandler from '../api_handlers/support-requests/[id]';

import contactMessagesHandler from '../api_handlers/contact-messages/index';

import warehouseStockHandler from '../api_handlers/warehouse/stock';
import warehouseStockExportHandler from '../api_handlers/warehouse/stock/export';
import warehouseReassignHandler from '../api_handlers/warehouse/reassign/[orderId]';
import warehouseOrdersHandler from '../api_handlers/warehouse/orders';
import warehouseStatsHandler from '../api_handlers/warehouse/stats';
import warehousePrepareHandler from '../api_handlers/warehouse/prepare/[orderId]';
import warehouseDispatchHandler from '../api_handlers/warehouse/dispatch/[orderId]';
import warehouseFamiliasHandler from '../api_handlers/warehouse/catalog/familias';
import warehouseSubfamiliasHandler from '../api_handlers/warehouse/catalog/subfamilias';
import warehouseMarcasHandler from '../api_handlers/warehouse/catalog/marcas';
import warehouseOrigenesHandler from '../api_handlers/warehouse/catalog/origenes';
import warehouseBodegasHandler from '../api_handlers/warehouse/catalog/bodegas';
import warehouseUbicacionesHandler from '../api_handlers/warehouse/catalog/ubicaciones';
import warehouseUnidadesNegocioHandler from '../api_handlers/warehouse/catalog/unidades-negocio';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

type Route = {
  pattern: RegExp;
  handler: Handler;
  params?: string[];
};

const routes: Route[] = [
  { pattern: /^\/api$/, handler: indexHandler },
  { pattern: /^\/api\/health$/, handler: healthHandler },
  { pattern: /^\/api\/metadata$/, handler: metadataHandler },

  { pattern: /^\/api\/orders$/, handler: ordersHandler },
  { pattern: /^\/api\/orders\/([^/]+)$/, handler: orderByIdHandler, params: ['id'] },

  { pattern: /^\/api\/quotes\/vendor\/pending$/, handler: quotesVendorPendingHandler },
  { pattern: /^\/api\/quotes\/([^/]+)\/convert-to-order$/, handler: quoteConvertHandler, params: ['id'] },
  { pattern: /^\/api\/quotes\/([^/]+)\/vendor-approve$/, handler: quoteVendorApproveHandler, params: ['id'] },
  { pattern: /^\/api\/quotes\/([^/]+)\/admin-approve$/, handler: quoteAdminApproveHandler, params: ['id'] },
  { pattern: /^\/api\/quotes\/([^/]+)$/, handler: quoteByIdHandler, params: ['id'] },
  { pattern: /^\/api\/quotes$/, handler: quotesHandler },

  { pattern: /^\/api\/categories$/, handler: categoriesHandler },
  { pattern: /^\/api\/categories\/([^/]+)$/, handler: categoryByIdHandler, params: ['id'] },

  { pattern: /^\/api\/inventory\/upload$/, handler: inventoryUploadHandler },

  { pattern: /^\/api\/notifications$/, handler: notificationsHandler },

  { pattern: /^\/api\/products\/slug\/([^/]+)$/, handler: productBySlugHandler, params: ['slug'] },
  { pattern: /^\/api\/products\/([^/]+)$/, handler: productByIdHandler, params: ['id'] },
  { pattern: /^\/api\/products$/, handler: productsHandler },

  { pattern: /^\/api\/cart$/, handler: cartHandler },
  { pattern: /^\/api\/cart\/items\/([^/]+)$/, handler: cartItemHandler, params: ['productId'] },

  { pattern: /^\/api\/support-requests$/, handler: supportRequestsHandler },
  { pattern: /^\/api\/support-requests\/([^/]+)$/, handler: supportRequestByIdHandler, params: ['id'] },

  { pattern: /^\/api\/contact-messages$/, handler: contactMessagesHandler },

  { pattern: /^\/api\/warehouse\/stock\/export$/, handler: warehouseStockExportHandler },
  { pattern: /^\/api\/warehouse\/stock$/, handler: warehouseStockHandler },
  { pattern: /^\/api\/warehouse\/reassign\/([^/]+)$/, handler: warehouseReassignHandler, params: ['orderId'] },
  { pattern: /^\/api\/warehouse\/orders$/, handler: warehouseOrdersHandler },
  { pattern: /^\/api\/warehouse\/stats$/, handler: warehouseStatsHandler },
  { pattern: /^\/api\/warehouse\/prepare\/([^/]+)$/, handler: warehousePrepareHandler, params: ['orderId'] },
  { pattern: /^\/api\/warehouse\/dispatch\/([^/]+)$/, handler: warehouseDispatchHandler, params: ['orderId'] },
  { pattern: /^\/api\/warehouse\/catalog\/familias$/, handler: warehouseFamiliasHandler },
  { pattern: /^\/api\/warehouse\/catalog\/subfamilias$/, handler: warehouseSubfamiliasHandler },
  { pattern: /^\/api\/warehouse\/catalog\/marcas$/, handler: warehouseMarcasHandler },
  { pattern: /^\/api\/warehouse\/catalog\/origenes$/, handler: warehouseOrigenesHandler },
  { pattern: /^\/api\/warehouse\/catalog\/bodegas$/, handler: warehouseBodegasHandler },
  { pattern: /^\/api\/warehouse\/catalog\/ubicaciones$/, handler: warehouseUbicacionesHandler },
  { pattern: /^\/api\/warehouse\/catalog\/unidades-negocio$/, handler: warehouseUnidadesNegocioHandler }
];

function getPathFromRequest(req: VercelRequest): string {
  const rawPath = req.query.path;
  let path = '/api';

  if (typeof rawPath === 'string') {
    path = `/api/${rawPath}`;
  } else if (Array.isArray(rawPath)) {
    path = `/api/${rawPath.join('/')}`;
  } else if (req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      path = parsed.pathname || '/api';
    } catch {
      path = '/api';
    }
  }

  const normalized = path.replace(/\/+$/, '');
  return normalized.length === 0 ? '/api' : normalized;
}

function applyParams(req: VercelRequest, params: string[], match: RegExpMatchArray) {
  const values: Record<string, string> = {};
  params.forEach((param, index) => {
    const rawValue = match[index + 1];
    values[param] = rawValue ? decodeURIComponent(rawValue) : rawValue;
  });
  Object.assign(req.query, values);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = getPathFromRequest(req);

  for (const route of routes) {
    const match = path.match(route.pattern);
    if (!match) continue;

    if (route.params) {
      applyParams(req, route.params, match);
    }

    return route.handler(req, res);
  }

  return fail(res, 'Endpoint no encontrado', 404);
}
