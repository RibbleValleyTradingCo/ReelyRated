import { Waves } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  iconClassName?: string;
}

export const LogoMark = ({ className, iconClassName }: LogoMarkProps) => {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary/80 to-secondary text-primary-foreground shadow-lg",
        className
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.35),transparent_60%)]" />
      <Waves className={cn("relative h-[55%] w-[55%]", iconClassName)} strokeWidth={2.5} />
    </div>
  );
};

export default LogoMark;
