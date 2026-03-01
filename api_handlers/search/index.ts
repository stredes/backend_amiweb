import type { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef } from '../../src/lib/firestore';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { requireAuth } from '../../src/middleware/auth';
import { handleError } from '../../src/utils/errorHandler';
import { fail, ok } from '../../src/utils/responses';

function normalize(value: unknown): string {
  return String(value || '').toLowerCase().trim();
}

function contains(text: unknown, term: string): boolean {
  return normalize(text).includes(term);
}

function parseLimit(raw: unknown, defaultValue = 20): number {
  if (typeof raw !== 'string') return defaultValue;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return defaultValue;
  return Math.max(1, Math.min(value, 100));
}

async function readDocs(path: string, limit: number): Promise<any[]> {
  const snapshot = await collectionRef(path).limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  try {
    if (req.method !== 'GET') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = parseLimit(req.query.limit, 20);
    const scope = typeof req.query.scope === 'string' ? req.query.scope : 'catalog';
    if (!query || query.length < 2) {
      requestLogger.end(400);
      return fail(res, 'Parámetro q requerido (mínimo 2 caracteres)', 400, undefined, 'VALIDATION_ERROR');
    }

    const term = normalize(query);
    const [products, categories] = await Promise.all([
      readDocs('products', 1000),
      readDocs('categories', 500)
    ]);

    const categoryNameById = new Map<string, string>();
    categories.forEach((category) => {
      categoryNameById.set(String(category.id), String(category.name || ''));
    });

    const productMatches = products
      .filter((product) => product.isActive !== false)
      .filter((product) => {
        const categoryName = categoryNameById.get(String(product.categoryId || '')) || '';
        return (
          contains(product.name, term) ||
          contains(product.brand, term) ||
          contains(product.code, term) ||
          contains(product.slug, term) ||
          contains(categoryName, term)
        );
      })
      .slice(0, limit)
      .map((product) => ({
        id: product.id,
        type: 'product',
        name: product.name || '',
        code: product.code || '',
        brand: product.brand || '',
        categoryId: product.categoryId || null,
        categoryName: categoryNameById.get(String(product.categoryId || '')) || null,
        price: product.price || null,
        isActive: product.isActive !== false
      }));

    const categoryMatches = categories
      .filter((category) => category.isActive !== false)
      .filter((category) => contains(category.name, term))
      .slice(0, limit)
      .map((category) => ({
        id: category.id,
        type: 'category',
        name: category.name || '',
        slug: category.slug || null,
        isActive: category.isActive !== false
      }));

    const result: Record<string, unknown> = {
      query,
      scope,
      catalog: {
        products: productMatches,
        categories: categoryMatches
      }
    };

    // scope=global incluye datos comerciales si hay sesión válida
    if (scope === 'global') {
      let isAuthenticated = false;
      try {
        isAuthenticated = await requireAuth(req, res);
      } catch {
        isAuthenticated = false;
      }

      if (!isAuthenticated) {
        requestLogger.end(401);
        return fail(res, 'Se requiere autenticación para scope=global', 401, undefined, 'TOKEN_MISSING');
      }

      const user = (req as any).user as { uid: string; role?: string };
      const [quotes, orders, customers] = await Promise.all([
        readDocs('quotes', 1000),
        readDocs('orders', 1000),
        readDocs('customers', 1000)
      ]);

      const isVendor = user.role === 'vendedor';
      const scopeByVendor = <T extends Record<string, any>>(items: T[]) =>
        isVendor ? items.filter((item) => item.assignedSalesRep === user.uid) : items;

      const quoteMatches = scopeByVendor(quotes)
        .filter((quote) => contains(quote.quoteNumber, term) || contains(quote.customerName, term) || contains(quote.customerEmail, term))
        .slice(0, limit)
        .map((quote) => ({
          id: quote.id,
          type: 'quote',
          quoteNumber: quote.quoteNumber || '',
          customerName: quote.customerName || '',
          customerEmail: quote.customerEmail || '',
          status: quote.status || ''
        }));

      const orderMatches = scopeByVendor(orders)
        .filter((order) => contains(order.orderNumber, term) || contains(order.customerName, term) || contains(order.customerEmail, term))
        .slice(0, limit)
        .map((order) => ({
          id: order.id,
          type: 'order',
          orderNumber: order.orderNumber || '',
          customerName: order.customerName || '',
          customerEmail: order.customerEmail || '',
          status: order.status || ''
        }));

      const customerMatches = scopeByVendor(customers)
        .filter((customer) => contains(customer.name, term) || contains(customer.email, term) || contains(customer.company, term))
        .slice(0, limit)
        .map((customer) => ({
          id: customer.id,
          type: 'customer',
          name: customer.name || '',
          email: customer.email || '',
          company: customer.company || '',
          status: customer.status || ''
        }));

      result.commercial = {
        quotes: quoteMatches,
        orders: orderMatches,
        customers: customerMatches
      };
    }

    requestLogger.end(200);
    return ok(res, result);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/search',
      method: req.method
    });
  }
}
