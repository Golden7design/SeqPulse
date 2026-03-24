import Footer from "@/components/landing/Footer";
import Hero from "@/components/landing/hero";
import LogoSection from "@/components/landing/LogoSection";
import { Navbar } from "@/components/landing/navbar"
import Problem from "@/components/landing/Problem";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fdfdfd]">
      <Navbar />
      {/* TODO: add hero/content sections below */}
      <Hero />
      <LogoSection />
      <Problem />
      <Footer />
    </main>
  );
}
