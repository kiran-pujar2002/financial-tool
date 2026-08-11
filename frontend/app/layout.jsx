// app/layout.jsx
import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Ledger AI",
  description: "AI Powered Quality of Earnings Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased transition-colors duration-200`}>
        <AuthProvider>
          <ThemeProvider>
            {children}
            <Toaster 
              position="top-right"
              toastOptions={{
                className: 'dark:bg-slate-800 dark:text-white',
              }}
            />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}