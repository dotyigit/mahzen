import Features from "@/components/features-vertical";
import Section from "@/components/section";
import { FolderOpen, HardDrive, RefreshCw } from "lucide-react";

const data = [
  {
    id: 1,
    title: "1. Add Your Storage",
    content:
      "Connect any S3-compatible provider — Amazon S3, Cloudflare R2, DigitalOcean Spaces, MinIO, or others. Just enter your credentials and you're in.",
    image: "/add-target.png",
    icon: <HardDrive className="w-6 h-6 text-primary" />,
  },
  {
    id: 2,
    title: "2. Browse & Manage",
    content:
      "Navigate your buckets and objects with a fast, native file browser. Create folders, preview files, and manage your storage without touching a web console.",
    image: "/dashboard.png",
    icon: <FolderOpen className="w-6 h-6 text-primary" />,
  },
  {
    id: 3,
    title: "3. Transfer & Sync",
    content:
      "Upload and download files with a built-in transfer queue. Track progress in real time and set up sync profiles to keep local and remote directories in sync.",
    image: "/transfers.png",
    icon: <RefreshCw className="w-6 h-6 text-primary" />,
  },
];

export default function Component() {
  return (
    <Section title="How it works" subtitle="Just 3 steps to get started">
      <Features data={data} />
    </Section>
  );
}
