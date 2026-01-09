import { collectionRef } from '../lib/firestore';

export interface WarehouseStockItem {
  familia?: string;
  subfamilia?: string;
  producto?: string;
  unidad?: string;
  unidadNegocio?: string;
  bodega?: string;
  ubicacion?: string;
  serie?: string | null;
  lote?: string | null;
  fechaVencimiento?: string | null;
  porLlegar?: number;
  reserva?: number;
  saldoStock?: number;
  codigoArticulo?: string;
  marca?: string;
  origen?: string;
  isTemporaryStock?: boolean;
  date?: string;
}

export interface WarehouseStockSummary {
  totalStock: number;
  totalReserva: number;
  totalPorLlegar: number;
}

export interface WarehouseStockFilters {
  date?: string;
  familia?: string;
  subfamilia?: string;
  bodega?: string;
  ubicacion?: string;
  codigoArticulo?: string;
  unidadNegocio?: string;
  marca?: string;
  origen?: string;
  includeTemporaryStock?: boolean;
  hideNoStock?: boolean;
  search?: string;
}

export function parseBoolean(value: unknown): boolean {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    return value === 'true' || value === '1' || value === 'yes';
  }
  return false;
}

function matchesSearch(item: WarehouseStockItem, search: string): boolean {
  const haystack = [
    item.producto,
    item.familia,
    item.subfamilia,
    item.bodega,
    item.ubicacion,
    item.codigoArticulo,
    item.marca,
    item.origen,
    item.unidadNegocio
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(search);
}

export async function fetchWarehouseStock(filters: WarehouseStockFilters) {
  let query: any = collectionRef('warehouseStock');

  if (filters.date) query = query.where('date', '==', filters.date);
  if (filters.familia) query = query.where('familia', '==', filters.familia);
  if (filters.subfamilia) query = query.where('subfamilia', '==', filters.subfamilia);
  if (filters.bodega) query = query.where('bodega', '==', filters.bodega);
  if (filters.ubicacion) query = query.where('ubicacion', '==', filters.ubicacion);
  if (filters.codigoArticulo) query = query.where('codigoArticulo', '==', filters.codigoArticulo);
  if (filters.unidadNegocio) query = query.where('unidadNegocio', '==', filters.unidadNegocio);
  if (filters.marca) query = query.where('marca', '==', filters.marca);
  if (filters.origen) query = query.where('origen', '==', filters.origen);
  if (!filters.includeTemporaryStock) {
    query = query.where('isTemporaryStock', '==', false);
  }
  if (filters.hideNoStock) {
    query = query.where('saldoStock', '>', 0);
  }

  const snapshot = await query.get();

  let items: WarehouseStockItem[] = snapshot.docs.map((doc: any) => doc.data());

  if (filters.hideNoStock) {
    items = items.filter(item => (item.saldoStock ?? 0) > 0);
  }

  if (filters.search) {
    const search = filters.search.toLowerCase();
    items = items.filter(item => matchesSearch(item, search));
  }

  const summary = items.reduce<WarehouseStockSummary>(
    (acc, item) => {
      acc.totalStock += item.saldoStock ?? 0;
      acc.totalReserva += item.reserva ?? 0;
      acc.totalPorLlegar += item.porLlegar ?? 0;
      return acc;
    },
    { totalStock: 0, totalReserva: 0, totalPorLlegar: 0 }
  );

  return { items, summary };
}

export async function fetchCatalogValues(
  field: keyof WarehouseStockItem,
  filters: Pick<WarehouseStockFilters, 'familia' | 'bodega'> = {}
) {
  let query: any = collectionRef('warehouseStock');

  if (filters.familia) query = query.where('familia', '==', filters.familia);
  if (filters.bodega) query = query.where('bodega', '==', filters.bodega);

  const snapshot = await query.get();
  const values = new Set<string>();

  snapshot.docs.forEach((doc: any) => {
    const value = doc.data()?.[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      values.add(value.trim());
    }
  });

  return Array.from(values).sort((a, b) => a.localeCompare(b));
}
