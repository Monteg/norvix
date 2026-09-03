import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aurora",
  description: "Procedural northern lights and a gently animated starfield.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
