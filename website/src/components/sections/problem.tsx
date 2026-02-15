import BlurFade from "@/components/magicui/blur-fade";
import Section from "@/components/section";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Layout, MonitorX } from "lucide-react";

const problems = [
  {
    title: "Scattered Storage",
    description:
      "Your files are spread across multiple cloud providers — AWS, Cloudflare, DigitalOcean — each with its own dashboard, login, and workflow.",
    icon: Globe,
  },
  {
    title: "Clunky Web UIs",
    description:
      "Web-based consoles are slow, cluttered, and painful for everyday file management. Uploading, downloading, and browsing shouldn't feel like a chore.",
    icon: MonitorX,
  },
  {
    title: "No Unified View",
    description:
      "There's no single place to see all your buckets and objects side by side. You're constantly switching tabs and losing context.",
    icon: Layout,
  },
];

export default function Component() {
  return (
    <Section
      title="Problem"
      subtitle="Managing cloud storage shouldn't be this painful."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
        {problems.map((problem, index) => (
          <BlurFade key={index} delay={0.2 + index * 0.2} inView>
            <Card className="bg-background border-none shadow-none">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <problem.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{problem.title}</h3>
                <p className="text-muted-foreground">{problem.description}</p>
              </CardContent>
            </Card>
          </BlurFade>
        ))}
      </div>
    </Section>
  );
}
