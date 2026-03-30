export type AlbionServer = "West" | "East" | "Europe";

export type AlbionCity = 
  | "Martlock" 
  | "Bridgewatch" 
  | "Lymhurst" 
  | "Fort Sterling" 
  | "Thetford" 
  | "Caerleon" 
  | "Brecilien";

export type ItemQuality = 1 | 2 | 3 | 4 | 5;

export interface AlbionItem {
  id: string;          // e.g., T4_MAIN_SPEAR@1
  name: string;        // e.g., Spear (.1)
  tier: number;
  enchantment: number;
  weight: number;
  itemValue: number;
  category: string;
  subCategory: string;
  craftingRecipe?: { id: string; count: number }[];
  icon: string;        // Render service URL
}

export interface AlbionPrice {
  item_id: string;
  city: string;
  quality: ItemQuality;
  sell_price_min: number;
  sell_price_min_date: string;
  sell_price_max: number;
  sell_price_max_date: string;
  buy_price_min: number;
  buy_price_min_date: string;
  buy_price_max: number;
  buy_price_max_date: string;
  historical_avg?: number;
  historical_count?: number;
}

export interface ProfitResult {
  netProfit: number;
  totalFees: number;
  setupFee: number;
  taxAmount: number;
  finalProfit: number;
}

export interface PriceDataWithProfit extends AlbionPrice {
  profit?: ProfitResult;
  isCheapest?: boolean;
}

export interface AlbionHistory {
  location: string;
  item_id: string;
  quality: number;
  data: {
    item_count: number;
    avg_price: number;
    timestamp: string;
  }[];
}

export const ALBION_CITIES: AlbionCity[] = [
  "Martlock",
  "Bridgewatch",
  "Lymhurst",
  "Fort Sterling",
  "Thetford",
  "Caerleon",
  "Brecilien",
];
