import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300","400","500","600","700","800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EyeCare Pro — Eye Health Management Platform",
  description: "Multi-tenant eye health management platform for campaigns, patients, surgeries and outcomes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${font.variable} h-full`}>
      <body className="font-sans antialiased h-full bg-slate-50 text-slate-800">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
