import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/lib/toast";

export const metadata: Metadata = {
  title: "CloudMind AI – Enterprise Cloud Intelligence",
  description: "Autonomous cloud cost optimization powered by ML — real-time workload prediction and intelligent scaling.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
