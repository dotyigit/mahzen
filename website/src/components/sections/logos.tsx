import Marquee from "@/components/magicui/marquee";

const providers = [
  {
    name: "Amazon S3",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.34 7.5 12 10.82 4.66 7.5 12 4.18zM4 8.64l7 3.5V19.5l-7-3.5V8.64zm10 10.86v-7.36l7-3.5V15.5l-7 3.5z" />
      </svg>
    ),
  },
  {
    name: "Cloudflare R2",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M16.5 12c0-2.5-2-4.5-4.5-4.5S7.5 9.5 7.5 12s2 4.5 4.5 4.5 4.5-2 4.5-4.5zm-4.5 3c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zM12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      </svg>
    ),
  },
  {
    name: "DigitalOcean Spaces",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.82 0 3.53-.49 5-1.35V17.5h-5v-3h5v-1c0-2.76-2.24-5-5-5-2.76 0-5 2.24-5 5H4c0-4.42 3.58-8 8-8s8 3.58 8 8h-3c0-2.76-2.24-5-5-5z" />
      </svg>
    ),
  },
  {
    name: "MinIO",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
      </svg>
    ),
  },
  {
    name: "Hetzner",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M4 4h6v7H4V4zm0 9h6v7H4v-7zm10-9h6v7h-6V4zm0 9h6v7h-6v-7z" />
      </svg>
    ),
  },
];

export default function Logos() {
  return (
    <section id="logos">
      <div className="container mx-auto px-4 md:px-8 py-12">
        <h3 className="text-center text-sm font-semibold text-gray-500">
          WORKS WITH ANY S3-COMPATIBLE PROVIDER
        </h3>
        <div className="relative mt-6">
          <Marquee className="max-w-full [--duration:40s]">
            {providers.map((provider, idx) => (
              <div
                key={idx}
                className="mx-8 flex items-center gap-2 text-muted-foreground/40 select-none"
              >
                <span className="opacity-40">{provider.icon}</span>
                <span className="text-xl font-semibold">{provider.name}</span>
              </div>
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 h-full w-1/3 bg-gradient-to-r from-background"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/3 bg-gradient-to-l from-background"></div>
        </div>
      </div>
    </section>
  );
}
