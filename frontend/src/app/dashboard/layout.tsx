import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/Topbar";
import { ThemeProvider } from "@/components/theme-provider";


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <Sidebar />

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 p-6">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          
          {children}
          </ThemeProvider>
          </main>
      </div>
    </div>
  );
}
