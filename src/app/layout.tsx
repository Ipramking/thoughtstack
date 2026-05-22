import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import { SessionWrapper } from "@/components/layout/SessionWrapper";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#0d0d0d" },
    { media: "(prefers-color-scheme: light)", color: "#f9f9f9" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Shrinks the visual viewport when the soft keyboard appears,
  // so fixed/absolute positioned elements (ThoughtsPanel input) stay visible
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

export const metadata: Metadata = {
  title: "ThoughtStack — Your Personal OS",
  description: "An AI-powered personal operating system for productivity, learning, and growth.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ThoughtStack",
  },
  icons: {
    icon: "/icon",
    apple: "/icon",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <SessionWrapper>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <AppShell>{children}</AppShell>
            <Toaster />
            <ServiceWorkerRegister />
          </ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
