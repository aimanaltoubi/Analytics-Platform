export function matchesEntityQuery(entity, query) {
  if (!query) return true;
  const ql = query.toLowerCase();
  if (entity.name?.toLowerCase().includes(ql)) return true;
  if ((entity.aliases || []).some((a) => a.toLowerCase().includes(ql))) return true;
  const attrs = entity.attributes;
  if (attrs && typeof attrs === 'object') {
    for (const [key, value] of Object.entries(attrs)) {
      if (key.toLowerCase().includes(ql)) return true;
      if (value != null && String(value).toLowerCase().includes(ql)) return true;
    }
  }
  return false;
}