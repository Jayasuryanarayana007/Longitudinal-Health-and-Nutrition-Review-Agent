import { getNutritionForFood } from './foodApiService.js';

/**
 * Service to parse free-text meal logs into structured food items and nutrition estimates.
 */

// Regex patterns to detect numbers & units at the start/end of item phrases
const quantityRegex = /^(\d+(?:\.\d+)?)\s*(?:x|x\s|g|grams|pcs|pieces|cup|cups|plate|plates|glass|glasses)?\s+(.+)$/i;
const trailingQuantityRegex = /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:x|pcs|pieces|cups|plates)?$/i;

export async function extractMealData(textInput) {
  if (!textInput || !String(textInput).trim()) {
    return { items: [], isAiUncertain: false };
  }

  const rawText = String(textInput).trim();

  // Split text by delimiters: commas, " and ", " with ", " & ", newlines, plus signs
  const rawPhrases = rawText
    .split(/,|\n|\band\b|\bwith\b|&|\+/i)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const items = [];
  let isAiUncertain = false;

  for (let phrase of rawPhrases) {
    let qty = 1;

    // Strip leading verbs and filler words BEFORE matching quantity (e.g. "Had 2 Rotis" -> "2 Rotis")
    phrase = phrase
      .replace(/^(had|ate|drank|consumed|took|having|eating|a|an|some|a cup of|a glass of|plate of)\s+/i, '')
      .replace(/\s+(for lunch|for dinner|for breakfast|today)$/i, '')
      .trim();

    if (!phrase) continue;

    let foodTerm = phrase;

    // Check quantity prefix: e.g. "2 Rotis", "1.5 cups Rice"
    const matchPrefix = phrase.match(quantityRegex);
    if (matchPrefix) {
      qty = parseFloat(matchPrefix[1]) || 1;
      foodTerm = matchPrefix[2].trim();
    } else {
      // Check quantity suffix: e.g. "Roti 2", "Eggs 3"
      const matchSuffix = phrase.match(trailingQuantityRegex);
      if (matchSuffix) {
        foodTerm = matchSuffix[1].trim();
        qty = parseFloat(matchSuffix[2]) || 1;
      }
    }

    foodTerm = foodTerm.trim();
    if (!foodTerm) continue;

    // Fetch nutrition via External REST API / fallback service
    const nut = await getNutritionForFood(foodTerm);

    if (nut) {
      if (nut.isUncertain) {
        isAiUncertain = true;
      }

      // Multiply macros by quantity
      items.push({
        foodItem: nut.foodItem,
        calories: Math.round(nut.calories * qty),
        protein: parseFloat((nut.protein * qty).toFixed(1)),
        carbs: parseFloat((nut.carbs * qty).toFixed(1)),
        fats: parseFloat((nut.fats * qty).toFixed(1)),
        quantity: qty
      });
    }
  }

  // If no valid items parsed, flag uncertainty
  if (items.length === 0) {
    isAiUncertain = true;
    items.push({
      foodItem: rawText.substring(0, 30),
      calories: 200,
      protein: 5,
      carbs: 25,
      fats: 5,
      quantity: 1
    });
  }

  return {
    items,
    isAiUncertain
  };
}
