import type { AdminAssistantIntent, AssistantSuggestion } from './types';

export type AssistantPlan = {
  intent: AdminAssistantIntent;
  queryLabel: string;
  filters: Record<string, unknown>;
};

function parsePeriod(question: string): 'today' | 'week' | 'month' {
  const text = question.toLowerCase();
  if (text.includes('hoy') || text.includes('dia')) return 'today';
  if (text.includes('semana')) return 'week';
  return 'month';
}

export function inferAssistantPlan(question: string): AssistantPlan | null {
  const text = question.toLowerCase();
  const period = parsePeriod(question);

  if (text.includes('ventas') && text.includes('vendedor')) {
    return {
      intent: 'sales_by_vendor',
      queryLabel: `Ventas del ${period === 'today' ? 'dia' : period === 'week' ? 'periodo semanal' : 'mes'} por vendedor`,
      filters: { period }
    };
  }

  if (text.includes('ventas') || text.includes('facturacion') || text.includes('ingresos')) {
    return {
      intent: 'sales_by_period',
      queryLabel: `Ventas por periodo (${period})`,
      filters: { period }
    };
  }

  if (text.includes('pedido') || text.includes('orden') || text.includes('estado')) {
    return {
      intent: 'orders_by_status',
      queryLabel: 'Pedidos por estado',
      filters: { period }
    };
  }

  if ((text.includes('cliente') || text.includes('cartera')) && (text.includes('inactivo') || text.includes('sin compra'))) {
    return {
      intent: 'inactive_clients',
      queryLabel: 'Clientes inactivos',
      filters: { period }
    };
  }

  if ((text.includes('cartera') || text.includes('cliente')) && text.includes('vendedor')) {
    return {
      intent: 'portfolio_by_vendor',
      queryLabel: 'Cartera por vendedor',
      filters: {}
    };
  }

  if ((text.includes('producto') || text.includes('reactivo') || text.includes('insumo')) && (text.includes('rotacion') || text.includes('mas vendido') || text.includes('top'))) {
    return {
      intent: 'top_products',
      queryLabel: 'Productos con mayor rotacion',
      filters: { period }
    };
  }

  if (text.includes('alerta') || text.includes('operativa') || text.includes('inventario') || text.includes('bodega')) {
    return {
      intent: 'operational_alerts',
      queryLabel: 'Alertas operativas e inventario',
      filters: {}
    };
  }

  return null;
}

export function getAssistantSuggestions(): AssistantSuggestion[] {
  return [
    {
      id: 'sales-by-vendor',
      label: 'Ventas por vendedor',
      question: 'Muestrame las ventas del mes por vendedor',
      intent: 'sales_by_vendor'
    },
    {
      id: 'orders-by-status',
      label: 'Pedidos por estado',
      question: 'Muestrame los pedidos por estado de esta semana',
      intent: 'orders_by_status'
    },
    {
      id: 'inactive-clients',
      label: 'Clientes inactivos',
      question: 'Que clientes estan inactivos este mes',
      intent: 'inactive_clients'
    },
    {
      id: 'portfolio-by-vendor',
      label: 'Cartera por vendedor',
      question: 'Muestrame la cartera por vendedor',
      intent: 'portfolio_by_vendor'
    },
    {
      id: 'top-products',
      label: 'Productos top',
      question: 'Cuales son los productos con mayor rotacion del mes',
      intent: 'top_products'
    },
    {
      id: 'operational-alerts',
      label: 'Alertas operativas',
      question: 'Muestrame las alertas operativas e inventario',
      intent: 'operational_alerts'
    }
  ];
}
