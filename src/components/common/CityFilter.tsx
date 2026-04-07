import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { AlbionCity, ALBION_CITIES } from "../../types/albion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CityFilterProps {
  selectedCities: AlbionCity[];
  onChange: (cities: AlbionCity[]) => void;
}

export default function CityFilter({ selectedCities, onChange }: CityFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCity = (city: AlbionCity) => {
    if (selectedCities.includes(city)) {
      if (selectedCities.length > 1) {
        onChange(selectedCities.filter((c) => c !== city));
      }
    } else {
      onChange([...selectedCities, city]);
    }
  };

  const toggleAll = () => {
    if (selectedCities.length === ALBION_CITIES.length) {
      onChange([ALBION_CITIES[0]]); // Keep at least one
    } else {
      onChange([...ALBION_CITIES]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Filter by city"
        aria-expanded={isOpen}
        className="flex items-center gap-3 glass-panel p-2.5 px-4 rounded-xl border border-primary/20 text-foreground/80 hover:text-foreground hover:border-primary/40 transition-all min-w-52 justify-between focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-primary/75 font-medium text-sm whitespace-nowrap">Cities:</span>
          <span className="text-sm font-bold truncate">
            {selectedCities.length === ALBION_CITIES.length
              ? "All Cities"
              : `${selectedCities.length} Selected`}
          </span>
        </div>
        <ChevronDown className={cn("w-5 h-5 text-primary/75 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 glass-panel border border-primary/20 rounded-xl shadow-2xl overflow-hidden py-2">
          <button
            onClick={toggleAll}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-primary/10 mb-1"
          >
            <div className={cn(
              "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
              selectedCities.length === ALBION_CITIES.length ? "bg-primary border-primary" : "border-primary/40"
            )}>
              {selectedCities.length === ALBION_CITIES.length && <Check className="w-3.5 h-3.5 text-black" />}
            </div>
            <span className="text-sm font-bold text-white uppercase tracking-wider">Select All</span>
          </button>

          <div className="max-h-60 overflow-y-auto">
            {ALBION_CITIES.map((city) => (
              <button
                key={city}
                onClick={() => toggleCity(city)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left min-h-11"
              >
                <div className={cn(
                  "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                  selectedCities.includes(city) ? "bg-primary border-primary" : "border-primary/40"
                )}>
                  {selectedCities.includes(city) && <Check className="w-3.5 h-3.5 text-black" />}
                </div>
                <span className="text-sm text-foreground">{city}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}








