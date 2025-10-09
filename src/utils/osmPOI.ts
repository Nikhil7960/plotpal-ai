export interface POI {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distance?: number;
}

export interface POICategory {
  category: string;
  count: number;
  items: POI[];
}

// Fetch nearby Points of Interest using Overpass API
export async function fetchNearbyPOIs(
  lat: number,
  lng: number,
  radius: number = 500
): Promise<POICategory[]> {
  try {
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"](around:${radius},${lat},${lng});
        node["shop"](around:${radius},${lat},${lng});
        node["leisure"](around:${radius},${lat},${lng});
        node["public_transport"](around:${radius},${lat},${lng});
      );
      out body;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch POIs');
    }

    const data = await response.json();
    const pois: POI[] = data.elements
      .filter((el: any) => el.tags && (el.tags.name || el.tags.amenity || el.tags.shop))
      .map((el: any) => ({
        id: el.id.toString(),
        name: el.tags.name || el.tags.amenity || el.tags.shop || 'Unknown',
        type: el.tags.amenity || el.tags.shop || el.tags.leisure || el.tags.public_transport || 'other',
        lat: el.lat,
        lng: el.lon,
        distance: calculateDistance(lat, lng, el.lat, el.lon),
      }));

    // Group by category
    const categories = groupPOIsByCategory(pois);
    return categories;
  } catch (error) {
    console.error('Error fetching POIs:', error);
    return [];
  }
}

// Calculate distance between two coordinates (in meters)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Group POIs by category
function groupPOIsByCategory(pois: POI[]): POICategory[] {
  const categoryMap = new Map<string, POI[]>();

  pois.forEach((poi) => {
    const category = getCategoryForType(poi.type);
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(poi);
  });

  const categories: POICategory[] = [];
  categoryMap.forEach((items, category) => {
    // Sort by distance
    items.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    categories.push({
      category,
      count: items.length,
      items: items.slice(0, 5), // Top 5 closest
    });
  });

  // Sort categories by count
  categories.sort((a, b) => b.count - a.count);

  return categories;
}

// Map OSM types to friendly categories
function getCategoryForType(type: string): string {
  const categoryMap: { [key: string]: string } = {
    // Amenities
    restaurant: 'Restaurants',
    cafe: 'Cafes',
    fast_food: 'Fast Food',
    bar: 'Bars & Nightlife',
    pub: 'Bars & Nightlife',
    school: 'Education',
    university: 'Education',
    college: 'Education',
    hospital: 'Healthcare',
    clinic: 'Healthcare',
    pharmacy: 'Healthcare',
    bank: 'Financial',
    atm: 'Financial',
    parking: 'Parking',
    fuel: 'Gas Stations',
    bus_station: 'Public Transit',
    station: 'Public Transit',
    library: 'Public Services',
    post_office: 'Public Services',
    police: 'Public Services',
    fire_station: 'Public Services',
    place_of_worship: 'Religious',
    // Shops
    supermarket: 'Grocery & Food',
    convenience: 'Grocery & Food',
    bakery: 'Grocery & Food',
    mall: 'Shopping Centers',
    department_store: 'Shopping Centers',
    clothes: 'Retail',
    shoes: 'Retail',
    electronics: 'Retail',
    books: 'Retail',
    // Leisure
    park: 'Parks & Recreation',
    playground: 'Parks & Recreation',
    sports_centre: 'Sports & Fitness',
    gym: 'Sports & Fitness',
    cinema: 'Entertainment',
    theatre: 'Entertainment',
  };

  return categoryMap[type] || 'Other';
}
