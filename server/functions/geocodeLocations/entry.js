import { createClientFromRequest } from '../../client.js';

function norm(s) {
  return String(s || '')
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim();
}

export default async function(req) {
  try {
    const localClient = createClientFromRequest(req);

    const locations = await localClient.asServiceRole.entities.Entity.filter({ type: 'location' }, 'name', 300);
    const missing = locations.filter((e) => e.latitude == null || e.longitude == null);
    if (missing.length === 0) {
      return Response.json({ geocoded: 0, total: 0, message: 'جميع المواقع مُرمّزة جغرافياً' });
    }

    const names = [...new Set(missing.map((e) => e.name).filter(Boolean))];
    const prompt =
      'You are a precise geocoder. For each place name below (Arabic), return its latitude and longitude in WGS84 decimal degrees. ' +
      'Give the most likely real-world location. Return a JSON object with a "places" array, each item {"name": <original name exactly as given>, "lat": number, "lng": number}.\n\n' +
      'Place names:\n' + JSON.stringify(names);

    const res = await localClient.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          places: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                lat: { type: 'number' },
                lng: { type: 'number' }
              },
              required: ['name', 'lat', 'lng']
            }
          }
        },
        required: ['places']
      }
    });

    const places = (res && Array.isArray(res.places)) ? res.places : [];
    // build normalized lookup
    const byNorm = Object.create(null);
    places.forEach((p) => {
      if (p && typeof p.lat === 'number' && typeof p.lng === 'number' &&
          isFinite(p.lat) && isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180) {
        byNorm[norm(p.name)] = p;
      }
    });

    let count = 0;
    for (const e of missing) {
      const p = byNorm[norm(e.name)];
      if (p) {
        await localClient.asServiceRole.entities.Entity.update(e.id, { latitude: p.lat, longitude: p.lng });
        count++;
      }
    }

    return Response.json({ geocoded: count, total: missing.length, returned: places.length });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
}