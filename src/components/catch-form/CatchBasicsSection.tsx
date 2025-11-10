import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UK_FRESHWATER_SPECIES } from "@/lib/freshwater-data";
import { ChevronsUpDown, Upload } from "lucide-react";

interface CatchBasicsSectionProps {
  imageFile: File | null;
  imagePreview: string;
  title: string;
  species: string;
  customSpecies: string;
  weight: string;
  weightUnit: string;
  length: string;
  lengthUnit: string;
  speciesPopoverOpen: boolean;
  speciesSearch: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTitleChange: (title: string) => void;
  onSpeciesChange: (species: string, customSpecies: string) => void;
  onWeightChange: (weight: string) => void;
  onWeightUnitChange: (unit: string) => void;
  onLengthChange: (length: string) => void;
  onLengthUnitChange: (unit: string) => void;
  onSpeciesPopoverOpenChange: (open: boolean) => void;
  onSpeciesSearchChange: (search: string) => void;
}

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trimStart();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

const toTitleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

export const CatchBasicsSection = ({
  imageFile,
  imagePreview,
  title,
  species,
  customSpecies,
  weight,
  weightUnit,
  length,
  lengthUnit,
  speciesPopoverOpen,
  speciesSearch,
  onImageChange,
  onTitleChange,
  onSpeciesChange,
  onWeightChange,
  onWeightUnitChange,
  onLengthChange,
  onLengthUnitChange,
  onSpeciesPopoverOpenChange,
  onSpeciesSearchChange,
}: CatchBasicsSectionProps) => {
  const trimmedSpeciesSearch = speciesSearch.trim();
  const hasExactSpeciesMatch =
    trimmedSpeciesSearch.length > 0 &&
    UK_FRESHWATER_SPECIES.some(
      (item) => item.label.toLowerCase() === trimmedSpeciesSearch.toLowerCase()
    );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Catch Basics</h3>

      <div className="space-y-2">
        <Label htmlFor="image">Main Photo *</Label>
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-48 mx-auto rounded"
            />
          ) : (
            <div className="space-y-2">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Upload your catch photo
              </p>
            </div>
          )}
          <Input
            id="image"
            type="file"
            accept="image/*"
            onChange={onImageChange}
            className="mt-4"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => onTitleChange(capitalizeFirstWord(e.target.value))}
          placeholder="e.g., Beautiful 20lb Mirror Carp"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="species">Species *</Label>
        <Popover
          open={speciesPopoverOpen}
          onOpenChange={(isOpen) => {
            onSpeciesPopoverOpenChange(isOpen);
            if (!isOpen) {
              onSpeciesSearchChange("");
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={speciesPopoverOpen}
              className="w-full justify-between"
            >
              {(() => {
                const selectedSpecies = UK_FRESHWATER_SPECIES.find(
                  (item) => item.value === species
                );
                if (selectedSpecies) return selectedSpecies.label;
                if (customSpecies) return customSpecies;
                return "Select species";
              })()}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0">
            <Command>
              <CommandInput
                placeholder="Search species…"
                value={speciesSearch}
                onValueChange={onSpeciesSearchChange}
              />
              <CommandList>
                <CommandEmpty>
                  {trimmedSpeciesSearch
                    ? `No species found for "${trimmedSpeciesSearch}"`
                    : "Start typing to search species"}
                </CommandEmpty>
                <CommandGroup>
                  {trimmedSpeciesSearch && !hasExactSpeciesMatch && (
                    <CommandItem
                      value={`custom-${trimmedSpeciesSearch.toLowerCase()}`}
                      onSelect={() => {
                        const customValue = toTitleCase(trimmedSpeciesSearch);
                        onSpeciesChange("other", customValue);
                        onSpeciesSearchChange("");
                        onSpeciesPopoverOpenChange(false);
                      }}
                    >
                      Use "{toTitleCase(trimmedSpeciesSearch)}"
                    </CommandItem>
                  )}
                  {(species || customSpecies) && (
                    <CommandItem
                      value="clear-selection"
                      onSelect={() => {
                        onSpeciesChange("", "");
                        onSpeciesSearchChange("");
                        onSpeciesPopoverOpenChange(false);
                      }}
                    >
                      Clear selection
                    </CommandItem>
                  )}
                  {UK_FRESHWATER_SPECIES.filter(
                    (s) => s.value !== "other"
                  ).map((speciesItem) => (
                    <CommandItem
                      key={speciesItem.value}
                      value={speciesItem.label.toLowerCase()}
                      onSelect={() => {
                        onSpeciesChange(speciesItem.value, "");
                        onSpeciesSearchChange("");
                        onSpeciesPopoverOpenChange(false);
                      }}
                    >
                      {speciesItem.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="weight">Weight</Label>
          <Input
            id="weight"
            type="number"
            step="0.01"
            value={weight}
            onChange={(e) => onWeightChange(e.target.value)}
            placeholder="e.g., 20.5"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weightUnit">Unit</Label>
          <Select value={weightUnit} onValueChange={onWeightUnitChange}>
            <SelectTrigger id="weightUnit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lb_oz">lb/oz</SelectItem>
              <SelectItem value="kg">kg</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="length">Length (optional)</Label>
          <Input
            id="length"
            type="number"
            step="0.1"
            value={length}
            onChange={(e) => onLengthChange(e.target.value)}
            placeholder="e.g., 65"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lengthUnit">Unit</Label>
          <Select value={lengthUnit} onValueChange={onLengthUnitChange}>
            <SelectTrigger id="lengthUnit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cm">cm</SelectItem>
              <SelectItem value="in">in</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
