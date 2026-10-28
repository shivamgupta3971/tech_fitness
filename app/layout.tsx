import type { Metadata } from "next";
import { Audiowide, Chakra_Petch } from "next/font/google";
import "./globals.css";
import AppNavigation from "./components/AppNavigation";

const audiowide = Audiowide({
  weight: "400",
  variable: "--font-audiowide",
  subsets: ["latin"],
});

const chakraPetch = Chakra_Petch({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-chakra-petch",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FITVEDA - AI Fitness & Diet Arena",
  description: "Real-time pose tracking, AI Diet Planner, and AI Exercise Planner with intelligent coaching",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${audiowide.variable} ${chakraPetch.variable} antialiased flex flex-col min-h-screen bg-[#050508]`}
      >
        <AppNavigation />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
