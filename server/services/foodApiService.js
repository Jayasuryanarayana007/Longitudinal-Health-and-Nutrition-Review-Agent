/**
 * Service to query external public nutrition REST APIs (Open Food Facts & USDA API)
 * Includes graceful timeout handling and robust fallback mapping.
 */

// Fallback nutrition mapping for robust offline/fallback resilience
const fallbackNutritionMap = {
  roti: { foodItem: 'Roti / Chapati', calories: 120, protein: 3.5, carbs: 22, fats: 2 },
  chapati: { foodItem: 'Chapati', calories: 120, protein: 3.5, carbs: 22, fats: 2 },
  dal: { foodItem: 'Dal / Lentil Soup', calories: 180, protein: 9, carbs: 28, fats: 4 },
  'dal makhani': { foodItem: 'Dal Makhani', calories: 280, protein: 10, carbs: 30, fats: 14 },
  rice: { foodItem: 'Steamed Rice', calories: 200, protein: 4, carbs: 44, fats: 0.5 },
  'biryani': { foodItem: 'Chicken Biryani', calories: 450, protein: 25, carbs: 55, fats: 16 },
  'paneer butter masala': { foodItem: 'Paneer Butter Masala', calories: 350, protein: 14, carbs: 12, fats: 28 },
  paneer: { foodItem: 'Paneer / Cottage Cheese', calories: 260, protein: 18, carbs: 4, fats: 20 },
  dosa: { foodItem: 'Masala Dosa', calories: 300, protein: 6, carbs: 45, fats: 10 },
  idli: { foodItem: 'Steamed Idli', calories: 75, protein: 2, carbs: 15, fats: 0.5 },
  chicken: { foodItem: 'Grilled Chicken', calories: 220, protein: 30, carbs: 0, fats: 10 },
  'chicken breast': { foodItem: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fats: 3.6 },
  salad: { foodItem: 'Mixed Green Salad', calories: 80, protein: 2, carbs: 10, fats: 4 },
  egg: { foodItem: 'Boiled Egg', calories: 78, protein: 6.3, carbs: 0.6, fats: 5.3 },
  eggs: { foodItem: 'Boiled Eggs', calories: 156, protein: 12.6, carbs: 1.2, fats: 10.6 },
  oatmeal: { foodItem: 'Oatmeal', calories: 150, protein: 5, carbs: 27, fats: 2.5 },
  coffee: { foodItem: 'Black Coffee', calories: 5, protein: 0.3, carbs: 0, fats: 0 },
  milk: { foodItem: 'Whole Milk (1 cup)', calories: 150, protein: 8, carbs: 12, fats: 8 },
  apple: { foodItem: 'Fresh Apple', calories: 95, protein: 0.5, carbs: 25, fats: 0.3 },
  banana: { foodItem: 'Fresh Banana', calories: 105, protein: 1.3, carbs: 27, fats: 0.3 }
};

/**
 * Queries Open Food Facts REST API with a fast timeout signal.
 */
async function queryOpenFoodFacts(term) {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=2`;
    
    // Fast 1.5-second timeout signal to avoid blocking on slow network responses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await globalThis.fetch(url, {
      headers: { 'User-Agent': 'WellnessAgentApp/1.0' },
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) return null;
    const data = await res.json();
    if (data.products && data.products.length > 0) {
      // Find product matching query term
      const product = data.products.find(p => p.nutriments && p.product_name && p.product_name.toLowerCase().includes(term)) || data.products[0];
      const nut = product.nutriments || {};
      const cals = parseFloat(nut['energy-kcal_100g'] || nut['energy-kcal'] || (nut['energy_100g'] ? nut['energy_100g'] / 4.184 : 0));
      const prot = parseFloat(nut['proteins_100g'] || nut['proteins'] || 0);
      const carbs = parseFloat(nut['carbohydrates_100g'] || nut['carbohydrates'] || 0);
      const fats = parseFloat(nut['fat_100g'] || nut['fat'] || 0);

      if (cals > 0) {
        const displayTitle = (product.product_name && product.product_name.toLowerCase().includes(term)) 
          ? product.product_name 
          : (term.charAt(0).toUpperCase() + term.slice(1));

        return {
          foodItem: displayTitle,
          calories: Math.round(cals),
          protein: parseFloat(prot.toFixed(1)),
          carbs: parseFloat(carbs.toFixed(1)),
          fats: parseFloat(fats.toFixed(1)),
          source: 'OpenFoodFacts'
        };
      }
    }
  } catch (err) {
    // Graceful fallback on network error or timeout
  }
  return null;
}

/**
 * Main public method to fetch nutrient info for a food query.
 */
export async function getNutritionForFood(queryTerm) {
  const cleanTerm = String(queryTerm).trim().toLowerCase();
  if (!cleanTerm) return null;

  // 1. Try Fallback Nutrition Map first for direct matches (Roti, Dal, Rice, etc.) for instant accuracy
  for (const [key, val] of Object.entries(fallbackNutritionMap)) {
    if (cleanTerm === key || cleanTerm === key + 's' || key === cleanTerm + 's') {
      return { ...val, source: 'LocalNutritionDB' };
    }
  }

  // 2. Try Live External REST API (Open Food Facts)
  const apiResult = await queryOpenFoodFacts(cleanTerm);
  if (apiResult) {
    return apiResult;
  }

  // 3. Fallback partial map check
  for (const [key, val] of Object.entries(fallbackNutritionMap)) {
    if (cleanTerm.includes(key) || key.includes(cleanTerm)) {
      return { ...val, source: 'LocalNutritionDB' };
    }
  }

  // 4. Default Baseline with Uncertainty Flag
  return {
    foodItem: queryTerm.charAt(0).toUpperCase() + queryTerm.slice(1),
    calories: 150,
    protein: 4,
    carbs: 20,
    fats: 5,
    isUncertain: true,
    source: 'DefaultBaseline'
  };
}
