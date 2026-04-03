import { AlbionPrice, ProfitResult } from "../../types/albion";
import { calculateProfit, formatSilver, getFreshnessLevel, getProfitPercentage, formatTimeAgo } from "../../lib/economy-utils";
import { TrendingUp, TrendingDown, Clock, MapPin, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Card, Badge, Label, Mono } from "../ui";

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
      case "excellent": return { color: "text-green-500", label: "Excellent", icon: ShieldCheck, variant: 'success' as const };
      case "good": return { color: "text-blue-500", label: "Good", icon: ShieldCheck, variant: 'info' as const };
      case "fair": return { color: "text-yellow-500", label: "Fair", icon: ShieldAlert, variant: 'warning' as const };
      case "stale": return { color: "text-red-500", label: "Stale", icon: ShieldAlert, variant: 'error' as const };
      default: return { color: "text-primary/50", label: "Unknown", icon: ShieldAlert, variant: 'default' as const };
    }
  };

  const freshnessUI = getFreshnessUI(freshness);
  const hasData = price.sell_price_min > 0;

  const getFreshnessBorder = (level: string) => {
    switch (level) {
      case "excellent": return 'success';
      case "good": return 'info';
      case "fair": return 'warning';
      case "stale": return 'error';
      default: return undefined;
    }
  };

  const accentColors: Record<string, string> = {
    success: 'border-t-green-500',
    info: 'border-t-blue-500',
    warning: 'border-t-yellow-500',
    error: 'border-t-red-500',
  };

  return (
    <Card
      variant="glass"
      accent={getFreshnessBorder(freshness) as any}
      accentPosition="top"
      padding="md"
      hoverable
      className={cn(
        isBuyCity ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : isLowest ? "border-primary shadow-[0_0_20px_rgba(212,175,55,0.15)]" : ""
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <MapPin className={cn("w-4 h-4", isBuyCity ? "text-info" : "text-primary")} />
          <h3 className="text-lg font-bold text-white">{price.city}</h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isBuyCity && (
            <Badge variant="info" size="sm">Source City</Badge>
          )}
          {isLowest && !isBuyCity && (
            <Badge variant="primary" size="sm">Lowest Price</Badge>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="space-y-4 py-4">
          <div className="text-center text-primary/50 italic mb-2">
            No Recent Data
          </div>
          {price.historical_avg ? (
            <div className="bg-info/5 border border-info/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-info text-xs font-bold uppercase tracking-widest">
                <Clock className="w-3 h-3" /> Historical Context
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-primary/50 uppercase tracking-wider">Avg Price</div>
                  <div className="text-lg font-mono font-bold text-white">
                    {formatSilver(price.historical_avg)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-primary/50 uppercase tracking-wider">Volume</div>
                  <div className="text-sm font-mono text-primary/60">
                    {price.historical_count?.toLocaleString()} units
                  </div>
                </div>
              </div>
              <p className="text-xs text-primary/40 italic">
                * Based on historical data from the past year.
              </p>
            </div>
          ) : (
            <div className="text-xs text-primary/40 text-center italic">
              No historical data available for this item/quality.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label size="sm" color="primary" className="mb-1 block">Min Sell</Label>
              <Mono size="xl" weight="bold" className="text-white">
                {formatSilver(price.sell_price_min)}
              </Mono>
            </div>
            <div>
              <Label size="sm" color="primary" className="mb-1 block">Max Buy</Label>
              <Mono size="lg" weight="medium" className="text-white/80">
                {formatSilver(price.buy_price_max)}
              </Mono>
            </div>
          </div>

          {price.historical_avg && (
            <div className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg border border-white/5">
              <Mono size="xs" color="primary" className="uppercase tracking-wider">Historical Avg</Mono>
              <Mono size="sm" color="primary">{formatSilver(price.historical_avg)}</Mono>
            </div>
          )}

          {!isBuyCity ? (
            <button
              onClick={onSetBuyCity}
              className="w-full py-2.5 rounded-xl border border-info/30 text-info text-xs font-bold uppercase tracking-widest hover:bg-info/10 transition-colors focus:outline-none focus:ring-2 focus:ring-info/50"
            >
              Set as Buy City
            </button>
          ) : (
            <div className="w-full py-2.5 rounded-xl bg-info/10 border border-info/50 text-info text-xs font-bold uppercase tracking-widest text-center">
              Buying Here
            </div>
          )}

          <div className="h-px bg-primary/10" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label size="sm" color="primary" className="mb-1 block">Net Sale</Label>
              <Mono size="lg" weight="bold" className="text-white/90">
                {formatSilver(profit.netProfit)}
              </Mono>
            </div>
            <div className="text-right">
              <Label size="sm" color="muted" className="mb-1 block">Tax ({isPremium ? '4%' : '8%'})</Label>
              <Mono size="sm" color="primary">-{formatSilver(profit.totalFees)}</Mono>
            </div>
          </div>

          <div className="bg-black/20 p-4 rounded-xl border border-white/5">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <Label size="sm" color="primary">Final Profit</Label>
                {isProfitable && (
                  <div className="text-xs text-info font-mono flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {profitPercent.toFixed(1)}% ROI
                  </div>
                )}
              </div>
              <div className={cn(
                "text-lg font-mono font-bold flex items-center gap-2",
                isProfitable ? "text-success" : profit.finalProfit < 0 ? "text-error" : "text-primary/60"
              )}>
                {isProfitable ? <TrendingUp className="w-5 h-5" /> : profit.finalProfit < 0 ? <TrendingDown className="w-5 h-5" /> : null}
                {formatSilver(profit.finalProfit)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-primary/10">
            <div className="flex items-center gap-2">
              <Clock className={cn("w-3 h-3", freshnessUI.color)} />
              <span className="text-xs text-primary/50">
                Updated {formatTimeAgo(price.sell_price_min_date)}
              </span>
            </div>
            <Badge variant={freshnessUI.variant} size="sm" dot>
              {freshnessUI.label}
            </Badge>
          </div>
        </div>
      )}
    </Card>
  );
}
