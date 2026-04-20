"use client";

import * as React from "react";
import { ChevronRightIcon, LogInIcon, MenuIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/lib/button-styles";
import {
  isNavItemActive,
  type ActionLink,
  type NavItem,
} from "@/lib/site";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Props = {
  items: NavItem[];
  pathname: string;
  cta: ActionLink;
};

export default function MobileNavigation({ items, pathname, cta }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="rounded-full lg:hidden"
            aria-label="Open navigation menu"
          />
        }
      >
        <MenuIcon className="size-4" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[88vw] max-w-sm border-l border-border/70 bg-background/98 p-0"
      >
        <SheetHeader className="border-b border-border/70 pb-4">
          <SheetTitle>CrimeIsDown navigation</SheetTitle>
          <SheetDescription>
            Public scanner tools, transcript entry points, and support links.
          </SheetDescription>
        </SheetHeader>
        <div className="flex h-full flex-col gap-6 p-4">
          <nav className="grid gap-2">
            {items.map((item) => {
              const isActive = isNavItemActive(pathname, item);

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-2xl border border-transparent bg-transparent px-4 py-3 no-underline transition-colors",
                    "hover:border-border hover:bg-muted/70",
                    isActive && "border-border bg-muted text-foreground",
                  )}
                  onClick={() => setOpen(false)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {item.label}
                      </div>
                      {item.description && (
                        <div className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </div>
                      )}
                    </div>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </div>
                </a>
              );
            })}
          </nav>

          <a
            href={cta.href}
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "justify-center no-underline",
            )}
            target={cta.external ? "_blank" : undefined}
            rel={cta.external ? "noreferrer" : undefined}
          >
            <LogInIcon className="size-4" />
            {cta.label}
          </a>

          <div className="rounded-2xl border border-border/70 bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
            The live site still exposes transcript tools and directive tracking in
            the main shell. This Astro rewrite keeps those entry points visible
            while the public UI is being rebuilt.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
