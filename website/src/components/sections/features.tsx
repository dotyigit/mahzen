import Features from "@/components/features-horizontal";
import Section from "@/components/section";
import { FolderSync, HardDrive, Search, Upload } from "lucide-react";

const data = [
  {
    id: 1,
    title: "Multi-Provider Support",
    content: "Connect to AWS, R2, Spaces, MinIO, and any S3-compatible service.",
    image: "/targets.png",
    icon: <HardDrive className="h-6 w-6 text-primary" />,
  },
  {
    id: 2,
    title: "Smart File Browser",
    content: "Navigate buckets and folders with a fast, native tree view.",
    image: "/dashboard.png",
    icon: <Search className="h-6 w-6 text-primary" />,
  },
  {
    id: 3,
    title: "Transfer Queue",
    content: "Upload and download files with progress tracking and retries.",
    image: "/transfers.png",
    icon: <Upload className="h-6 w-6 text-primary" />,
  },
  {
    id: 4,
    title: "Sync Profiles",
    content: "Keep local and remote directories in sync automatically.",
    image: "/add-target.png",
    icon: <FolderSync className="h-6 w-6 text-primary" />,
  },
];

export default function Component() {
  return (
    <Section
      id="features"
      title="Features"
      subtitle="Everything You Need to Manage Object Storage"
    >
      <Features collapseDelay={5000} linePosition="bottom" data={data} />
    </Section>
  );
}
