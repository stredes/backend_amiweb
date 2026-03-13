export type ClawbotMode = 'read_only';

export type AdminAssistantIntent =
  | 'sales_by_period'
  | 'sales_by_vendor'
  | 'orders_by_status'
  | 'inactive_clients'
  | 'portfolio_by_vendor'
  | 'top_products'
  | 'operational_alerts';

export type AdminAssistantContext = {
  scope: 'admin';
  userRole: 'admin' | 'root';
  page?: string;
  requestedAt?: string;
};

export type AdminAssistantQueryRequest = {
  question: string;
  context: AdminAssistantContext;
};

export type AdminAssistantQueryResponse = {
  answer: string;
  queryLabel: string;
  visualization: 'table';
  columns: string[];
  rows: Array<Record<string, unknown>>;
  requestId?: string;
};

export type AssistantSuggestion = {
  id: string;
  label: string;
  question: string;
  intent: AdminAssistantIntent;
};

export type AssistantHistoryItem = {
  id: string;
  question: string;
  queryLabel?: string;
  requestId?: string;
  createdAt?: string | null;
};
