// The places the resorts are in. A resort's `state` (data/resorts.json) says which. Each region is its own
// painted sheet on the start page's map (tools/bake_region.py, tools/bake_map_snow.py), with the city you fly
// into (its drives in data/drives.json start from `city.key`), and the way the map looks at it on opening:
// Colorado from the east (Denver at the bottom, Aspen at the top, the long east-west spread up a phone),
// Utah from the south (Salt Lake City on the left, Snowbasin at the top, the Wasatch running up the screen).
// `fit`: how much further back than just fitting the tiles the home view stands (1 when not given).
// No DOM and no three.js: the transitions and the trips page read it too.
export const REGIONS = [
  {
    id: "co", state: "科罗拉多", en: "Colorado",
    city: { key: "denver", name: "Denver", code: "DEN", at: [39.7392, -104.9903] },
    map: { url: "assets/wc/colorado.jpg?v=6", S: 38.0, N: 41.5, W: -110.0, E: -103.2, size: [3072, 2057] },
    az: Math.PI / 2,
  },
  {
    id: "ut", state: "犹他", en: "Utah",
    city: { key: "slc", name: "Salt Lake City", code: "SLC", at: [40.7608, -111.891] },
    map: { url: "assets/wc/utah.jpg?v=1", S: 39.6, N: 42.3, W: -113.3, E: -110.5, size: [1710, 2146] },
    az: 0, fit: 1.45, // its resorts lie close together: the home view stands further back, so the whole valley shows
  },
];
// A resort's region (a resort record, or its state); Colorado for anything unknown.
export const regionOf = (r) => REGIONS.find((g) => g.state === (typeof r === "string" ? r : r?.state)) || REGIONS[0];
export const regionById = (id) => REGIONS.find((g) => g.id === id) || REGIONS[0];
// The region most of a list of resort ids lie in (a trip's mountains), given the resorts by id.
export function regionFor(ids, byId) {
  const n = new Map();
  for (const id of ids || []) { const g = byId[id] && regionOf(byId[id]); if (g) n.set(g, (n.get(g) || 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || REGIONS[0];
}
