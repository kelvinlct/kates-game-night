import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import "./globals.css"

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-plus-jakarta",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
})

export const metadata: Metadata = {
  title: "Kate's Game Night",
  description: "Join Kate's board game night.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  )
}
