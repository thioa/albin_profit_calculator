import { ProfitResult } from "../types/albion";

export const calculateProfit = (
  price: number,
  isPremium: boolean = true,
  buyPrice: number = 0
): ProfitResult => {
  if (price <= 0) {
    return {
      netProfit: 0,
      totalFees: 0,
      setupFee: 0,
      taxAmount: 0,
      finalProfit: -buyPrice,
    };
  }

  const setupFeeRate = 0.01; // 1%
  const marketTaxRate = isPremium ? 0.04 : 0.08; // 4% or 8%

  const setupFee = Math.floor(price * setupFeeRate);
  const taxAmount = Math.floor(price * marketTaxRate);
  const totalFees = setupFee + taxAmount;
  const netProfit = price - totalFees;
  const finalProfit = netProfit - buyPrice;

  return {
    netProfit,
    totalFees,
    setupFee,
    taxAmount,
    finalProfit,
  };
};

export const formatSilver = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
};

export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};

export const isStaleData = (dateString: string): boolean => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return diffInHours > 24;
};

export type FreshnessLevel = "excellent" | "good" | "fair" | "stale";

export const getFreshnessLevel = (dateString: string): FreshnessLevel => {
  if (!dateString) return "stale";
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) return "excellent";
  if (diffInHours < 6) return "good";
  if (diffInHours < 24) return "fair";
  return "stale";
};

export const getProfitPercentage = (buyPrice: number, finalProfit: number): number => {
  if (buyPrice <= 0) return 0;
  return (finalProfit / buyPrice) * 100;
};

export const getQualityName = (quality: number): string => {
  switch (quality) {
    case 1: return "Normal";
    case 2: return "Good";
    case 3: return "Outstanding";
    case 4: return "Excellent";
    case 5: return "Masterpiece";
    default: return "Unknown";
  }
};
