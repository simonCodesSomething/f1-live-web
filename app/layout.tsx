import type { Metadata } from "next";
import "./globals.css";
import AppNavigation from "./components/AppNavigation";

export const metadata: Metadata = {
  title: "F1 LIVE",
  description: "Live Formula 1 timing and schedule",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppNavigation />

        <main className="app-content">
          {children}
        </main>
      </body>
    </html>
  );
}

