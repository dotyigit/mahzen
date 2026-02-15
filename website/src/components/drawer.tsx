import { Icons } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
  DrawerDescription,
  DrawerTitle
} from "@/components/ui/drawer";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { IoMenuSharp } from "react-icons/io5";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
export default function drawerDemo() {
  return (
    <Drawer>
      <DrawerTrigger>
        <IoMenuSharp className="text-2xl" />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerTitle>
          <VisuallyHidden>Navigation</VisuallyHidden>
        </DrawerTitle>
        <DrawerDescription>
          <VisuallyHidden>Navigation</VisuallyHidden>
        </DrawerDescription>
        <DrawerHeader className="px-6">
          <div className="">
            <Link
              href="/"
              title="brand-logo"
              className="relative mr-6 flex items-center space-x-2"
            >
              <Icons.logo className="w-auto h-[40px]" />
              <span className="text-xl">{siteConfig.name}</span>
            </Link>
          </div>
          <nav>
            <ul className="mt-7 text-left">
              {siteConfig.header.map((item, index) => {
                const isHash = item.href.startsWith("#");
                const isExternal = item.href.startsWith("http");
                return (
                  <li key={index} className="my-3">
                    {isHash ? (
                      <a
                        href={item.href}
                        className="font-semibold"
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
                        className="font-semibold"
                        {...(isExternal
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </DrawerHeader>
        <DrawerFooter>
          <Link
            href="https://github.com/dotyigit/mahzen"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "flex gap-2"
            )}
          >
            <Icons.github className="h-5 w-5" />
            GitHub
          </Link>
          <Link
            href="https://github.com/dotyigit/mahzen/releases"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "default" }),
              "w-full sm:w-auto text-background flex gap-2"
            )}
          >
            Download
          </Link>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
