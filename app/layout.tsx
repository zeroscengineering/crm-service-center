import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const thai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
});

export const metadata: Metadata = {
  title: "CRM-SERVICE CENTER",
  description: "ระบบรับแจ้งซ่อมและติดตามสถานะเครื่องมือช่าง Milwaukee · Skil · Workpro",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={thai.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
