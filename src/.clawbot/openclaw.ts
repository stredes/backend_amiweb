import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseMaybeJson<T>(text: string): T | null {
  const raw = extractJsonObject(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function runOpenClawJson<T>(message: string, timeoutMs = 45000): Promise<T | null> {
  const binary = process.env.OPENCLAW_BIN || '/home/gian/.nvm/versions/node/v25.2.1/bin/openclaw';

  try {
    const { stdout, stderr } = await execFileAsync(
      binary,
      ['agent', '--local', '--json', '--thinking', 'low', '--timeout', String(Math.max(10, Math.ceil(timeoutMs / 1000))), '--message', message],
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 4 }
    );

    const payload = parseMaybeJson<T>(stdout) || parseMaybeJson<T>(stderr);
    if (!payload) {
      logger.warn('OpenClaw no devolvio JSON parseable', { stdout: stdout.slice(0, 500), stderr: stderr.slice(0, 500) });
    }
    return payload;
  } catch (error) {
    logger.warn('Fallo invocacion OpenClaw, se usara fallback heuristico', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
