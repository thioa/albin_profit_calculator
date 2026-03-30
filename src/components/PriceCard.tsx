import { AlbionPrice, ProfitResult } from "../types/albion";
import { calculateProfit, formatSilver, getFreshnessLevel, getProfitPercentage, formatTimeAgo } from "../lib/economy-utils";
import { TrendingUp, TrendingDown, Clock, MapPin, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PriceCardProps {
  price: AlbionPrice;
  isPremium: boolean;
  isLowest: boolean;
  buyPrice: number;
  isBuyCity: boolean;
  onSetBuyCity: () => void;
  key?: string;
}

export default function PriceCard({ price, isPremium, isLowest, buyPrice, isBuyCity, onSetBuyCity }: PriceCardProps) {
  const profit = calculateProfit(price.sell_price_min, isPremium, buyPrice);
  const isProfitable = profit.finalProfit > 0;
  const profitPercent = getProfitPercentage(buyPrice, profit.finalProfit);
  
  const freshness = getFreshnessLevel(price.sell_price_min_date);
  
  const getFreshnessUI = (level: string) => {
    switch (level) {
      case "excellent": return { color: "text-green-500", label: "Excellent", icon: ShieldCheck };
      case "good": return { color: "text-blue-500", label: "Good", icon: ShieldCheck };
      case "fair": return { color: "text-yellow-500", label: "Fair", icon: ShieldAlert };
      case "stale": return { color: "text-red-500", label: "Stale", icon: ShieldAlert };
      default: return { color: "text-gray-500", label: "Unknown", icon: ShieldAlert };
    }
  };

  const freshnessUI = getFreshnessUI(freshness);
  const hasData = price.sell_price_min > 0;

  const getFreshnessBorder = (level: string) => {
    switch (level) {
      case "excellent": return "border-t-green-500";
      case "good": return "border-t-blue-500";
      case "fair": return "border-t-yellow-500";
      case "stale": return "border-t-red-500";
      default: return "border-t-gray-800";
    }
  };

  return (
    <div className={cn(
      "bg-[#1e1e1e] border rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] border-t-4",
      getFreshnessBorder(freshness),
      isBuyCity ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : isLowest ? "border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.15)]" : "border-gray-800"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <MapPin className={cn("w-4 h-4", isBuyCity ? "text-blue-500" : "text-[#D4AF37]")} />
          <h3 className="text-xl font-bold text-white">{price.city}</h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isBuyCity && (
            <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
              Source City
            </span>
          )}
          {isLowest && !isBuyCity && (
            <span className="bg-[#D4AF37] text-black text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
              Lowest Price
            </span>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="space-y-4 py-4">
          <div className="text-center text-gray-500 italic mb-2">
            No Recent Data
          </div>
          {price.historical_avg ? (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                <Clock className="w-3 h-3" /> Historical Context
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Price</div>
                  <div className="text-xl font-mono font-bold text-gray-300">
                    {formatSilver(price.historical_avg)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Volume</div>
                  <div className="text-xs font-mono text-gray-400">
                    {price.historical_count?.toLocaleString()} units
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-gray-600 italic">
                * Based on historical data from the past year.
              </p>
            </div>
          ) : (
            <div className="text-[10px] text-gray-600 text-center italic">
              No historical data available for this item/quality.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Min Sell</div>
              <div className="text-2xl font-mono font-bold text-white">
                {formatSilver(price.sell_price_min)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Max Buy</div>
              <div className="text-lg font-mono text-gray-300">
                {formatSilver(price.buy_price_max)}
              </div>
            </div>
          </div>

          {price.historical_avg && (
            <div className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg border border-white/5">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider">Historical Avg</div>
              <div className="text-xs font-mono text-gray-400">{formatSilver(price.historical_avg)}</div>
            </div>
          )}

          {!isBuyCity ? (
            <button 
              onClick={onSetBuyCity}
              className="w-full py-2 rounded-xl border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-widest hover:bg-blue-500/10 transition-colors"
            >
              Set as Buy City
            </button>
          ) : (
            <div className="w-full py-2 rounded-xl bg-blue-500/10 border border-blue-500/50 text-blue-400 text-xs font-bold uppercase tracking-widest text-center">
              Buying Here
            </div>
          )}

          <div className="h-px bg-gray-800 my-4" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Net Sale</div>
              <div className="text-lg font-mono font-bold text-gray-200">
                {formatSilver(profit.netProfit)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Tax ({isPremium ? '4%' : '8%'})</div>
              <div className="text-xs text-gray-400">-{formatSilver(profit.totalFees)}</div>
            </div>
          </div>

          <div className="bg-black/20 p-4 rounded-xl border border-white/5">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <div className="text-xs text-gray-400 uppercase tracking-wider">Final Profit</div>
                {isProfitable && (
                  <div className="text-[10px] text-blue-400 font-mono flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {profitPercent.toFixed(1)}% ROI
                  </div>
                )}
              </div>
              <div className={cn(
                "text-xl font-mono font-bold flex items-center gap-2",
                isProfitable ? "text-green-500" : profit.finalProfit < 0 ? "text-red-500" : "text-gray-400"
              )}>
                {isProfitable ? <TrendingUp className="w-5 h-5" /> : profit.finalProfit < 0 ? <TrendingDown className="w-5 h-5" /> : null}
                {formatSilver(profit.finalProfit)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800/50">
            <div className="flex items-center gap-2">
              <Clock className={cn("w-3 h-3", freshnessUI.color)} />
              <span className="text-[10px] text-gray-500">
                Updated {formatTimeAgo(price.sell_price_min_date)}
              </span>
            </div>
            <div className={cn("text-[10px] font-bold uppercase tracking-widest flex items-center gap-1", freshnessUI.color)}>
              <freshnessUI.icon className="w-3 h-3" />
              {freshnessUI.label}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
