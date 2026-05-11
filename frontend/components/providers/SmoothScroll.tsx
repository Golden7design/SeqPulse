"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  children: React.ReactNode;
};

const SmoothScrollProvider = ({ children }: Props) => {
  const lenisRef = useRef<Lenis | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickingRef = useRef(false);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
    });

    lenisRef.current = lenis;

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        ScrollTrigger.update();
        tickingRef.current = false;
      });
    };

    lenis.on("scroll", onScroll);

    const raf = (time: number) => {
      lenis.raf(time);
      rafRef.current = requestAnimationFrame(raf);
    };

    rafRef.current = requestAnimationFrame(raf);

    return () => {
      lenis.off("scroll", onScroll);
      lenis.destroy();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <>{children}</>;
};

export default SmoothScrollProvider;
