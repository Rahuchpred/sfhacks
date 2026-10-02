import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gator Radar",
  description: "A live map of events and free food at SF State.",
};

export const viewport: Viewport = {
  themeColor: "#463077",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The sidebar remembers whether it was collapsed. Read here so it never animates on load.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <AuthProvider>
          <AppShell sidebarOpen={sidebarOpen}>{children}</AppShell>
        </AuthProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
