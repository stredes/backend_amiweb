import { collectionRef } from '../../src/lib/firestore';
import { getFirebaseApp } from '../../src/lib/firebase';

export type DashboardCollections = {
  orders: any[];
  quotes: any[];
  preparations: any[];
};

async function readCollection(path: string, limit = 2000) {
  const snapshot = await collectionRef(path).limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function readDashboardCollections(): Promise<DashboardCollections> {
  const [orders, quotes, preparations] = await Promise.all([
    readCollection('orders'),
    readCollection('quotes'),
    readCollection('orderPreparations')
  ]);

  return { orders, quotes, preparations };
}

export async function countInactiveUsers(): Promise<number> {
  const app = getFirebaseApp();
  let pageToken: string | undefined;
  let inactive = 0;
  let guard = 0;

  do {
    const users = await app.auth().listUsers(1000, pageToken);
    users.users.forEach((u) => {
      if (u.disabled) inactive += 1;
    });
    pageToken = users.pageToken;
    guard += 1;
  } while (pageToken && guard < 20);

  return inactive;
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

export function buildCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    const line = headers.map((header) => csvEscape(row[header])).join(',');
    lines.push(line);
  });
  return lines.join('\n');
}
