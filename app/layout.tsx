import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "DAS Health",
  description: "Regional eye-care campaign management for Direct Aid Somalia.",
  icons: {
    icon: "/brand/das-health-icon.png",
    shortcut: "/brand/das-health-icon.png",
    apple: "/brand/das-health-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-background font-sans text-foreground antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
