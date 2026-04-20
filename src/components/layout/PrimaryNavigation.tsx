import { cn } from "@/lib/utils";
import {
  isNavItemActive,
  type NavItem,
} from "@/lib/site";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

type Props = {
  items: NavItem[];
  pathname: string;
};

export default function PrimaryNavigation({ items, pathname }: Props) {
  return (
    <NavigationMenu className="hidden lg:flex">
      <NavigationMenuList className="gap-1">
        {items.map((item) => {
          const isActive = isNavItemActive(pathname, item);

          return (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuLink
                href={item.href}
                data-active={isActive ? "" : undefined}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground",
                  isActive && "bg-muted text-foreground",
                )}
              >
                {item.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
