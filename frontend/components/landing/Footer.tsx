import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SeqPulseLogoMark } from "../seqpulse-logo-mark";




    const palette = {
  logo: "#000000",
  link: "#45474D",
  ctaBackground: "#121317",
  signInBackground: "#FFFFFF",
  border: "#D1D5DB",
}

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
]

export default function Footer() {


  const colorVars = React.useMemo(
    () => ({
      "--nav-logo-color": palette.logo,
      "--nav-link-color": palette.link,
      "--nav-cta-bg": palette.ctaBackground,
      "--nav-signin-bg": palette.signInBackground,
      "--nav-border-color": palette.border,
    } as React.CSSProperties),
    []
  )
  return (
    <div className="flex flex-col items-center justify-center h-screen" >

        <div className="flex items-start justify-between w-full mb-15 mt-18 px-12 " >
            <div className="flex flex-col gap-4 " >
                <div className="border-b-2 border-(--seqpulse-slowblack) border-dashed " >
                    EXPLORE
                </div>
                <div className="flex gap-1.5 flex-col" >
                {navLinks.map((link) => (
                <Link
                key={link.href}
                href={link.href}
                className={cn(
                    "transition-colors",
                    "text-(--seqpulse-slowblack) hover:text-(--nav-logo-color)"
                )}
                data-nav-link
                >
                <span className="relative block overflow-hidden leading-[1.1]">
                    <span data-nav-text="primary" className="block">
                    {link.label}
                    </span>
                    <span
                    data-nav-text="alt"
                    aria-hidden
                    className="block absolute inset-0"
                    >
                    {link.label}
                    </span>
                </span>
                </Link>
            ))}
                </div>


            </div>
            <div className="flex flex-col gap-4 " >
                <div className="border-b-2 border-(--seqpulse-slowblack) border-dashed " >
                    SUPPORT
                </div>
                <div className="flex text-sm gap-1.5 text-(--seqpulse-slowblack) flex-col" >
                    SUPPORT@SEQPULSE.IO
                </div>


            </div>
            <div className="flex flex-col gap-4 " >
                <div className="border-b-2 border-(--seqpulse-slowblack) border-dashed " >
                    LEGAL
                </div>

                <div className="flex flex-col gap-1.5 " >
                <div className="text-sm text-(--seqpulse-slowblack) " >
                    TERMS OF SERVICE
                </div>
                <div className="text-sm text-(--seqpulse-slowblack) " >
                    PRIVACY POLICY
                </div>

                </div>
                </div>
            <div className="flex flex-col gap-4" >
                <div className="border-b-2 border-(--seqpulse-slowblack) border-dashed " >
                    NEWSLETTER
                </div>
                <div className="flex gap-1" >
                <input type="email" placeholder="Email address" className="outline-none font-display border py-1 pl-2 pr-20 text-left" />
                <button className="bg-(--seqpulse-black) text-white px-4 py-2 rounded-[2px]"  >Submit</button>
                </div>
                <p className="text-(--seqpulse-slowblack) " >
                    join our newsletter and stay updated on the latest trends in seqpulse
                </p>

            </div>
        </div>

        <div className="flex w-full justify-center items-center mb-15 " >
            <SeqPulseLogoMark className="h-90 w-90 text-(--seqpulse-black)" />
            <span className="text-[22rem] relative -left-5 font-display text-(--seqpulse-black) leading-none">eqpulse</span>
            </div>

            <div className="flex w-full  justify-between px-10 text-sm text-(--seqpulse-slowblack)  " >
                <p>
                    &copy; {new Date().getFullYear()} Seqpulse. All rights reserved.
                </p>

                <p>
                    Designed and developed by Nassir.
                </p>
            </div>


        
    </div>
  );
}