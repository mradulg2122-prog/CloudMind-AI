import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloudMind AI – Autonomous Cloud Cost Intelligence Platform",
  description: "Real-time workload forecasting and autonomous cloud cost intelligence powered by ML.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
