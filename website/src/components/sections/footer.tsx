import { Icons } from "@/components/icons";
import { siteConfig } from "@/lib/config";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer>
      <div className="max-w-6xl mx-auto py-16 sm:px-10 px-5 pb-0">
        <div className="flex flex-col md:flex-row md:justify-between gap-12">
          <div className="flex-shrink-0 max-w-xs">
            <a
              href="/"
              title={siteConfig.name}
              className="relative flex items-center space-x-2"
            >
              <Icons.logo className="w-auto h-[40px]" />
              <span className="text-xl">{siteConfig.name}</span>
            </a>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              A free, open-source desktop app for managing files across all your
              S3-compatible storage providers. Built with Tauri and Rust.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-16 gap-y-8">
            {siteConfig.footer.map((section, index) => (
              <div key={index}>
                <h2 className="font-semibold text-sm uppercase tracking-wider text-foreground">
                  {section.title}
                </h2>
                <ul className="mt-4 space-y-3">
                  {section.links.map((link, linkIndex) => {
                    const isExternal = link.href.startsWith("http");
                    return (
                      <li key={linkIndex}>
                        <Link
                          href={link.href}
                          {...(isExternal
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                          className="group inline-flex cursor-pointer items-center justify-start gap-1.5 text-sm text-muted-foreground duration-200 hover:text-foreground"
                        >
                          {link.icon && link.icon}
                          {link.text}
                          <ChevronRight className="h-3 w-3 translate-x-0 transform opacity-0 transition-all duration-300 ease-out group-hover:translate-x-1 group-hover:opacity-100" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()}{" "}
            <Link
              href="https://farcale.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Farcale
            </Link>
            . All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
