// Server-side Google Maps calls for address suggestions and reverse geocoding.
// The key never reaches the browser. Without GOOGLE_MAPS_API_KEY these features are off.

const KEY = () => process.env.GOOGLE_MAPS_API_KEY || '';
export const addressLookupEnabled = () => !!KEY();

// The community, Roeser Rd to Southern Ave and 27th Ave to 23rd Ave, with a small margin.
const BOUNDS = { low: { latitude: 33.3917, longitude: -112.1168 }, high: { latitude: 33.4000, longitude: -112.1073 } };

export type AddressParts = { number: string; street: string };

function partsFrom(components: { types: string[]; short: string }[]): AddressParts {
  const num = components.find((c) => c.types.includes('street_number'))?.short || '';
  const street = components.find((c) => c.types.includes('route'))?.short || '';
  return { number: num, street };
}

export async function suggestAddresses(input: string, session?: string) {
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY(),
      'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({
      input,
      locationRestriction: { rectangle: BOUNDS },
      includedRegionCodes: ['us'],
      ...(session ? { sessionToken: session } : {}),
    }),
  });
  if (!res.ok) throw new Error(`autocomplete ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    suggestions?: { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }[];
  };
  return (data.suggestions || [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
    .map((p) => ({ id: p.placeId, main: p.structuredFormat?.mainText?.text || '', secondary: p.structuredFormat?.secondaryText?.text || '' }));
}

export async function placeDetails(id: string, session?: string) {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}${session ? `?sessionToken=${encodeURIComponent(session)}` : ''}`;
  const res = await fetch(url, { headers: { 'X-Goog-Api-Key': KEY(), 'X-Goog-FieldMask': 'location,addressComponents' } });
  if (!res.ok) throw new Error(`place ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as {
    location?: { latitude: number; longitude: number };
    addressComponents?: { shortText: string; types: string[] }[];
  };
  return {
    lat: d.location?.latitude ?? null,
    lng: d.location?.longitude ?? null,
    ...partsFrom((d.addressComponents || []).map((c) => ({ types: c.types, short: c.shortText }))),
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<AddressParts | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=street_address|premise&key=${KEY()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const d = (await res.json()) as { results?: { address_components: { short_name: string; types: string[] }[] }[] };
  const first = d.results?.[0];
  if (!first) return null;
  return partsFrom(first.address_components.map((c) => ({ types: c.types, short: c.short_name })));
}

// Simple per-device limit so the public endpoints can't run up the Google bill.
const hits = new Map<string, { n: number; t: number }>();
export function overGeoLimit(id: string, max = 60, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const h = hits.get(id);
  if (!h || now - h.t > windowMs) {
    hits.set(id, { n: 1, t: now });
    return false;
  }
  h.n += 1;
  return h.n > max;
}
