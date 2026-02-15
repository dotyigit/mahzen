"use client";

import { motion } from "framer-motion";

import { Icons } from "@/components/icons";
import AppWindow from "@/components/app-window";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import Link from "next/link";

const ease = [0.16, 1, 0.3, 1];

function HeroPill() {
  return (
    <motion.a
      href="https://github.com/dotyigit/mahzen"
      target="_blank"
      rel="noopener noreferrer"
      className="group relative isolate inline-flex w-auto items-center gap-3 overflow-hidden rounded-full border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/15 to-primary/10 px-2 py-1 shadow-[0_12px_34px_-22px_var(--primary)] backdrop-blur-sm whitespace-pre"
      initial={{ opacity: 0, y: -20 }}
      animate={{
        opacity: 1,
        y: [0, -2, 0],
        scale: [1, 1.01, 1],
      }}
      whileHover={{
        y: -3,
        scale: 1.02,
        boxShadow: "0 20px 45px -25px var(--primary)",
      }}
      transition={{
        opacity: { duration: 0.8, ease },
        y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
        scale: { duration: 5, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/45 to-transparent dark:via-white/20"
        initial={{ x: "-130%" }}
        animate={{ x: "130%" }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          repeatDelay: 1.4,
          ease: "easeInOut",
        }}
      />
      <div className="w-fit rounded-full bg-accent px-2 py-0.5 text-center text-xs font-medium text-primary sm:text-sm">
        Open Source
      </div>
      <p className="text-xs font-medium text-primary sm:text-sm">
        Free forever on GitHub
      </p>
      <motion.svg
        width="12"
        height="12"
        className="ml-1 text-primary"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ x: [0, 2, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <path
          d="M8.78141 5.33312L5.20541 1.75712L6.14808 0.814453L11.3334 5.99979L6.14808 11.1851L5.20541 10.2425L8.78141 6.66645H0.666748V5.33312H8.78141Z"
          fill="currentColor"
        />
      </motion.svg>
    </motion.a>
  );
}

function HeroTitles() {
  return (
    <div className="flex w-full max-w-4xl flex-col space-y-4 overflow-hidden pt-8">
      <motion.h1
        className="text-center text-4xl font-medium leading-tight text-foreground sm:text-5xl md:text-6xl"
        initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
        animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
        transition={{
          duration: 1,
          ease,
          staggerChildren: 0.2,
        }}
      >
        {["Manage", "your", "cloud", "storage", "from", "one", "place"].map(
          (text, index) => (
            <motion.span
              key={index}
              className="inline-block px-1 md:px-2 text-balance font-semibold"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: index * 0.2,
                ease,
              }}
            >
              {text}
            </motion.span>
          )
        )}
      </motion.h1>
      <motion.p
        className="mx-auto max-w-2xl text-center text-lg leading-7 text-muted-foreground sm:text-xl sm:leading-9 text-balance"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.6,
          duration: 0.8,
          ease,
        }}
      >
        A free, open-source desktop app for browsing, uploading, and managing
        files across all your S3-compatible storage providers.
      </motion.p>
    </div>
  );
}

function HeroCTA() {
  return (
    <motion.div
      className="mx-auto mt-6 flex w-full max-w-2xl flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.8, ease }}
    >
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
      <Link
        href="https://github.com/dotyigit/mahzen"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full sm:w-auto flex gap-2"
        )}
      >
        <Icons.github className="h-5 w-5" />
        View on GitHub
      </Link>
    </motion.div>
  );
}

function HeroImage() {
  return (
    <motion.div
      className="relative mx-auto flex w-full items-center justify-center"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 1, ease }}
    >
      <AppWindow
        src="/dashboard.png"
        className="shadow-2xl max-w-screen-lg mt-16"
      />
    </motion.div>
  );
}

export default function Hero2() {
  return (
    <section id="hero">
      <div className="relative flex w-full flex-col items-center justify-start px-4 pt-32 sm:px-6 sm:pt-24 md:pt-32 lg:px-8">
        <HeroPill />
        <HeroTitles />
        <HeroCTA />
        <HeroImage />
        <div className="pointer-events-none absolute inset-x-0 -bottom-12 h-1/3 bg-gradient-to-t from-background via-background to-transparent lg:h-1/4"></div>
      </div>
    </section>
  );
}
