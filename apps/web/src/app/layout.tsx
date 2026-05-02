import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { ReactNode } from "react";
import Providers from "./providers";
import "../styles/globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Datadog Clone",
  description: "Datadog clone template",
  icons: {
    icon: "/images/favicon.ico",
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={notoSans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
