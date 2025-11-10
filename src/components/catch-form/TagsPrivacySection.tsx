import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TagsPrivacySectionProps {
  tags: string;
  visibility: string;
  hideExactSpot: boolean;
  onTagsChange: (tags: string) => void;
  onVisibilityChange: (visibility: string) => void;
  onHideExactSpotChange: (hide: boolean) => void;
}

export const TagsPrivacySection = ({
  tags,
  visibility,
  hideExactSpot,
  onTagsChange,
  onVisibilityChange,
  onHideExactSpotChange,
}: TagsPrivacySectionProps) => {
  const capitalizeFirstWord = (value: string) => {
    if (!value) return "";
    const trimmed = value.trimStart();
    if (!trimmed) return "";
    return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Tags & Privacy</h3>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={tags}
          onChange={(e) => onTagsChange(capitalizeFirstWord(e.target.value))}
          placeholder="e.g., #carp, #summer, #pb"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <Select value={visibility} onValueChange={onVisibilityChange}>
          <SelectTrigger id="visibility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="followers">Followers Only</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="hideExactSpot">Hide Exact Location</Label>
          <p className="text-sm text-muted-foreground">
            Keep your fishing spots secret
          </p>
        </div>
        <Switch
          id="hideExactSpot"
          checked={hideExactSpot}
          onCheckedChange={onHideExactSpotChange}
        />
      </div>
    </div>
  );
};
