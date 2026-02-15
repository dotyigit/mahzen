import Section from "@/components/section";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import Link from "next/link";

export default function CtaSection() {
  return (
    <Section
      id="cta"
      title="Ready to get started?"
      subtitle="Download Mahzen for free today."
      className="bg-primary/10 rounded-xl py-16"
    >
      <div className="flex flex-col w-full sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 pt-4">
        <Link
          href="https://github.com/dotyigit/mahzen/releases"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "default" }),
            "w-full sm:w-auto text-background flex gap-2"
          )}
        >
          <Download className="h-5 w-5" />
          Download for Free
        </Link>
      </div>
    </Section>
  );
}
