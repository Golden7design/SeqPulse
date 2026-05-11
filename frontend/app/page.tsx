import Cart from "@/components/landing/cart";
import Footer from "@/components/landing/Footer";
import Hero from "@/components/landing/hero";
import HowItWork from "@/components/landing/HowItWork";
import HowItWork2 from "@/components/landing/HowItWork2";
import LogoSection from "@/components/landing/LogoSection";
import { Navbar } from "@/components/landing/navbar"
import Problem from "@/components/landing/Problem";
import TestUnicorn from "@/components/landing/TestUnicorn";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fdfdfd]">
      <Navbar />
      {/* TODO: add hero/content sections below */}
      <Hero />
      <LogoSection />
      <Problem />
      <HowItWork />
      <HowItWork2 />
      <Footer />
    </main>
  );
}
