import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";

const outfit = Outfit({ 
  subsets: ["latin"], 
  variable: "--font-outfit",
  display: "swap",
});

export const metadata = {
  title: "Idol Tracker - K-Pop Comeback Calendar",
  description: "Track the latest K-Pop idol comebacks, album releases, and music videos.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
