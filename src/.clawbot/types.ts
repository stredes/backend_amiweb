export type ClawbotMode = 'read_only';

export type ClawbotToolName =
  | 'search_catalog'
  | 'collection_query'
  | 'get_admin_kpis'
  | 'get_admin_clients'
  | 'get_admin_operations'
  | 'get_notifications';

export type ClawbotToolCall = {
  tool: ClawbotToolName;
  input: Record<string, unknown>;
};

export type ClawbotChatRequest = {
  message: string;
  sessionId?: string;
};

export type ClawbotChatResponse = {
  answer: string;
  toolCalls: ClawbotToolCall[];
  table?: {
    columns: string[];
    rows: Array<Record<string, unknown>>;
  };
  meta?: {
    requestId?: string;
    filters?: Record<string, unknown>;
    sources?: string[];
    totalRows?: number;
  };
  requestId?: string;
};
