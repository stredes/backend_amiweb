import { CLAWBOT_SYSTEM_PROMPT } from './prompts/system';
import { runOpenClawJson } from './openclaw';
import type { ClawbotChatRequest, ClawbotChatResponse, ClawbotToolCall } from './types';
import { executeToolCall, type ToolExecutionResult } from './tools/readOnlyDb';
import { inferFallbackToolCalls } from './planner';

type PlanResponse = {
  toolCalls?: ClawbotToolCall[];
  answerStyle?: string;
};

type SummaryResponse = {
  answer?: string;
};

function buildFallbackAnswer(results: ToolExecutionResult[]): string {
  if (results.length === 0) return 'No encontre resultados para la consulta.';
  return results.map((result) => result.summary).join('. ');
}

function mergeMeta(results: ToolExecutionResult[], requestId?: string) {
  const sources = results.flatMap((result) => {
    const source = result.meta?.sources;
    return Array.isArray(source) ? source.map(String) : [];
  });
  const totalRows = results.reduce((acc, result) => acc + (result.table?.rows.length || 0), 0);
  return {
    requestId,
    sources: [...new Set(sources)],
    totalRows
  };
}

export async function runClawbotAdminQuery(
  request: ClawbotChatRequest,
  requestId?: string
): Promise<ClawbotChatResponse> {
  const planPrompt = `${CLAWBOT_SYSTEM_PROMPT}\n\nConsulta del admin:\n${request.message}`;
  const plan = await runOpenClawJson<PlanResponse>(planPrompt, 30000);
  const toolCalls = Array.isArray(plan?.toolCalls) && plan?.toolCalls.length > 0 ? plan.toolCalls : inferFallbackToolCalls(request.message);
  const results: ToolExecutionResult[] = [];

  for (const toolCall of toolCalls.slice(0, 3)) {
    results.push(await executeToolCall(toolCall));
  }

  const primaryTable = results.find((result) => result.table)?.table;
  const summaryPrompt = [
    'Resume en espanol para un admin.',
    'Explica filtros aplicados y hallazgos principales en 3-5 lineas.',
    'No uses markdown.',
    `Consulta original: ${request.message}`,
    `Resultados: ${JSON.stringify(results.map((result) => ({
      tool: result.tool,
      summary: result.summary,
      rows: result.table?.rows.slice(0, 5) || []
    })))}`
  ].join('\n');
  const summary = await runOpenClawJson<SummaryResponse>(summaryPrompt, 30000);

  return {
    answer: summary?.answer || buildFallbackAnswer(results),
    toolCalls,
    table: primaryTable,
    meta: mergeMeta(results, requestId),
    requestId
  };
}
