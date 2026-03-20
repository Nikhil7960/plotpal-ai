/**
 * Point-in-polygon ray-casting against Mumbai boundary polygon.
 * Fetches the boundary from Overpass API and caches it.
 */

let cachedBoundary: [number, number][] | null = null;

export async function fetchMumbaiBoundary(): Promise<[number, number][]> {
  if (cachedBoundary) return cachedBoundary;

  const query = `
    [out:json][timeout:60];
    relation["name"="Mumbai"]["admin_level"="8"];
    (._;>;);
    out body;
  `;

  const url = 'https://overpass-api.de/api/interpreter';
  const res = await fetch(url, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // Extract nodes into a lookup
  const nodes = new Map<number, [number, number]>();
  for (const el of data.elements) {
    if (el.type === 'node') {
      nodes.set(el.id, [el.lat, el.lon]);
    }
  }

  // Find the relation and extract the outer way refs
  const relation = data.elements.find(
    (el: any) => el.type === 'relation'
  );
  if (!relation) {
    throw new Error('Mumbai relation not found in Overpass response');
  }

  // Collect outer way members
  const outerWays: number[][] = [];
  for (const member of relation.members) {
    if (member.type === 'way' && (member.role === 'outer' || member.role === '')) {
      const way = data.elements.find(
        (el: any) => el.type === 'way' && el.id === member.ref
      );
      if (way) {
        outerWays.push(way.nodes);
      }
    }
  }

  // Chain ways into a single polygon ring
  const polygon = chainWays(outerWays, nodes);
  cachedBoundary = polygon;
  return polygon;
}

function chainWays(
  ways: number[][],
  nodes: Map<number, [number, number]>
): [number, number][] {
  if (ways.length === 0) return [];

  const result: [number, number][] = [];
  const remaining = [...ways];

  // Start with the first way
  let current = remaining.shift()!;
  for (const nodeId of current) {
    const coord = nodes.get(nodeId);
    if (coord) result.push(coord);
  }

  while (remaining.length > 0) {
    const lastNodeId = current[current.length - 1];
    let found = false;

    for (let i = 0; i < remaining.length; i++) {
      const way = remaining[i];
      if (way[0] === lastNodeId) {
        // Forward direction
        remaining.splice(i, 1);
        current = way;
        for (let j = 1; j < way.length; j++) {
          const coord = nodes.get(way[j]);
          if (coord) result.push(coord);
        }
        found = true;
        break;
      } else if (way[way.length - 1] === lastNodeId) {
        // Reverse direction
        remaining.splice(i, 1);
        const reversed = [...way].reverse();
        current = reversed;
        for (let j = 1; j < reversed.length; j++) {
          const coord = nodes.get(reversed[j]);
          if (coord) result.push(coord);
        }
        found = true;
        break;
      }
    }

    if (!found) break; // Can't chain further
  }

  return result;
}

/**
 * Ray-casting point-in-polygon test.
 */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];

    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}
