import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/Theme-Provider";
import { Toaster } from "@/components/ui/sonner";

const googleSansFlex = localFont({
  src: "../public/font/google-sans-flex/GoogleSansFlex-VariableFont_GRAD,ROND,opsz,slnt,wdth,wght.ttf",
  display: "swap",
  variable: "--font-google-sans-flex",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Seqpulse",
  description: "The ultimate CI/CD deployment dashboard",
};

const EXTENSION_ATTR_SANITIZER = `
(() => {
  const blockedAttrs = ["bis_skin_checked", "data-new-gr-c-s-check-loaded", "data-gr-ext-installed"];

  const stripAttrs = (root) => {
    if (!root || !("querySelectorAll" in root)) return;
    for (const attr of blockedAttrs) {
      const nodes = root.querySelectorAll(\`[\${attr}]\`);
      for (const node of nodes) {
        node.removeAttribute(attr);
      }
    }
  };

  stripAttrs(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName &&
        blockedAttrs.includes(mutation.attributeName) &&
        mutation.target instanceof Element
      ) {
        mutation.target.removeAttribute(mutation.attributeName);
      }

      for (const node of mutation.addedNodes) {
        if (node instanceof Element) stripAttrs(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: blockedAttrs,
  });

  window.addEventListener(
    "load",
    () => {
      window.setTimeout(() => observer.disconnect(), 5000);
    },
    { once: true }
  );
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning
        className={`${googleSansFlex.variable} ${geistMono.variable} antialiased`}
       >
          <Script id="extension-attr-sanitizer" strategy="beforeInteractive">
            {EXTENSION_ATTR_SANITIZER}
          </Script>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
      </body>
    </html>
  );
}
