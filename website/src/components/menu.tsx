"use client";

import Link from "next/link";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { siteConfig } from "@/lib/config";

export default function NavigationMenuDemo() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        {siteConfig.header.map((item, index) => {
          const isHash = item.href.startsWith("#");
          const isExternal = item.href.startsWith("http");
          return (
            <NavigationMenuItem key={index}>
              <NavigationMenuLink asChild>
                {isHash ? (
                  <a
                    href={item.href}
                    className={navigationMenuTriggerStyle()}
                    onClick={(e) => {
                      e.preventDefault();
                      document
                        .querySelector(item.href)
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className={navigationMenuTriggerStyle()}
                    {...(isExternal
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {item.label}
                  </Link>
                )}
              </NavigationMenuLink>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
