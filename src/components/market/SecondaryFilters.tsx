import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { VerificationStatus } from "../features/TopFlipping";

interface SecondaryFiltersProps {
  activeTab: string;
  allowedStatuses: VerificationStatus[];
  onStatusesChange: (statuses: VerificationStatus[]) => void;
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  categories: string[];
  selectedSubCategory: string;
  onSubCategoryChange: (subCategory: string) => void;
  subCategories: string[];
  maxAgeHours: number;
  onMaxAgeChange: (hours: number) => void;
}

export default function SecondaryFilters({
  activeTab,
  allowedStatuses,
  onStatusesChange,
  selectedCategories,
  onCategoriesChange,
  categories,
  selectedSubCategory,
  onSubCategoryChange,
  subCategories,
  maxAgeHours,
  onMaxAgeChange,
}: SecondaryFiltersProps) {
  if (!(activeTab === "top-flipping" || activeTab === "market-pulse" || activeTab === "profit-scanner")) {
    return null;
  }
  return (
    <div className="flex flex-wrap justify-center items-center gap-2 px-2">
      {/* Verification Status */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline-filter">
            <Filter className="w-4 h-4 text-primary/70" />
            <span className="font-bold uppercase tracking-wider text-xs">Verification</span>
            <span className="bg-sidebar-primary text-sidebar-primary-foreground px-1.5 py-0.5 rounded text-xs font-bold">
              {allowedStatuses.length}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {[
            { id: "verified", label: "Verified" },
            { id: "unknown", label: "Unknown" },
            { id: "suspicious", label: "Suspicious" },
          ].map((status) => (
            <DropdownMenuCheckboxItem
              key={status.id}
              checked={allowedStatuses.includes(status.id as VerificationStatus)}
              onCheckedChange={(checked) => {
                const s = status.id as VerificationStatus;
                if (checked) {
                  onStatusesChange([...allowedStatuses, s]);
                } else {
                  if (allowedStatuses.length > 1) {
                    onStatusesChange(allowedStatuses.filter((x) => x !== s));
                  }
                }
              }}
            >
              {status.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Category */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline-filter">
            <Filter className="w-4 h-4 text-primary/70" />
            <span className="font-bold uppercase tracking-wider text-xs">Cat</span>
            <span className="bg-sidebar-primary text-sidebar-primary-foreground px-1.5 py-0.5 rounded text-xs font-bold">
              {selectedCategories.includes("All") ? "All" : selectedCategories.length}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <ScrollArea className="h-64">
            {categories.map((cat) => (
              <DropdownMenuCheckboxItem
                key={cat}
                checked={selectedCategories.includes(cat)}
                onCheckedChange={(checked) => {
                  if (cat === "All") {
                    onCategoriesChange(["All"]);
                  } else {
                    let newCats = selectedCategories.filter((c) => c !== "All");
                    if (checked) {
                      newCats = [...newCats, cat];
                    } else {
                      if (newCats.length > 1) {
                        newCats = newCats.filter((c) => c !== cat);
                      } else {
                        newCats = ["All"];
                      }
                    }
                    onCategoriesChange(newCats);
                  }
                  onSubCategoryChange("All");
                }}
              >
                {cat}
              </DropdownMenuCheckboxItem>
            ))}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* SubCategory */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline-filter">
            <Filter className="w-4 h-4 text-primary/70" />
            <span className="font-bold uppercase tracking-wider text-xs">Sub</span>
            <span className="bg-sidebar-primary text-sidebar-primary-foreground px-1.5 py-0.5 rounded text-xs font-bold">
              {selectedSubCategory}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <ScrollArea className="h-64">
            {subCategories.map((sub) => (
              <DropdownMenuCheckboxItem
                key={sub}
                checked={selectedSubCategory === sub}
                onCheckedChange={() => {
                  onSubCategoryChange(sub);
                }}
              >
                {sub}
              </DropdownMenuCheckboxItem>
            ))}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Age */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline-filter">
            <Clock className="w-4 h-4 text-primary/70" />
            <span className="font-bold uppercase tracking-wider text-xs">Age</span>
            <span className="bg-sidebar-primary text-sidebar-primary-foreground px-1.5 py-0.5 rounded text-xs font-bold">
              {maxAgeHours === 0 ? "Any" : `${maxAgeHours}h`}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {[
            { value: 1, label: "1 Hour" },
            { value: 6, label: "6 Hours" },
            { value: 12, label: "12 Hours" },
            { value: 24, label: "24 Hours" },
            { value: 0, label: "Any Age" },
          ].map((age) => (
            <DropdownMenuItem
              key={age.value}
              onClick={() => onMaxAgeChange(age.value)}
              className={cn("text-white font-semibold", maxAgeHours === age.value && "bg-accent")}
            >
              {age.label}
              {maxAgeHours === age.value && <Check className="w-4 h-4 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}








