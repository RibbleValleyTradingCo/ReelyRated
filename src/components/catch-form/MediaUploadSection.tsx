import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface MediaUploadSectionProps {
  imageFile: File | null;
  imagePreview: string;
  galleryFiles: File[];
  galleryPreviews: string[];
  videoUrl: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGalleryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveGalleryImage: (index: number) => void;
  onVideoUrlChange: (url: string) => void;
}

export const MediaUploadSection = ({
  imageFile,
  imagePreview,
  galleryFiles,
  galleryPreviews,
  videoUrl,
  onImageChange,
  onGalleryChange,
  onRemoveGalleryImage,
  onVideoUrlChange,
}: MediaUploadSectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Photo & Media</h3>

      {/* Main Image */}
      <div className="space-y-2">
        <Label htmlFor="image">Main Photo *</Label>
        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-64 object-cover rounded-lg"
            />
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className="mt-2"
            />
          </div>
        ) : (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className="hidden"
            />
            <label
              htmlFor="image"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="rounded-full bg-primary/10 p-3">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Upload your catch photo</p>
                <p className="text-sm text-muted-foreground">
                  Click to browse or drag and drop
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Gallery Photos */}
      <div className="space-y-2">
        <Label htmlFor="gallery">Gallery Photos (up to 6)</Label>
        <div className="grid grid-cols-3 gap-2">
          {galleryPreviews.map((preview, index) => (
            <div key={index} className="relative">
              <img
                src={preview}
                alt={`Gallery ${index + 1}`}
                className="w-full h-24 object-cover rounded"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => onRemoveGalleryImage(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {galleryFiles.length < 6 && (
            <label className="border-2 border-dashed rounded flex items-center justify-center h-24 cursor-pointer hover:bg-accent">
              <Plus className="h-6 w-6 text-muted-foreground" />
              <Input
                id="gallery"
                type="file"
                accept="image/*"
                multiple
                onChange={onGalleryChange}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Video URL */}
      <div className="space-y-2">
        <Label htmlFor="videoUrl">Video URL (optional)</Label>
        <Input
          id="videoUrl"
          value={videoUrl}
          onChange={(e) => onVideoUrlChange(e.target.value)}
          placeholder="e.g., YouTube or Vimeo link"
        />
      </div>
    </div>
  );
};
