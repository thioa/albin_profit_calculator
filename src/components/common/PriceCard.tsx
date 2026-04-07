import { useState } from "react";
import { AlbionPrice } from "../../types/albion";
import { calculateProfit, formatSilver, getFreshnessLevel, getProfitPercentage, formatTimeAgo } from "../../lib/economy-utils";
import { TrendingUp, TrendingDown, Clock, MapPin, Zap, ChevronDown, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PriceCardProps {
  price: AlbionPrice;
  isPremium: boolean;
  isLowest: boolean;
  buyPrice: number;
  isBuyCity: boolean;
  onSetBuyCity: () => void;
}

export default function PriceCard({ price, isPremium, isLowest, buyPrice, isBuyCity, onSetBuyCity }: PriceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const profit = calculateProfit(price.sell_price_min, isPremium, buyPrice);
  const isProfitable = profit.finalProfit > 0;
  const profitPercent = getProfitPercentage(buyPrice, profit.finalProfit);
  const freshness = getFreshnessLevel(price.sell_price_min_date);
  const hasData = price.sell_price_min > 0;

  const getFreshnessUI = (level: string) => {
    switch (level) {
      case "excellent": return { color: "text-green-500", label: "Excellent" };
      case "good": return { color: "text-blue-500", label: "Good" };
      case "fair": return { color: "text-yellow-500", label: "Fair" };
      case "stale": return { color: "text-red-500", label: "Stale" };
      default: return { color: "text-primary/75", label: "?" };
    }
  };

  const freshnessUI = getFreshnessUI(freshness);

  const getFreshnessBorder = (level: string) => {
    switch (level) {
      case "excellent": return 'border-t-4 border-t-green-500';
      case "good": return 'border-t-4 border-t-blue-500';
      case "fair": return 'border-t-4 border-t-yellow-500';
      case "stale": return 'border-t-4 border-t-red-500';
      default: return '';
    }
  };

  return (
    <Card className={cn(
      "glass-panel rounded-xl overflow-hidden",
      getFreshnessBorder(freshness)
    )}>
      {/* Compact Header - always visible */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className={cn("w-4 h-4 shrink-0", isBuyCity ? "text-blue-400" : "text-primary")} />
            <h3 className="text-base font-bold text-card-foreground truncate">{price.city}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isBuyCity && (
              <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs">Source</Badge>
            )}
            {isLowest && !isBuyCity && (
              <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs">Lowest</Badge>
            )}
          </div>
        </div>

        {/* Main Price - Hero Display */}
        {hasData ? (
          <>
            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <p className="text-xs text-primary/75 uppercase tracking-wider sm:hidden">Sell</p>
                <span className="text-2xl sm:text-xl font-mono font-bold text-foreground">
                  {formatSilver(price.sell_price_min)}
                </span>
              </div>
              <div className={cn(
                "text-xl font-mono font-bold flex items-center gap-1",
                isProfitable ? "text-green-400" : profit.finalProfit < 0 ? "text-red-400" : "text-primary/60"
              )}>
                {isProfitable && <TrendingUp className="w-4 h-4" />}
                {formatSilver(profit.finalProfit)}
              </div>
            </div>

            {/* Quick Stats - Mobile only show profit */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Clock className={cn("w-3 h-3", freshnessUI.color)} />
                <span className="text-xs text-primary/75">{formatTimeAgo(price.sell_price_min_date)}</span>
              </div>
              <button
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Show less details' : 'Show more details'}
                className="flex items-center gap-1 text-xs text-primary/75 hover:text-primary transition-colors"
              >
                {expanded ? 'Less' : 'More'}
                <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
              </button>
            </div>
          </>
        ) : (
          <div className="mt-3 text-center text-primary/75 text-sm">
            No recent data
            {price.historical_avg && (
              <div className="mt-2 flex items-center justify-center gap-2 text-xs">
                <History className="w-3 h-3" />
                Avg: {formatSilver(price.historical_avg)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && hasData && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-primary/75 uppercase tracking-wider">Max Buy</p>
              <span className="text-sm font-mono text-foreground/80">{formatSilver(price.buy_price_max)}</span>
            </div>
            <div>
              <p className="text-xs text-primary/75 uppercase tracking-wider">Tax</p>
              <span className="text-sm font-mono text-primary">-{formatSilver(profit.totalFees)}</span>
            </div>
          </div>

          {price.historical_avg && (
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg text-xs">
              <span className="text-primary/75 font-mono uppercase">Hist. Avg</span>
              <span className="text-primary font-mono">{formatSilver(price.historical_avg)}</span>
            </div>
          )}

          {isProfitable && (
            <div className="flex items-center justify-center gap-1 text-sm text-blue-400 font-mono">
              <Zap className="w-3 h-3" />
              {profitPercent.toFixed(1)}% ROI
            </div>
          )}

          <button
            onClick={onSetBuyCity}
            className="w-full py-2 rounded-lg border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider hover:bg-blue-500/10 transition-colors"
          >
            {isBuyCity ? 'Buying Here' : 'Set as Buy City'}
          </button>
        </div>
      )}
    </Card>
  );
}







