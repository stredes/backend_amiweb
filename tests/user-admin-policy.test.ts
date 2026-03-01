import assert from 'node:assert/strict';
import {
  normalizeRole,
  canReadUserDirectory,
  canMutateUsers,
  filterUsersForDirectory,
  paginateItems
} from '../src/utils/userAdminPolicy';

function run() {
  assert.equal(normalizeRole('admin'), 'admin');
  assert.equal(normalizeRole(undefined), 'cliente');

  assert.equal(canReadUserDirectory('root'), true);
  assert.equal(canReadUserDirectory('admin'), true);
  assert.equal(canReadUserDirectory('vendedor'), false);

  assert.equal(canMutateUsers('root'), true);
  assert.equal(canMutateUsers('admin'), false);

  const sample = [
    { id: '1', email: 'ana@corp.com', name: 'Ana', role: 'admin', isActive: true },
    { id: '2', email: 'bruno@corp.com', name: 'Bruno', role: 'vendedor', isActive: false },
    { id: '3', email: 'carla@corp.com', name: 'Carla', role: 'cliente', isActive: true }
  ];

  const filtered = filterUsersForDirectory(sample as any[], {
    role: 'vendedor',
    isActive: false,
    search: 'bru'
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, '2');

  const paginated = paginateItems(sample as any[], 2, 2);
  assert.equal(paginated.items.length, 1);
  assert.equal(paginated.total, 3);
  assert.equal(paginated.totalPages, 2);
}

run();
console.log('user-admin-policy.test.ts: OK');
