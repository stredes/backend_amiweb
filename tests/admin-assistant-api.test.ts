import assert from 'node:assert/strict';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import apiHandler from '../api/index';

class MockResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body: unknown;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }

  json(payload: unknown) {
    this.body = payload;
    return this;
  }

  end(payload?: unknown) {
    this.body = payload;
    return this;
  }
}

function createRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): VercelRequest {
  return {
    method,
    url,
    body,
    headers: headers || {},
    query: {}
  } as unknown as VercelRequest;
}

async function invoke(method: string, url: string, body?: unknown, headers?: Record<string, string>) {
  const req = createRequest(method, url, body, headers);
  const res = new MockResponse() as unknown as VercelResponse;
  await apiHandler(req, res);
  return res as unknown as MockResponse;
}

async function run() {
  const manifest = await invoke('GET', '/api');
  assert.equal(manifest.statusCode, 200);
  assert.equal((manifest.body as any).assistant.status, 'enabled');
  assert.equal((manifest.body as any).endpoints.admin.assistant.query, 'POST /api/admin/assistant/query');

  const suggestions = await invoke('GET', '/api/admin/assistant/suggestions');
  assert.equal(suggestions.statusCode, 401);
  assert.equal((suggestions.body as any).success, false);
  assert.equal((suggestions.body as any).code, 'TOKEN_MISSING');
  assert.equal(typeof suggestions.headers['x-request-id'], 'string');

  const history = await invoke('GET', '/api/admin/assistant/history');
  assert.equal(history.statusCode, 401);
  assert.equal((history.body as any).success, false);
  assert.equal((history.body as any).code, 'TOKEN_MISSING');
  assert.equal(typeof history.headers['x-request-id'], 'string');

  const query = await invoke('POST', '/api/admin/assistant/query', {
    question: 'Muéstrame las ventas del mes por vendedor',
    context: {
      scope: 'admin',
      userRole: 'admin',
      page: 'admin-dashboard',
      requestedAt: '2026-03-13T20:00:00.000Z'
    }
  });
  assert.equal(query.statusCode, 401);
  assert.equal((query.body as any).success, false);
  assert.equal((query.body as any).code, 'TOKEN_MISSING');
  assert.equal(typeof query.headers['x-request-id'], 'string');
}

run()
  .then(() => {
    console.log('admin-assistant-api.test.ts: OK');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
