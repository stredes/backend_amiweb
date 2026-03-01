import type { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef } from '../../src/lib/firestore';
import { fail } from '../../src/utils/responses';

export function resolveVendorScope(req: VercelRequest, res: VercelResponse): { vendorId?: string; denied: boolean } {
  const user = (req as any).user as { uid: string; role?: string } | undefined;
  const requestedVendorId = typeof req.query.vendorId === 'string' ? req.query.vendorId : undefined;

  if (!user) return { denied: true };

  if (user.role === 'vendedor') {
    if (requestedVendorId && requestedVendorId !== user.uid) {
      fail(res, 'FORBIDDEN: vendorId fuera de cartera asignada', 403, undefined, 'FORBIDDEN');
      return { denied: true };
    }
    return { vendorId: user.uid, denied: false };
  }

  // Admin/root pueden consultar por vendedor específico; si no envían vendorId ven global.
  return { vendorId: requestedVendorId, denied: false };
}

async function readCollection(path: string, limit = 3000): Promise<any[]> {
  const snapshot = await collectionRef(path).limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
}

export async function readVendorCollections() {
  const [quotes, orders, clients] = await Promise.all([
    readCollection('quotes'),
    readCollection('orders'),
    readCollection('customers')
  ]);
  return { quotes, orders, clients };
}

export function csvEscape(value: unknown) {
  if (value === null || value === undefined) return '""';
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

export function buildCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  });
  return lines.join('\n');
}
