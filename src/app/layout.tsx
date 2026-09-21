import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import YouTubeAutoSync from "@/components/YouTubeAutoSync";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "CMS — Campus Movie Series",
  description: "Create. Inspire. Connect.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CMS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-black text-white">
        <AuthProvider>
          <YouTubeAutoSync />
          <div className="max-w-[430px] mx-auto min-h-[100dvh] relative bg-black">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
