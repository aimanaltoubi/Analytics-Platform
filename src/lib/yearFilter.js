// أدوات تصفية بيانات اللوحة حسب العام المرجعي للمستندات

export const docYear = (doc) => (doc && doc.reference_date ? String(doc.reference_date).slice(0, 4) : '');

export const availableYears = (docs) => {
  const years = new Set();
  (docs || []).forEach((d) => {
    const y = docYear(d);
    if (y) years.add(y);
  });
  return Array.from(years).sort((a, b) => b.localeCompare(a));
};

export const docsInYear = (docs, year) => (year ? (docs || []).filter((d) => docYear(d) === year) : (docs || []));

// يُرجع Set معرّفات مستندات العام، أو null عند عدم اختيار عام (بمعنى: بدون تصفية)
export const yearDocIdSet = (docs, year) => (year ? new Set(docsInYear(docs, year).map((d) => d.id)) : null);

export const connectionsForDocs = (conns, docIds) => {
  if (!docIds) return conns || [];
  const set = docIds instanceof Set ? docIds : new Set(docIds);
  return (conns || []).filter((c) => c.document_id && set.has(c.document_id));
};

export const entitiesForDocs = (entities, docIds) => {
  if (!docIds) return entities || [];
  const set = docIds instanceof Set ? docIds : new Set(docIds);
  return (entities || []).filter((e) => (e.document_ids || []).some((id) => set.has(id)));
};