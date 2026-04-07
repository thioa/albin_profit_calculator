import { useState, useEffect } from "react";
import { AlbionItem, AlbionPrice, AlbionCity, ItemQuality, AlbionServer } from "../types/albion";
import { fetchPrices, fetchHistory } from "../lib/albion-api";

export function useMarketData(
  selectedItem: AlbionItem | null,
  selectedCities: AlbionCity[],
  selectedQualities: ItemQuality[],
  server: AlbionServer
) {
  const [prices, setPrices] = useState<AlbionPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrices = async () => {
    if (!selectedItem) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPrices(selectedItem.id, selectedCities, selectedQualities, server);

      let historyData: any[] = [];
      try {
        historyData = await fetchHistory(selectedItem.id, selectedCities, selectedQualities, server);
      } catch (hErr) {
        console.error("Failed to fetch history context", hErr);
      }

      const sorted = selectedCities.map(city => {
        const found = data.find(p => p.city === city);
        const targetQuality = found ? found.quality : (selectedQualities[0] || 1);

        const history = historyData.find(h => {
          const hLoc = h.location.toLowerCase().replace(/\s/g, "");
          const cLoc = city.toLowerCase().replace(/\s/g, "");
          return hLoc === cLoc && h.quality === targetQuality;
        });

        let historical_avg = undefined;
        let historical_count = 0;
        if (history && history.data && history.data.length > 0) {
          const sum = history.data.reduce((acc: number, curr: any) => acc + curr.avg_price, 0);
          historical_avg = Math.round(sum / history.data.length);
          historical_count = history.data.reduce((acc: number, curr: any) => acc + curr.item_count, 0);
        }

        return {
          ...(found || {
            item_id: selectedItem.id,
            city,
            quality: selectedQualities[0] || 1,
            sell_price_min: 0,
            sell_price_min_date: "",
            sell_price_max: 0,
            sell_price_max_date: "",
            buy_price_min: 0,
            buy_price_min_date: "",
            buy_price_max: 0,
            buy_price_max_date: "",
          }),
          historical_avg,
          historical_count
        };
      });
      setPrices(sorted);
    } catch (err) {
      setError("Failed to fetch market data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedItem) {
      loadPrices();
    }
  }, [selectedItem, selectedQualities, selectedCities, server]);

  return { prices, loading, error, loadPrices };
}
