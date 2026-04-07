import { AlbionItem, ItemQuality, AlbionCity } from "../../types/albion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter } from "lucide-react";
import CityFilter from "../common/CityFilter";
import { getEnchantmentColor, getBaseIdAndEnchantment } from "../../lib/enchantment-utils";

interface PrimaryFiltersProps {
  selectedCities: AlbionCity[];
  onCitiesChange: (cities: AlbionCity[]) => void;
  preferredEnchantments: number[];
  onEnchantmentsChange: (enchantments: number[]) => void;
  selectedQualities: ItemQuality[];
  onQualitiesChange: (qualities: ItemQuality[]) => void;
  selectedItem?: AlbionItem | null;
  onItemChange?: (item: AlbionItem) => void;
  activeTab: string;
  buyPrice: number;
  onBuyPriceChange: (price: number) => void;
}

const qualities = [
  { value: 1, label: "Normal" },
  { value: 2, label: "Good" },
  { value: 3, label: "Outstanding" },
  { value: 4, label: "Excellent" },
  { value: 5, label: "Masterpiece" },
];

export default function PrimaryFilters({
  selectedCities,
  onCitiesChange,
  preferredEnchantments,
  onEnchantmentsChange,
  selectedQualities,
  onQualitiesChange,
  selectedItem,
  onItemChange,
  activeTab,
  buyPrice,
  onBuyPriceChange,
}: PrimaryFiltersProps) {
  const handleEnchantmentClick = (level: number) => {
    if (activeTab === 'search' && selectedItem && onItemChange) {
      const { baseId } = getBaseIdAndEnchantment(selectedItem.id);
      const newId = level === 0 ? baseId : `${baseId}@${level}`;
      onItemChange({ ...selectedItem, id: newId, enchantment: level });
    } else {
      // Toggle enchantment level in the preferred list
      let newEnchantments: number[];
      if (preferredEnchantments.includes(level)) {
        if (preferredEnchantments.length > 1) {
          newEnchantments = preferredEnchantments.filter(e => e !== level);
        } else {
          newEnchantments = preferredEnchantments;
        }
      } else {
        newEnchantments = [...preferredEnchantments, level];
      }
      onEnchantmentsChange(newEnchantments);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-2">
      <CityFilter selectedCities={selectedCities} onChange={onCitiesChange} />

      <div className="flex items-center gap-1 glass-panel p-1 rounded-xl border border-sidebar-border/20">
        <span className="text-tiny font-bold text-sidebar-foreground/70 uppercase tracking-wider hidden sm:block mr-1">
          Enchant
        </span>
        <div className="flex gap-0.5 sm:gap-1">
          {[0, 1, 2, 3, 4].map((level) => {
            let isActive = false;
            if (activeTab === 'search' && selectedItem) {
              const { enchantment } = getBaseIdAndEnchantment(selectedItem.id);
              isActive = enchantment === level;
            } else {
              isActive = preferredEnchantments.includes(level);
            }
            return (
              <button
                key={level}
                onClick={() => handleEnchantmentClick(level)}
                aria-label={`Enchantment ${level}`}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all ${getEnchantmentColor(
                  level,
                  isActive
                )}`}
              >
                {level}
              </button>
            );
          })}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 h-10 px-3 text-foreground/80 hover:text-foreground border-border/60 hover:border-primary/30">
            <Filter className="w-4 h-4 text-primary/70" />
            <span className="font-bold uppercase tracking-wider text-xs hidden sm:inline">Quality</span>
            <span className="bg-sidebar-primary text-sidebar-primary-foreground px-1.5 py-0.5 rounded text-xs font-bold">
              {selectedQualities.length}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {qualities.map((q) => (
            <DropdownMenuCheckboxItem
              key={q.value}
              checked={selectedQualities.includes(q.value as ItemQuality)}
              onCheckedChange={(checked) => {
                const val = q.value as ItemQuality;
                if (checked) {
                  onQualitiesChange([...selectedQualities, val]);
                } else {
                  if (selectedQualities.length > 1) {
                    onQualitiesChange(selectedQualities.filter((x) => x !== val));
                  }
                }
              }}
              className="text-white font-semibold"
            >
              {q.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeTab === "search" && (
        <div className="flex items-center gap-2 glass-panel p-2 rounded-xl border border-sidebar-border/20 h-10 sm:h-12">
          <label htmlFor="buy-price-input" className="text-sidebar-foreground/75 font-medium text-xs sm:text-sm px-2">Buy:</label>
          <input
            id="buy-price-input"
            type="number"
            value={buyPrice || ""}
            onChange={(e) => onBuyPriceChange(Number(e.target.value))}
            placeholder="0"
            aria-label="Buy price in silver"
            className="bg-transparent text-sidebar-foreground focus:outline-none w-16 sm:w-28 font-mono text-right text-sm"
          />
        </div>
      )}
    </div>
  );
}








