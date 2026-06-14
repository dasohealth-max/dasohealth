import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "DASO Health",
  description: "Regional eye-care campaign management for Direct Aid Somalia.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#FAFAF8] font-sans text-[#1C2B22] antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
