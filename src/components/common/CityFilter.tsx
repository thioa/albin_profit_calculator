import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { AlbionCity, ALBION_CITIES } from "../types/albion";
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
        className="flex items-center gap-3 glass-panel p-2 px-4 rounded-lg border border-primary/10 text-white hover:border-gray-600 transition-all min-w-[200px] justify-between"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-primary/60 font-medium whitespace-nowrap">Cities:</span>
          <span className="text-xs font-bold truncate">
            {selectedCities.length === ALBION_CITIES.length
              ? "All Cities"
              : `${selectedCities.length} Selected`}
          </span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-primary/60 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 glass-panel border border-primary/20 rounded-xl shadow-2xl overflow-hidden py-2">
          <button
            onClick={toggleAll}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#2a2a2a] transition-colors text-left border-b border-primary/10 mb-1"
          >
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
              selectedCities.length === ALBION_CITIES.length ? "bg-primary border-primary" : "border-gray-600"
            )}>
              {selectedCities.length === ALBION_CITIES.length && <Check className="w-3 h-3 text-black" />}
            </div>
            <span className="text-sm font-bold text-white uppercase tracking-wider">Select All</span>
          </button>
          
          <div className="max-h-60 overflow-y-auto">
            {ALBION_CITIES.map((city) => (
              <button
                key={city}
                onClick={() => toggleCity(city)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#2a2a2a] transition-colors text-left"
              >
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  selectedCities.includes(city) ? "bg-primary border-primary" : "border-gray-600"
                )}>
                  {selectedCities.includes(city) && <Check className="w-3 h-3 text-black" />}
                </div>
                <span className="text-sm text-on-surface">{city}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
