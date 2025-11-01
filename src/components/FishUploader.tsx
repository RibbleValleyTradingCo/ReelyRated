import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FishUploaderProps {
  onRate: (imageData: string) => void;
  isLoading: boolean;
}

export const FishUploader = ({ onRate, isLoading }: FishUploaderProps) => {
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRate = () => {
    if (preview) {
      onRate(preview);
    }
  };

  const handleReset = () => {
    setPreview(null);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-[0_10px_40px_-10px_hsl(210_95%_45%/0.3)]">
      <CardContent className="p-8">
        {!preview ? (
          <label className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors duration-300">
            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Upload Your Fish Photo</p>
            <p className="text-sm text-muted-foreground mb-4">Click or drag and drop</p>
            <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isLoading}
            />
          </label>
        ) : (
          <div className="space-y-6">
            <div className="relative rounded-lg overflow-hidden">
              <img src={preview} alt="Fish preview" className="w-full h-auto max-h-[400px] object-contain" />
            </div>
            <div className="flex gap-4">
              <Button onClick={handleRate} disabled={isLoading} variant="ocean" className="flex-1" size="lg">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Rating...
                  </>
                ) : (
                  "Rate My Fish!"
                )}
              </Button>
              <Button onClick={handleReset} disabled={isLoading} variant="outline" size="lg">
                Reset
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
