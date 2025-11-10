import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConditionsSectionProps {
  showConditions: boolean;
  weather: string;
  airTemp: string;
  waterClarity: string;
  windDirection: string;
  onShowConditionsChange: (show: boolean) => void;
  onWeatherChange: (weather: string) => void;
  onAirTempChange: (temp: string) => void;
  onWaterClarityChange: (clarity: string) => void;
  onWindDirectionChange: (direction: string) => void;
}

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trimStart();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

export const ConditionsSection = ({
  showConditions,
  weather,
  airTemp,
  waterClarity,
  windDirection,
  onShowConditionsChange,
  onWeatherChange,
  onAirTempChange,
  onWaterClarityChange,
  onWindDirectionChange,
}: ConditionsSectionProps) => {
  return (
    <Collapsible open={showConditions} onOpenChange={onShowConditionsChange}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full flex justify-between"
          type="button"
        >
          <span>Conditions (optional)</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              showConditions && "rotate-180"
            )}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="weather">Weather</Label>
            <Select value={weather} onValueChange={onWeatherChange}>
              <SelectTrigger id="weather">
                <SelectValue placeholder="Select weather" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunny">Sunny</SelectItem>
                <SelectItem value="overcast">Overcast</SelectItem>
                <SelectItem value="raining">Raining</SelectItem>
                <SelectItem value="windy">Windy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="airTemp">Air Temp (°C)</Label>
            <Input
              id="airTemp"
              type="number"
              value={airTemp}
              onChange={(e) => onAirTempChange(e.target.value)}
              placeholder="e.g., 18"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="waterClarity">Water Clarity</Label>
            <Select value={waterClarity} onValueChange={onWaterClarityChange}>
              <SelectTrigger id="waterClarity">
                <SelectValue placeholder="Select clarity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clear">Clear</SelectItem>
                <SelectItem value="coloured">Coloured</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="windDirection">Wind Direction</Label>
            <Input
              id="windDirection"
              value={windDirection}
              onChange={(e) =>
                onWindDirectionChange(capitalizeFirstWord(e.target.value))
              }
              placeholder="e.g., SW"
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
