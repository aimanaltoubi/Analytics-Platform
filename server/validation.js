import { assert } from './errors.js';

export const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);

export function object(value, name = 'data') {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), 400, `${name} must be an object`);
  return value;
}

export function validateJSON(value, schema, path = 'data', depth = 0) {
  assert(depth <= 64, 422, 'Data nesting exceeds 64 levels');
  assert(schema !== false, 422, `${path} is not allowed`);
  if (!schema || schema === true) {
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        assert(!['__proto__', 'constructor', 'prototype'].includes(key), 400, 'Unsafe property name');
        validateJSON(item, undefined, `${path}.${key}`, depth + 1);
      }
    }
    return;
  }
  if (schema.anyOf) {
    assert(schema.anyOf.some((part) => {
      try { validateJSON(value, part, path, depth + 1); return true; } catch { return false; }
    }), 422, `${path} does not match any permitted type`);
    return;
  }
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const matchesType = (type) => {
    if (type === 'null') return value === null;
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    return typeof value === type;
  };
  assert(!types.length || types.some(matchesType), 422, `${path} has an invalid type`);
  if (schema.enum) assert(schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(value)), 422, `${path} has an invalid value`);
  if (value === null) return;
  if (typeof value === 'number') {
    if (schema.minimum !== undefined) assert(value >= schema.minimum, 422, `${path} is below minimum`);
    if (schema.maximum !== undefined) assert(value <= schema.maximum, 422, `${path} is above maximum`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined) assert(value.length >= schema.minLength, 422, `${path} is too short`);
    if (schema.maxLength !== undefined) assert(value.length <= schema.maxLength, 422, `${path} is too long`);
  }
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined) assert(value.length <= schema.maxItems, 422, `${path} has too many items`);
    value.forEach((item, index) => validateJSON(item, schema.items, `${path}[${index}]`, depth + 1));
  } else if (typeof value === 'object') {
    for (const field of schema.required || []) assert(value[field] !== undefined, 422, `${path}.${field} is required`);
    for (const [key, item] of Object.entries(value)) {
      assert(!['__proto__', 'constructor', 'prototype'].includes(key), 400, 'Unsafe property name');
      const child = schema.properties?.[key];
      assert(child !== undefined || schema.additionalProperties !== false, 422, `${path}.${key} is not allowed`);
      validateJSON(item, child ?? (typeof schema.additionalProperties === 'object' ? schema.additionalProperties : undefined), `${path}.${key}`, depth + 1);
    }
  }
}

export function defaults(data, schema) {
  const result = { ...data };
  for (const [key, definition] of Object.entries(schema.properties || {})) {
    if (result[key] === undefined && definition.default !== undefined) result[key] = structuredClone(definition.default);
  }
  return result;
}
