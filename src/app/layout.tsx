import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import { SessionWrapper } from "@/components/layout/SessionWrapper";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sora  = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["600", "700", "800"] });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#100e19" },
    { media: "(prefers-color-scheme: light)", color: "#fafafe" },
  ],
  width:           "device-width",
  initialScale:    1,
  // Allow zooming — disabling it is a WCAG accessibility violation.
  // iOS 15+ overrides user-scalable=no anyway; Android respects it and
  // we don't want to lock out users who need to zoom for low vision.
  maximumScale:    5,
  viewportFit:     "cover",
  interactiveWidget: "resizes-visual",
};

export const metadata: Metadata = {
  title:       "ThoughtStack",
  description: "Your AI-powered personal OS — tasks, journal, calendar, and a smart AI that knows your context.",
  manifest:    "/manifest.json",
  appleWebApp: {
    capable:         true,
    statusBarStyle:  "black-translucent",
    title:           "ThoughtStack",
  },
  icons: {
    icon:     [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple:    [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/icon-192.png",
  },
  other: {
    // iOS-specific meta tags
    "mobile-web-app-capable":         "yes",
    "apple-mobile-web-app-capable":   "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title":     "ThoughtStack",
    // MS tile
    "msapplication-TileColor":        "#100e19",
    "msapplication-tap-highlight":    "no",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Splash screens / touch startup image (iOS) */}
        <link rel="apple-touch-startup-image" href="/icon-512.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${inter.variable} ${sora.variable} font-sans antialiased`}>
        <SessionWrapper>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
            <AppShell>{children}</AppShell>
            <Toaster />
            <ServiceWorkerRegister />
          </ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
