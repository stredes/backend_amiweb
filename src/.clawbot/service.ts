import { runOpenClawJson } from './openclaw';
import { CLAWBOT_SYSTEM_PROMPT } from './prompts/system';
import { logger } from '../utils/logger';
import type { AdminAssistantQueryRequest, AdminAssistantQueryResponse } from './types';
import { inferAssistantPlan } from './planner';
import { executeAdminIntent } from './tools/readOnlyDb';

export async function runAdminAssistantQuery(
  request: AdminAssistantQueryRequest,
  requestId?: string
): Promise<AdminAssistantQueryResponse | null> {
  const plan = inferAssistantPlan(request.question);
  if (!plan) {
    return null;
  }

  const startedAt = Date.now();
  const result = await executeAdminIntent(plan.intent, plan.filters);
  const durationMs = Date.now() - startedAt;
  const answerPrompt = [
    CLAWBOT_SYSTEM_PROMPT,
    'Tarea: redacta una respuesta corta para admin basada en datos tabulares.',
    `Pregunta: ${request.question}`,
    `Intent: ${plan.intent}`,
    `Label: ${plan.queryLabel}`,
    `Rows: ${JSON.stringify(result.rows.slice(0, 10))}`,
    'Devuelve JSON: {"answer":"texto corto"}'
  ].join('\n');
  const aiAnswer = await runOpenClawJson<{ answer?: string }>(answerPrompt, 15000);

  logger.info('Assistant query resolved', {
    intent: plan.intent,
    filters: plan.filters,
    durationMs,
    requestId
  });

  return {
    answer: aiAnswer?.answer || result.answer,
    queryLabel: plan.queryLabel,
    visualization: 'table',
    columns: result.columns,
    rows: result.rows,
    requestId
  };
}
