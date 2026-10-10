import { assert } from './errors.js';

const requestClients = new WeakMap();

export function createClientFromRequest(request) {
  const client = requestClients.get(request);
  assert(client, 401, 'Authenticated local function context required');
  return client;
}

export function bindRequest(request, client) {
  requestClients.set(request, client);
}

export function createLocalClient({ store, user, integrations, invoke }) {
  const entities = Object.fromEntries(Object.keys(store.schemas).map((name) => {
    const check = (write = false) => {
      assert(user, 401, 'Authentication required');
      if (name === 'User' && write) assert(user.role === 'admin', 403, 'Administrator required');
    };
    const list = (filter, sort, limit, skip) => {
      check();
      if (name === 'User' && user.role !== 'admin') filter = { $and: [filter || {}, { id: user.id }] };
      return store.list(name, filter, sort, limit, skip);
    };
    const update = (id, data) => {
      check(true);
      if (name === 'User') {
        assert(!Object.keys(data.$set || data).some((field) => !['full_name'].includes(field)), 403, 'User credentials and roles can only be managed through auth');
      }
      return store.update(name, id, data);
    };
    const get = (id) => {
      check();
      assert(name !== 'User' || user.role === 'admin' || id === user.id, 403, 'Access denied');
      return store.get(name, id);
    };
    const create = (data) => {
      check(true);
      assert(name !== 'User', 403, 'Use auth/register to create users');
      return store.create(name, data, user);
    };
    const remove = (id) => {
      check(true);
      assert(name !== 'User', 403, 'Users cannot be deleted through entity CRUD');
      return store.delete(name, id);
    };
    const batch = (items, operation) => {
      check(true);
      assert(Array.isArray(items) && items.length <= 1000, 400, 'Batch must contain at most 1000 records');
      return store.transaction(() => items.map(operation));
    };
    return [name, {
      list: async (sort, limit, skip) => list({}, sort, limit, skip),
      filter: async (filter, sort, limit, skip) => list(filter, sort, limit, skip),
      get: async (id) => get(id),
      create: async (data) => create(data),
      update: async (id, data) => update(id, data),
      delete: async (id) => remove(id),
      bulkCreate: async (data) => batch(data, create),
      bulkUpdate: async (data) => batch(data, (patch) => update(patch.id, patch.data || Object.fromEntries(Object.entries(patch).filter(([key]) => key !== 'id')))),
      updateMany: async (filter, patch) => batch(list(filter), (row) => update(row.id, patch)),
      deleteMany: async (filter) => batch(list(filter), (row) => remove(row.id))
    }];
  }));
  const client = { entities, integrations: { Core: integrations }, auth: { me: async () => user }, functions: { invoke } };
  client.asServiceRole = {
    ...client,
    entities: {
      ...entities,
      User: {
        ...entities.User,
        list: async (sort, limit, skip) => store.list('User', {}, sort, limit, skip),
        filter: async (filter, sort, limit, skip) => store.list('User', filter, sort, limit, skip),
        get: async (id) => store.get('User', id)
      }
    }
  };
  return client;
}
