import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EV Diagnostic System",
  description: "Sistema diagnostica universale auto elettriche",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
