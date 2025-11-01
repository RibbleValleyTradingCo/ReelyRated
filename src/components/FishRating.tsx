import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface FishRatingProps {
  rating: number;
  commentary: string;
  imageData: string;
}

export const FishRating = ({ rating, commentary, imageData }: FishRatingProps) => {
  const getRatingColor = (rating: number) => {
    if (rating >= 9) return "from-accent to-primary";
    if (rating >= 7) return "from-primary to-secondary";
    if (rating >= 5) return "from-secondary to-accent";
    return "from-muted to-muted-foreground";
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-[0_10px_40px_-10px_hsl(210_95%_45%/0.3)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-3xl">
          <Sparkles className="w-6 h-6 text-accent" />
          Fish Rating Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative rounded-lg overflow-hidden">
          <img src={imageData} alt="Rated fish" className="w-full h-auto max-h-[300px] object-contain" />
        </div>

        <div className="text-center space-y-4">
          <div
            className={`inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br ${getRatingColor(rating)} text-primary-foreground shadow-[0_10px_40px_-10px_hsl(210_95%_45%/0.4)]`}
          >
            <div>
              <p className="text-5xl font-bold">{rating}</p>
              <p className="text-sm">/ 10</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold">AI Commentary</h3>
            <p className="text-muted-foreground leading-relaxed">{commentary}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
