import { useState, useEffect } from "react";
import { AlbionItem, AlbionPrice, AlbionServer } from "../../types/albion";
import { fetchPrices, fetchHistory } from "../../lib/albion-api";
import { useAuth } from "../../contexts/AuthContext";
import { useFilter } from "../../contexts/FilterContext";
import SearchBar from "../common/SearchBar";
import PriceCard from "../common/PriceCard";
import { Loader2, Settings, Info, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

interface PriceCheckerProps {
  server: AlbionServer;
}

export default function PriceChecker({ server }: PriceCheckerProps) {
  const { user } = useAuth();
  const filter = useFilter();

  const [selectedItem, setSelectedItem] = useState<AlbionItem | null>(null);
  const [prices, setPrices] = useState<AlbionPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPremium = user?.subscription?.tier === 'premium' || user?.role === 'superuser';

  // Auto-load prices when item or relevant filters change
  useEffect(() => {
    if (selectedItem) loadPrices();
  }, [selectedItem, filter.selectedQualities, filter.selectedCities, server]);

  // Auto-set buy price from selected buy city
  useEffect(() => {
    if (filter.buyCity) {
      const src = prices.find(p => p.city === filter.buyCity);
      if (src && src.sell_price_min > 0) filter.setBuyPrice(src.sell_price_min);
    }
  }, [filter.buyCity, prices]);

  const loadPrices = async () => {
    if (!selectedItem) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPrices(selectedItem.id, filter.selectedCities, filter.selectedQualities, server);

      let historyData: any[] = [];
      try {
        historyData = await fetchHistory(selectedItem.id, filter.selectedCities, filter.selectedQualities, server);
      } catch { /* history is supplementary, don't fail hard */ }

      const sorted = filter.selectedCities.map(city => {
        const found = data.find(p => p.city === city);
        const targetQuality = found ? found.quality : (filter.selectedQualities[0] || 1);
        const history = historyData.find(h => {
          const hLoc = h.location.toLowerCase().replace(/\s/g, "");
          const cLoc = city.toLowerCase().replace(/\s/g, "");
          return hLoc === cLoc && h.quality === targetQuality;
        });
        let historical_avg: number | undefined;
        let historical_count = 0;
        if (history?.data?.length > 0) {
          const sum = history.data.reduce((acc: number, cur: any) => acc + cur.avg_price, 0);
          historical_avg = Math.round(sum / history.data.length);
          historical_count = history.data.reduce((acc: number, cur: any) => acc + cur.item_count, 0);
        }
        return {
          ...(found || {
            item_id: selectedItem.id, city,
            quality: filter.selectedQualities[0] || 1,
            sell_price_min: 0, sell_price_min_date: "",
            sell_price_max: 0, sell_price_max_date: "",
            buy_price_min: 0, buy_price_min_date: "",
            buy_price_max: 0, buy_price_max_date: "",
          }),
          historical_avg, historical_count,
        };
      });
      setPrices(sorted);
    } catch {
      setError("Failed to fetch market data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const lowestSellPrice = Math.min(...prices.filter(p => p.sell_price_min > 0).map(p => p.sell_price_min));
  const qualities = filter.qualities;

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <SearchBar onSelect={setSelectedItem} />

      {/* Item Detail */}
      {selectedItem ? (
        <>
          {/* Item Header */}
          <div className="flex flex-col md:flex-row items-center gap-6 glass-panel p-8 rounded-3xl">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
              <img src={selectedItem.icon} alt={selectedItem.name} className="w-32 h-32 object-contain relative z-10" referrerPolicy="no-referrer" />
            </div>
            <div className="text-center md:text-left space-y-2">
              <h2 className="text-4xl font-black text-foreground uppercase italic tracking-tight">{selectedItem.name}</h2>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <span className="bg-muted text-foreground px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Tier {selectedItem.tier}</span>
                <span className="bg-muted text-foreground px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{selectedItem.id}</span>
                <div className="relative group">
                  <span className="bg-muted text-foreground px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest cursor-help">{selectedItem.category}</span>
                  {selectedItem.category === "Unknown" && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black border border-primary/10 rounded text-label text-primary/60 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      This item's category is not specified in our simplified dataset.
                    </div>
                  )}
                </div>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                  {filter.selectedQualities.map(q => qualities.find(x => x.value === q)?.label).join(", ")}
                </span>
              </div>
            </div>
            <div className="md:ml-auto flex items-center gap-2 text-primary/75 text-xs bg-muted/30 p-4 rounded-2xl border border-border">
              <Info className="w-4 h-4" />
              <p className="max-w-50">Data is crowdsourced via AODP. Prices may vary slightly from in-game values.</p>
            </div>
          </div>

          {/* Prices */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-primary/75 font-mono uppercase tracking-widest animate-pulse">Fetching Market Data...</p>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 border border-destructive/50 p-8 rounded-3xl text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <p className="text-destructive font-bold">{error}</p>
              <Button variant="destructive" onClick={loadPrices}>Retry</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {prices.map(price => (
                <PriceCard
                  key={price.city}
                  price={price}
                  isPremium={isPremium}
                  buyPrice={filter.buyPrice}
                  isLowest={price.sell_price_min > 0 && price.sell_price_min === lowestSellPrice}
                  isBuyCity={filter.buyCity === price.city}
                  onSetBuyCity={() => filter.setBuyCity(price.city)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-32 text-center space-y-4 border-2 border-dashed border-primary/10 rounded-3xl"
        >
          {/* TODO: Replace with actual empty state illustration - recommended size: 200x200px */}
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' rx='20' fill='%23151a21'/%3E%3Ccircle cx='100' cy='80' r='40' fill='none' stroke='%23f59e0b' stroke-width='4' stroke-dasharray='8 4'/%3E%3Cpath d='M100 50 L100 110 M70 80 L130 80' stroke='%23f59e0b' stroke-width='4' stroke-linecap='round'/%3E%3Crect x='60' y='130' width='80' height='12' rx='6' fill='%23333'/%3E%3Crect x='70' y='150' width='60' height='8' rx='4' fill='%23222'/%3E%3C/svg%3E"
            alt="Empty state illustration"
            className="w-40 h-40 mx-auto mb-6 opacity-50"
          />
          <h3 className="text-2xl font-bold text-primary/75 uppercase tracking-widest">Select an item to begin</h3>
          <p className="text-muted-foreground max-w-xs mx-auto">Use the search bar above to find items from the Royal Cities and Caerleon.</p>
        </motion.div>
      )}
    </div>
  );
}








