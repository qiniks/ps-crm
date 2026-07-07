import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { Sidebar } from "@/components/Sidebar";
import { QueryProvider } from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "PS Club CRM",
  description: "Gaming club management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <QueryProvider>
          <LanguageProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto p-8">{children}</main>
            </div>
          </LanguageProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
