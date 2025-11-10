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
import { ChevronsUpDown } from "lucide-react";

interface TacticsSectionProps {
  baitUsed: string;
  method: string;
  customMethod: string;
  equipmentUsed: string;
  baitPopoverOpen: boolean;
  methodPopoverOpen: boolean;
  baitSearch: string;
  methodSearch: string;
  isLoadingBaits: boolean;
  isLoadingMethods: boolean;
  baitsByCategory: Record<string, { slug: string; label: string }[]>;
  methodsByGroup: Record<string, { slug: string; label: string }[]>;
  trimmedBaitSearch: string;
  trimmedMethodSearch: string;
  onBaitUsedChange: (bait: string) => void;
  onMethodChange: (method: string, customMethod: string) => void;
  onCustomMethodChange: (customMethod: string) => void;
  onEquipmentUsedChange: (equipment: string) => void;
  onBaitPopoverOpenChange: (open: boolean) => void;
  onMethodPopoverOpenChange: (open: boolean) => void;
  onBaitSearchChange: (search: string) => void;
  onMethodSearchChange: (search: string) => void;
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

export const TacticsSection = ({
  baitUsed,
  method,
  customMethod,
  equipmentUsed,
  baitPopoverOpen,
  methodPopoverOpen,
  baitSearch,
  methodSearch,
  isLoadingBaits,
  isLoadingMethods,
  baitsByCategory,
  methodsByGroup,
  trimmedBaitSearch,
  trimmedMethodSearch,
  onBaitUsedChange,
  onMethodChange,
  onCustomMethodChange,
  onEquipmentUsedChange,
  onBaitPopoverOpenChange,
  onMethodPopoverOpenChange,
  onBaitSearchChange,
  onMethodSearchChange,
}: TacticsSectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Tactics</h3>

      <div className="space-y-2">
        <Label htmlFor="baitUsed">Bait Used</Label>
        <Popover
          open={baitPopoverOpen}
          onOpenChange={(isOpen) => {
            onBaitPopoverOpenChange(isOpen);
            if (!isOpen) {
              onBaitSearchChange("");
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={baitPopoverOpen}
              className="w-full justify-between"
            >
              {(() => {
                if (isLoadingBaits) return "Loading baits…";
                if (baitUsed) return baitUsed;
                return "Select bait";
              })()}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0">
            <Command>
              <CommandInput
                placeholder="Search baits…"
                value={baitSearch}
                onValueChange={onBaitSearchChange}
              />
              <CommandList>
                <CommandEmpty>
                  {isLoadingBaits
                    ? "Loading baits…"
                    : trimmedBaitSearch
                      ? `No baits found for "${baitSearch}"`
                      : "Start typing to search baits"}
                </CommandEmpty>
                <CommandGroup heading="Quick actions">
                  {trimmedBaitSearch && (
                    <CommandItem
                      value={`custom-bait-${trimmedBaitSearch}`}
                      onSelect={() => {
                        const customValue = toTitleCase(baitSearch.trim());
                        if (!customValue) return;
                        onBaitUsedChange(customValue);
                        onBaitSearchChange("");
                        onBaitPopoverOpenChange(false);
                      }}
                    >
                      Use "{toTitleCase(baitSearch.trim())}"
                    </CommandItem>
                  )}
                  {baitUsed && (
                    <CommandItem
                      value="clear-bait-selection"
                      onSelect={() => {
                        onBaitUsedChange("");
                        onBaitSearchChange("");
                        onBaitPopoverOpenChange(false);
                      }}
                    >
                      Clear selection
                    </CommandItem>
                  )}
                </CommandGroup>
                {Object.entries(baitsByCategory).map(([category, items]) => (
                  <CommandGroup key={category} heading={category}>
                    {items.map((bait) => (
                      <CommandItem
                        key={bait.slug}
                        value={bait.slug}
                        onSelect={() => {
                          onBaitUsedChange(bait.label);
                          onBaitSearchChange("");
                          onBaitPopoverOpenChange(false);
                        }}
                      >
                        {bait.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="method">Method</Label>
        <Popover
          open={methodPopoverOpen}
          onOpenChange={(isOpen) => {
            onMethodPopoverOpenChange(isOpen);
            if (!isOpen) {
              onMethodSearchChange("");
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={methodPopoverOpen}
              className="w-full justify-between"
            >
              {(() => {
                if (isLoadingMethods) return "Loading methods…";
                if (method === "other") {
                  return customMethod || "Other";
                }
                if (method) {
                  const methodOptions = Object.values(methodsByGroup).flat();
                  const selected = methodOptions.find(
                    (item) => item.slug === method
                  );
                  if (selected) return selected.label;
                  return toTitleCase(method.replace(/[-_]/g, " "));
                }
                return "Select method";
              })()}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0">
            <Command>
              <CommandInput
                placeholder="Search methods…"
                value={methodSearch}
                onValueChange={onMethodSearchChange}
              />
              <CommandList>
                <CommandEmpty>
                  {isLoadingMethods
                    ? "Loading methods…"
                    : trimmedMethodSearch
                      ? `No methods found for "${methodSearch}"`
                      : "Start typing to search methods"}
                </CommandEmpty>
                <CommandGroup heading="Quick actions">
                  {trimmedMethodSearch && (
                    <CommandItem
                      value={`custom-${trimmedMethodSearch}`}
                      onSelect={() => {
                        const customValue = toTitleCase(methodSearch.trim());
                        onMethodChange("other", customValue);
                        onMethodSearchChange("");
                        onMethodPopoverOpenChange(false);
                      }}
                    >
                      Use "{toTitleCase(methodSearch.trim())}"
                    </CommandItem>
                  )}
                  {method || customMethod ? (
                    <CommandItem
                      value="clear-method-selection"
                      onSelect={() => {
                        onMethodChange("", "");
                        onMethodSearchChange("");
                        onMethodPopoverOpenChange(false);
                      }}
                    >
                      Clear selection
                    </CommandItem>
                  ) : null}
                  <CommandItem
                    value="select-other-method"
                    onSelect={() => {
                      onMethodChange("other", customMethod);
                      onMethodPopoverOpenChange(false);
                      onMethodSearchChange("");
                    }}
                  >
                    Other (describe manually)
                  </CommandItem>
                </CommandGroup>
                {Object.entries(methodsByGroup).map(([groupLabel, items]) => (
                  <CommandGroup key={groupLabel} heading={groupLabel}>
                    {items.map((methodItem) => (
                      <CommandItem
                        key={methodItem.slug}
                        value={methodItem.slug}
                        onSelect={() => {
                          onMethodChange(methodItem.slug, "");
                          onMethodSearchChange("");
                          onMethodPopoverOpenChange(false);
                        }}
                      >
                        {methodItem.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {method === "other" && (
          <div className="space-y-1">
            <Label
              htmlFor="customMethod"
              className="text-xs text-muted-foreground"
            >
              Describe the method
            </Label>
            <Input
              id="customMethod"
              value={customMethod}
              onChange={(e) =>
                onCustomMethodChange(capitalizeFirstWord(e.target.value))
              }
              placeholder="e.g., Zigs"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="equipmentUsed">Equipment</Label>
        <Input
          id="equipmentUsed"
          value={equipmentUsed}
          onChange={(e) =>
            onEquipmentUsedChange(capitalizeFirstWord(e.target.value))
          }
          placeholder="e.g., 12ft carp rod, baitrunner reel"
        />
      </div>
    </div>
  );
};
