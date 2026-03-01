type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  _seconds?: number;
};

export type VendorScope = {
  vendorId?: string;
};

export type VendorQuoteLike = {
  id?: string;
  quoteNumber?: string;
  customerName?: string;
  customerEmail?: string;
  organization?: string;
  assignedSalesRep?: string;
  status?: string;
  total?: number;
  createdAt?: Date | string | number | TimestampLike | null;
  updatedAt?: Date | string | number | TimestampLike | null;
};

export type VendorOrderLike = {
  id?: string;
  orderNumber?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  organization?: string;
  assignedSalesRep?: string;
  status?: string;
  total?: number;
  quoteId?: string;
  createdAt?: Date | string | number | TimestampLike | null;
};

export type VendorClientLike = {
  id?: string;
  name?: string;
  email?: string;
  company?: string;
  status?: string;
  assignedSalesRep?: string;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object') {
    const ts = value as TimestampLike;
    if (typeof ts.toDate === 'function') {
      const date = ts.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const seconds = ts.seconds ?? ts._seconds;
    if (typeof seconds === 'number') {
      const date = new Date(seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, decimals = 2): number {
  const m = 10 ** decimals;
  return Math.round(value * m) / m;
}

export function parseDateRange(query: Record<string, unknown>) {
  const now = new Date();
  const dateFromRaw = typeof query.dateFrom === 'string' ? query.dateFrom : undefined;
  const dateToRaw = typeof query.dateTo === 'string' ? query.dateTo : undefined;
  const dateFrom = dateFromRaw ? new Date(dateFromRaw) : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const dateTo = dateToRaw ? new Date(dateToRaw) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const from = Number.isNaN(dateFrom.getTime()) ? new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0) : dateFrom;
  const to = Number.isNaN(dateTo.getTime()) ? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) : dateTo;
  return { from, to };
}

function withinRange(value: unknown, from: Date, to: Date): boolean {
  const date = toDate(value);
  if (!date) return false;
  return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
}

export function applyVendorScope<T extends Record<string, any>>(items: T[], scope: VendorScope): T[] {
  if (!scope.vendorId) return items;
  return items.filter((item) => item.assignedSalesRep === scope.vendorId);
}

function mapOrderCommercialStatus(orderStatus: string | undefined): string {
  switch (orderStatus) {
    case 'pendiente':
      return 'pendiente_vendedor';
    case 'confirmado':
      return 'pendiente_admin';
    case 'procesando':
      return 'preparacion';
    case 'enviado':
      return 'en_transito';
    case 'entregado':
      return 'completado';
    case 'cancelado':
      return 'cancelado';
    default:
      return 'desconocido';
  }
}

export function computeVendorKpis(
  quotes: VendorQuoteLike[],
  orders: VendorOrderLike[],
  clients: VendorClientLike[],
  options?: { dateFrom?: Date; dateTo?: Date; commissionRate?: number }
) {
  const dateFrom = options?.dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const dateTo = options?.dateTo || new Date();
  const commissionRate = options?.commissionRate ?? 0.05;

  const ordersInRange = orders.filter((order) => withinRange(order.createdAt, dateFrom, dateTo));
  const validOrders = ordersInRange.filter((order) => order.status !== 'cancelado');
  const completed = validOrders.filter((order) => order.status === 'entregado');
  const sales = validOrders.reduce((acc, order) => acc + toNumber(order.total), 0);
  const avgTicket = validOrders.length > 0 ? sales / validOrders.length : 0;

  const activeClients = clients.filter((client) => client.status !== 'inactivo' && client.status !== 'suspendido');
  const closedQuotes = quotes.filter((quote) => quote.status === 'aprobado' || quote.status === 'convertida').length;
  const closeRate = quotes.length > 0 ? (closedQuotes / quotes.length) * 100 : 0;

  return {
    period: {
      from: dateFrom.toISOString(),
      to: dateTo.toISOString()
    },
    sales: round(sales),
    commission: round(sales * commissionRate),
    activeClients: activeClients.length,
    completedOrders: completed.length,
    closeRate: round(closeRate),
    averageTicket: round(avgTicket)
  };
}

export function computeVendorPipeline(quotes: VendorQuoteLike[]) {
  const buckets = {
    nuevas: 0,
    negociacion: 0,
    aprobacion: 0,
    riesgo: 0
  };

  quotes.forEach((quote) => {
    const status = quote.status || '';
    if (status === 'pendiente' || status === 'en_revision_vendedor') buckets.nuevas += 1;
    else if (status === 'aprobado_vendedor' || status === 'en_revision_admin') buckets.negociacion += 1;
    else if (status === 'aprobado' || status === 'convertida') buckets.aprobacion += 1;
    else if (status === 'rechazado_vendedor' || status === 'rechazado' || status === 'vencida') buckets.riesgo += 1;
  });

  const total = quotes.length;
  return {
    ...buckets,
    total,
    conversionRate: total > 0 ? round(((buckets.aprobacion) / total) * 100) : 0
  };
}

export function buildVendorAgenda(quotes: VendorQuoteLike[], orders: VendorOrderLike[]) {
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);

  const dailyFollowUps = quotes
    .filter((quote) => quote.status === 'pendiente' || quote.status === 'en_revision_vendedor')
    .filter((quote) => {
      const updated = toDate(quote.updatedAt || quote.createdAt);
      return !updated || updated.getTime() < dayStart.getTime();
    })
    .slice(0, 50)
    .map((quote) => ({
      id: quote.id || '',
      quoteNumber: quote.quoteNumber || '',
      customerName: quote.customerName || '',
      status: quote.status || '',
      updatedAt: toDate(quote.updatedAt || quote.createdAt)?.toISOString() || null
    }));

  const tasks = quotes
    .filter((quote) => quote.status === 'aprobado_vendedor' || quote.status === 'en_revision_admin')
    .slice(0, 50)
    .map((quote) => ({
      id: quote.id || '',
      quoteNumber: quote.quoteNumber || '',
      customerName: quote.customerName || '',
      task: 'Esperando aprobación administrativa',
      status: quote.status || ''
    }));

  const inTransit = orders
    .filter((order) => order.status === 'enviado')
    .slice(0, 50)
    .map((order) => ({
      id: order.id || '',
      orderNumber: order.orderNumber || '',
      customerName: order.customerName || '',
      status: order.status || '',
      total: toNumber(order.total)
    }));

  return {
    summary: {
      followUps: dailyFollowUps.length,
      tasks: tasks.length,
      inTransit: inTransit.length
    },
    dailyFollowUps,
    tasks,
    inTransit
  };
}

export function computeVendorClientsMetrics(clients: VendorClientLike[], orders: VendorOrderLike[]) {
  return clients.map((client) => {
    const clientOrders = orders.filter((order) => {
      const byEmail = client.email && order.customerEmail && client.email.toLowerCase() === order.customerEmail.toLowerCase();
      const byName = client.name && order.customerName && client.name.trim().toLowerCase() === order.customerName.trim().toLowerCase();
      const byCompany = client.company && order.organization && client.company.trim().toLowerCase() === order.organization.trim().toLowerCase();
      return Boolean(byEmail || byName || byCompany);
    });

    const totalSales = clientOrders.reduce((acc, order) => acc + toNumber(order.total), 0);
    const lastOrder = clientOrders
      .map((order) => toDate(order.createdAt))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      ...client,
      totalSales: round(totalSales),
      orderCount: clientOrders.length,
      lastOrderAt: lastOrder ? lastOrder.toISOString() : null
    };
  });
}

export function mapVendorOrders(orders: VendorOrderLike[], quoteMap: Map<string, VendorQuoteLike>) {
  return orders.map((order) => {
    const quote = order.quoteId ? quoteMap.get(order.quoteId) : undefined;
    const quoteStatus = quote?.status;
    return {
      ...order,
      quoteStatus: quoteStatus || null,
      commercialStatus: quoteStatus || mapOrderCommercialStatus(order.status)
    };
  });
}
