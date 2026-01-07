export function parsePagination(query: Record<string, string | string[] | undefined>) {
  const page = Math.max(parseInt((query.page as string) || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt((query.pageSize as string) || '20', 10), 1), 100);
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}
