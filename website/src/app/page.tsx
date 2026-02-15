import CTA from "@/components/sections/cta";
import FAQ from "@/components/sections/faq";
import Features from "@/components/sections/features";
import Footer from "@/components/sections/footer";
import Header from "@/components/sections/header";
import Hero from "@/components/sections/hero";
import HowItWorks from "@/components/sections/how-it-works";
import Logos from "@/components/sections/logos";
import Problem from "@/components/sections/problem";
import Solution from "@/components/sections/solution";
import { siteConfig } from "@/lib/config";

function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Mahzen",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "macOS, Windows, Linux",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: siteConfig.description,
    url: siteConfig.url,
    downloadUrl: "https://github.com/dotyigit/mahzen/releases",
    softwareVersion: "latest",
    author: {
      "@type": "Organization",
      name: "Farcale",
      url: "https://farcale.com",
    },
    license: "https://github.com/dotyigit/mahzen/blob/main/LICENSE",
    screenshot: `${siteConfig.url}/dashboard.png`,
    featureList:
      "Multi-provider S3 support, File browser, Transfer queue, Sync profiles, Drag and drop uploads, Native desktop performance",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

function FaqJsonLd() {
  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: siteConfig.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text:
          typeof faq.answer === "object"
            ? (faq.answer as any).props?.children || ""
            : String(faq.answer),
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
    />
  );
}

export default function Home() {
  return (
    <main>
      <JsonLd />
      <FaqJsonLd />
      <Header />
      <Hero />
      <Logos />
      <Problem />
      <Solution />
      <HowItWorks />
      <Features />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
