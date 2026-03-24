"use client";

import { SeqPulseLogoMark } from "@/components/seqpulse-logo-mark";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ctasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!heroRef.current || !titleRef.current) return;

      gsap.to(
        titleRef.current,
        {
          y: -110,
          ease: "none",
          scrollTrigger: {
            trigger: heroRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  // CTA hover swap (two stacked spans per link)
  useEffect(() => {
    const ctx = gsap.context(() => {
      const links = gsap.utils.toArray<HTMLAnchorElement>("[data-hero-link]");
      const cleanups: (() => void)[] = [];

      links.forEach((el) => {
        const primary = el.querySelector<HTMLElement>("[data-hero-text='primary']");
        const alt = el.querySelector<HTMLElement>("[data-hero-text='alt']");
        if (!primary || !alt) return;

        gsap.set(primary, { yPercent: 0 });
        gsap.set(alt, { yPercent: -110 });

        const onEnter = () =>
          gsap
            .timeline({ defaults: { duration: 0.35, ease: "power2.out" } })
            .to(primary, { yPercent: 110 })
            .to(alt, { yPercent: 0 }, "<");

        const onLeave = () =>
          gsap
            .timeline({ defaults: { duration: 0.35, ease: "power2.out" } })
            .to(primary, { yPercent: 0 })
            .to(alt, { yPercent: -110 }, "<");

        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("focus", onEnter);
        el.addEventListener("mouseleave", onLeave);
        el.addEventListener("blur", onLeave);

        cleanups.push(() => {
          el.removeEventListener("mouseenter", onEnter);
          el.removeEventListener("focus", onEnter);
          el.removeEventListener("mouseleave", onLeave);
          el.removeEventListener("blur", onLeave);
        });
      });

      return () => cleanups.forEach((fn) => fn());
    }, ctasRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={heroRef}
      className="relative isolate z-30 flex h-screen w-full flex-col items-center justify-center overflow-hidden"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover object-center motion-reduce:hidden"
        src="/assets/hero-video.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />

      <div
            ref={titleRef}
             className="relative z-10 flex flex-col items-center justify-center h-full w-full">
        <div className="flex justify-center items-center gap-1 mb-12 mix-blend-difference " >
        <SeqPulseLogoMark className="h-9 w-9 text-(--seqpulse-black)" />
        <span className="text-md font-display font-semibold text-(--seqpulse-black) leading-none">Seqpulse</span>

        </div>
        <div className="flex flex-col gap-5 mb-8 " >
          <h1
            className="font-display text-6xl text-center text-[#121317]"
          >
            Your CI says "Success" ?
          </h1>
          <h1 className="font-display text-6xl text-center text-[#121317]" >Seqpulse tells you if your deployment is <br /> truly safe.</h1>
        </div>

        <p className="text-lg text-center text-(--seqpulse-slowblack) mb-16" >
          After each release, Seqpulse analyzes critical signals (errors, latency, CPU, memory, traffic) <br /> and returns a substantiated verdict: &nbsp; 
          <strong>OK</strong>, <strong>Warning</strong>, or <strong>Rollback Recommended</strong>.
        </p>
        <div
          ref={ctasRef}
          className="hidden items-center gap-12 sm:flex"
        >
          <Link
            href="/signup"
            className="rounded-[2px] bg-(--seqpulse-black) font-mono px-4 py-2 text-[17px] font-semibold text-white transition-transform hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
            data-hero-link
          >
            <span className="relative block overflow-hidden leading-none">
              <span data-hero-text="primary" className="block">
                TRY IT FOR FREE
              </span>
              <span
                data-hero-text="alt"
                aria-hidden
                className="block absolute inset-0"
              >
                TRY IT FOR FREE
              </span>
            </span>
          </Link>
          <Link
            href="/signin"
            className="rounded-[2px] border border-(--seqpulse-border) bg-(--seqpulse-white) backdrop-blur-md px-4 py-2 text-[17px] font-mono font-medium text-(--nav-link-color) shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-neutral-50"
            data-hero-link
          >
            <span className="relative block overflow-hidden leading-none">
              <span data-hero-text="primary" className="block">
                SEE A REAL VERDICT
              </span>
              <span
                data-hero-text="alt"
                aria-hidden
                className="block absolute inset-0"
              >
                SEE A REAL VERDICT
              </span>
            </span>
          </Link>
        </div>

      </div>
    </div>
  )
}
