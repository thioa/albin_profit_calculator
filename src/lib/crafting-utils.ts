import { AlbionCity, AlbionItem } from "../types/albion";

/**
 * Calculates the Station Fee based on Item Value and User Input Fee.
 * Formula: (ItemValue * 0.05 * (User_Fee_Input / 100))
 */
export function calculateStationFee(itemValue: number, userFee: number): number {
  return Math.round(itemValue * 0.05 * (userFee / 100));
}

/**
 * Calculates the Total Cost of Materials after Resource Return Rate (RRR).
 * Formula: Sum(Price_Material_N * Qty_Material_N) * (1 - RRR_Percentage)
 */
export function calculateMaterialCost(
  ingredients: { id: string; count: number; price: number }[],
  rrr: number
): number {
  const totalBaseCost = ingredients.reduce((sum, ing) => sum + (ing.price * ing.count), 0);
  return Math.round(totalBaseCost * (1 - rrr / 100));
}

/**
 * Calculates the Net Revenue after Market Tax and Setup Fee.
 * Formula: Finished_Good_Price * (1 - (Market_Tax + Setup_Fee))
 * Default Market Tax: 4% (Premium) or 8% (Non-Premium)
 * Default Setup Fee: 2.5%
 */
export function calculateNetRevenue(
  price: number,
  tax: number = 4,
  setupFee: number = 1
): number {
  return Math.round(price * (1 - (tax + setupFee) / 100));
}

/**
 * Calculates the Final Profit.
 * Formula: Net_Revenue - (Material_Cost + Station_Fee)
 */
export function calculateCraftingProfit(
  netRevenue: number,
  materialCost: number,
  stationFee: number
): number {
  return netRevenue - (materialCost + stationFee);
}

// ---------------------------------------------------------------------------
// 3-Axis RRR system
// Known exact values from game:
//   Normal + NoCity + NoFocus = 15.2%
//   Normal + City  + NoFocus = 24.8%  (+9.6 from city)
//   Normal + City  + Focus   = 47.9%  (+23.1 from focus)
//   Event  + City  + Focus   = 53.9%  (+6.0 from event)
// Remaining 4 use additive model.
// ---------------------------------------------------------------------------

const RRR_TABLE: Record<string, number> = {
  "10-false-false": 15.2,
  "10-true-false":  24.8,
  "10-false-true":  38.3,
  "10-true-true":   47.9,
  "20-false-false": 21.2,
  "20-true-false":  30.8,
  "20-false-true":  44.3,
  "20-true-true":   53.9,
};

export interface RrrConfig {
  stationBonus: 10 | 20; // 10 = normal, 20 = event/premium double
  cityBonus: boolean;    // crafting in bonus city
  focus: boolean;        // spending focus points
}

export function getRrr(config: RrrConfig): number {
  const key = `${config.stationBonus}-${config.cityBonus}-${config.focus}`;
  return RRR_TABLE[key] ?? 15.2;
}

/**
 * City crafting bonuses (+15%) by item sub-category.
 * Source: Albion Online city bonus table.
 */
const CITY_CRAFT_BONUS: Record<string, AlbionCity> = {
  // Fort Sterling
  hammer: "Fort Sterling",
  spear: "Fort Sterling",
  holystaff: "Fort Sterling",
  platehelmet: "Fort Sterling",
  clotharmor: "Fort Sterling",

  // Lymhurst
  sword: "Lymhurst",
  bow: "Lymhurst",
  arcanestaff: "Lymhurst",
  leatherhelmet: "Lymhurst",
  leathershoes: "Lymhurst",

  // Bridgewatch
  crossbow: "Bridgewatch",
  dagger: "Bridgewatch",
  cursedstaff: "Bridgewatch",
  platearmor: "Bridgewatch",
  clothshoes: "Bridgewatch",

  // Martlock
  axe: "Martlock",
  quarterstaff: "Martlock",
  froststaff: "Martlock",
  plateshoes: "Martlock",
  offhand: "Martlock",

  // Thetford
  mace: "Thetford",
  naturestaff: "Thetford",
  firestaff: "Thetford",
  leatherarmor: "Thetford",
  clothhelmet: "Thetford",

  // Caerleon
  gatheringgear: "Caerleon",
  tool: "Caerleon",
  food: "Caerleon",
  wargloves: "Caerleon",
  shapeshifterstaff: "Caerleon",

  // Brecilien
  cape: "Brecilien",
  bag: "Brecilien",
  potion: "Brecilien",
};

/**
 * Returns the city with +15% crafting bonus for the given item sub-category,
 * or null if no bonus applies.
 */
export function getCraftingCity(subCategory: string): AlbionCity | null {
  if (!subCategory) return null;
  // Normalize: lowercase, remove spaces/underscores
  const key = subCategory.toLowerCase().replace(/[\s_-]/g, "");
  return CITY_CRAFT_BONUS[key] ?? null;
}

export interface RecommendationResult {
  itemId: string;
  itemName: string;
  icon: string;
  craftCity: AlbionCity;
  sellCity: AlbionCity;
  sellPrice: number;
  totalCost: number;
  profit: number;
  roi: number;
  ingredients: {
    id: string;
    count: number;
    buyCity: AlbionCity;
    buyPrice: number;
  }[];
}

/**
 * Analyzes a single item for crafting profitability.
 * If fixedCity is provided, it only looks at prices in that specific city (Buy & Sell locally).
 */
export function calculateRecommendationProfit(
  item: AlbionItem,
  prices: Record<string, Record<string, number>>, // itemId -> city -> price
  rrr: number,
  isPremium: boolean = true,
  fixedCity?: AlbionCity
): RecommendationResult | null {
  if (!item.craftingRecipe || item.craftingRecipe.length === 0) return null;

  // 1. Determine Crafting City (Bonus City or Local if fixed)
  const craftCity = fixedCity || getCraftingCity(item.subCategory) || "Caerleon";

  // 2. Calculate Material Cost
  const ingredients: RecommendationResult["ingredients"] = [];
  let totalMaterialCost = 0;

  for (const req of item.craftingRecipe) {
    const itemPrices = prices[req.id];
    if (!itemPrices) return null;

    let buyPrice = Infinity;
    let buyCity: AlbionCity | null = null;

    if (fixedCity) {
      buyPrice = itemPrices[fixedCity] || 0;
      buyCity = fixedCity;
    } else {
      // Find cheapest city for this ingredient (Global Golden Route)
      Object.entries(itemPrices).forEach(([city, price]) => {
        if (price > 0 && price < buyPrice) {
          buyPrice = price;
          buyCity = city as AlbionCity;
        }
      });
    }

    if (!buyCity || buyPrice <= 0 || buyPrice === Infinity) return null;

    ingredients.push({
      id: req.id,
      count: req.count,
      buyCity,
      buyPrice,
    });

    totalMaterialCost += buyPrice * req.count;
  }

  // Apply RRR (Resource Return Rate)
  const netMaterialCost = totalMaterialCost * (1 - rrr / 100);

  // 3. Calculate Station Fee
  // Using calculateStationFee with a default user fee of 500 silver per 100 food
  const stationFee = calculateStationFee(item.itemValue, 500); 

  const totalCost = netMaterialCost + stationFee;

  // 4. Find Sell Price
  const targetPrices = prices[item.id];
  if (!targetPrices) return null;

  let sellPrice = 0;
  let sellCity: AlbionCity | null = null;

  if (fixedCity) {
    sellPrice = targetPrices[fixedCity] || 0;
    sellCity = fixedCity;
  } else {
    // Best sell price globally
    Object.entries(targetPrices).forEach(([city, price]) => {
      if (price > sellPrice) {
        sellPrice = price;
        sellCity = city as AlbionCity;
      }
    });
  }

  if (!sellCity || sellPrice <= 0) return null;

  // 5. Calculate Final Profit
  const netRevenue = calculateNetRevenue(sellPrice, isPremium ? 4 : 8, 1);
  const profit = netRevenue - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return {
    itemId: item.id,
    itemName: item.name,
    icon: item.icon,
    craftCity,
    sellCity,
    sellPrice,
    totalCost,
    profit,
    roi,
    ingredients,
  };
}
