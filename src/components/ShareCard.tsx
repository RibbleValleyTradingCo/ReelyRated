import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ShareCardProps {
  photoUrl: string;
  species?: string | null;
  weight?: string | null;
  venue?: string | null;
  date?: string | null;
  angler?: string | null;
}

export const ShareCard = ({
  photoUrl,
  species,
  weight,
  venue,
  date,
  angler,
}: ShareCardProps) => {
  const formattedDate = date ? format(new Date(date), "dd MMM yyyy") : undefined;

  return (
    <div className="w-[640px] rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl overflow-hidden">
      <div className="relative h-[360px] w-full overflow-hidden">
        <img
          src={photoUrl}
          alt={species ? `${species} catch` : "Fishing catch"}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/20 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {species && (
              <Badge className="bg-white/15 text-white uppercase tracking-wide">
                {species}
              </Badge>
            )}
            {weight && (
              <Badge className="bg-primary text-primary-foreground uppercase tracking-wide">
                {weight}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/80">
            {venue && <span>{venue}</span>}
            {formattedDate && <span>{formattedDate}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-8 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">ReelyRated Session</p>
          <h2 className="text-2xl font-bold">
            {angler ? `${angler}'s catch` : "Shared catch"}
          </h2>
        </div>
        <div className="text-right text-xs text-white/60">
          <p>reshare your best session</p>
          <p>reelyrated.com</p>
        </div>
      </div>
    </div>
  );
};

export default ShareCard;
