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
