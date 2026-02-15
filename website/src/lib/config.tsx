import { FaGithub } from "react-icons/fa";

export const BLUR_FADE_DELAY = 0.15;

export const siteConfig = {
  name: "Mahzen",
  description:
    "Mahzen is a free, open-source desktop app for managing files across Amazon S3, Cloudflare R2, DigitalOcean Spaces, MinIO, and any S3-compatible storage — all from one place.",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://mahzen.dev",
  keywords: [
    "S3 storage manager",
    "S3 desktop client",
    "object storage browser",
    "S3 file manager",
    "Cloudflare R2 client",
    "MinIO desktop app",
    "DigitalOcean Spaces manager",
    "Hetzner object storage",
    "open source S3 client",
    "Tauri desktop app",
    "S3 compatible storage",
    "free S3 manager",
    "cloud storage desktop app",
    "bucket browser",
    "macOS S3 client",
    "Windows S3 client",
    "Linux S3 client",
  ],
  links: {
    email: "hello@mahzen.dev",
    github: "https://github.com/dotyigit/mahzen",
    company: "https://farcale.com",
  },
  header: [
    {
      href: "#features",
      label: "Features",
    },
    {
      href: "https://github.com/dotyigit/mahzen/releases",
      label: "Download",
    },
  ],
  faqs: [
    {
      question: "What is Mahzen?",
      answer: (
        <span>
          Mahzen is a free, open-source desktop application for managing your S3
          and S3-compatible object storage. It lets you browse, upload, download,
          and organize files across multiple storage providers from a single app.
        </span>
      ),
    },
    {
      question: "Which storage providers does Mahzen support?",
      answer: (
        <span>
          Mahzen works with any S3-compatible storage provider including Amazon
          S3, Cloudflare R2, DigitalOcean Spaces, MinIO, Hetzner Object Storage,
          and more. If it speaks the S3 protocol, Mahzen can connect to it.
        </span>
      ),
    },
    {
      question: "Is Mahzen really free?",
      answer: (
        <span>
          Yes, Mahzen is completely free and open source. There are no paid
          tiers, no subscriptions, and no usage limits. You can view the full
          source code on GitHub.
        </span>
      ),
    },
    {
      question: "What platforms does Mahzen run on?",
      answer: (
        <span>
          Mahzen is available for macOS, Windows, and Linux. Built with Tauri, it
          runs natively on all three platforms with a small footprint and fast
          performance.
        </span>
      ),
    },
    {
      question: "Is my data safe with Mahzen?",
      answer: (
        <span>
          Mahzen stores your credentials locally on your machine in a SQLite
          database. Your data never passes through any external servers — all
          connections go directly from your desktop to your storage provider.
        </span>
      ),
    },
  ],
  footer: [
    {
      title: "Product",
      links: [
        { href: "#features", text: "Features", icon: null },
        {
          href: "https://github.com/dotyigit/mahzen/releases",
          text: "Download",
          icon: null,
        },
        {
          href: "https://github.com/dotyigit/mahzen",
          text: "Source Code",
          icon: null,
        },
      ],
    },
    {
      title: "Resources",
      links: [
        {
          href: "https://github.com/dotyigit/mahzen/issues",
          text: "Report a Bug",
          icon: null,
        },
        {
          href: "https://github.com/dotyigit/mahzen/discussions",
          text: "Discussions",
          icon: null,
        },
      ],
    },
    {
      title: "Social",
      links: [
        {
          href: "https://github.com/dotyigit/mahzen",
          text: "GitHub",
          icon: <FaGithub />,
        },
        {
          href: "https://farcale.com",
          text: "Farcale",
          icon: null,
        },
      ],
    },
  ],
};

export type SiteConfig = typeof siteConfig;
