import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: {
    default: "Amex Rewards Optimizer",
    template: "%s | Amex Rewards Optimizer",
  },
  description: "Track and maximize your Amex Platinum benefits, Amex Offers, and rewards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Nav />
        <BottomNav />
        <div className="pb-16 md:pb-0">
          {children}
        </div>
      </body>
    </html>
  );
}
