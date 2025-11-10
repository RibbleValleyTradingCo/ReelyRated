import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StorySectionProps {
  description: string;
  onDescriptionChange: (description: string) => void;
}

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trimStart();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

export const StorySection = ({
  description,
  onDescriptionChange,
}: StorySectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Your Story</h3>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) =>
            onDescriptionChange(capitalizeFirstWord(e.target.value))
          }
          placeholder="Tell the story of this catch... What happened? What was special about it?"
          rows={5}
        />
      </div>
    </div>
  );
};
