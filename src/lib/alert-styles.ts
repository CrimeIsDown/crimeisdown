import { cva } from "class-variance-authority";

export const alertVariants = cva(
  "rounded-xl border px-4 py-3 text-sm leading-6",
  {
    variants: {
      variant: {
        default: "border-border/70 bg-muted/40 text-foreground",
        destructive:
          "border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15",
        warning:
          "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-100",
        info: "border-sky-500/20 bg-sky-500/10 text-sky-900 dark:border-sky-400/25 dark:bg-sky-400/15 dark:text-sky-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
