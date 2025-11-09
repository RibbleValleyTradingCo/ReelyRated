import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-lg active:scale-95 active:shadow-md",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-lg active:scale-95 active:shadow-md",
        outline:
          "border border-input bg-background text-foreground shadow-sm hover:border-primary hover:bg-primary/10 hover:text-primary hover:shadow-lg active:scale-95 active:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90 hover:shadow-lg active:scale-95 active:shadow-md",
        ghost:
          "text-foreground hover:bg-accent/20 hover:text-primary active:bg-accent/30 active:scale-95",
        link: "text-primary underline-offset-4 hover:underline focus-visible:underline",
        ocean:
          "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-md hover:shadow-[0_20px_40px_-12px_hsl(210_95%_45%/0.45)] active:scale-95",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-7",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
