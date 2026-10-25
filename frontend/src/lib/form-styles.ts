import { cva } from "class-variance-authority";

export const fieldControlVariants = cva(
  "flex w-full rounded-xl border border-input bg-background text-sm text-foreground shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
  {
    variants: {
      kind: {
        input: "h-11 px-3",
        select: "h-11 px-3",
        textarea: "min-h-32 resize-y px-3 py-2",
      },
    },
    defaultVariants: {
      kind: "input",
    },
  },
);

export const helperTextClass = "text-sm leading-6 text-muted-foreground";
