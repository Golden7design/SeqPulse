"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Image from "next/image"

gsap.registerPlugin(ScrollTrigger)

export default function LogoSection() {

  const Vercel = "/logos-tech/vercel-svgrepo-com.svg"
  const Nodejs = "/logos-tech/node.svg"
  const Railway = "/logos-tech/railway.svg" 
  const Laravel = "/logos-tech/laravel@logotyp.us.svg"
  const Python = "/logos-tech/python-logo-generic.svg"
  const Render = "/logos-tech/render.svg"
  const Jenkins = "/logos-tech/jenkins.svg"
  const circleCI = "/logos-tech/circleci-circle-internet-services-inc-vector-logo.svg"
  const gitlab = "/logos-tech/gitlab-logo-300-rgb.svg"
  const Github = "/logos-tech/github.svg"
  const Java = "/logos-tech/java-svgrepo-com.svg"
  const Golang = "/logos-tech/Go-Logo_Black.svg"
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!sectionRef.current) return

      // Parallax the entire section upward so it overtakes the hero
      gsap.fromTo(
        sectionRef.current,
        { y: 0 },
        {
          y: -800, // faster than natural scroll to pass over hero
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      )
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={sectionRef}
      className="relative bg-[#fdfdfd] h-125 z-50 flex flex-col w-full items-center justify-center pt-24 overflow-visible will-change-transform"
    >
        <div>
          <h1 className="font-display text-5xl text-center text-[#121317] font-medium " >Works with your stack</h1>
          <p className="text-lg text-center text-(--seqpulse-slowblack) mt-4" >Seqpulse integrates easily into your environment</p>
        </div>

        <div className="flex flex-col mt-15 gap-12 " >

          <div className="flex items-center justify-center overflow-hidden" >
            <Image src={Vercel} alt="Vercel Logo" width={200} height={100} className="mx-4 border-b pb-2 " />
            <Image src={Nodejs} alt="Node.js Logo" width={200} height={100} className="mx-4 border-b pb-2 " />
            <Image src={Railway} alt="Railway Logo" width={200} height={100} className="mx-4 border-b pb-2 " />
            <Image src={Laravel} alt="Laravel Logo" width={200} height={100} className="mx-4 border-b pb-2 " />
            <Image src={Python} alt="Python Logo" width={200} height={100} className="mx-4 border-b pb-2 " />
            <Image src={Render} alt="Render Logo" width={200} height={100} className="mx-4 border-b pb-2 " />
          </div>
          <div className="flex items-center justify-center overflow-hidden" >
            <Image src={Jenkins} alt="Jenkins Logo" width={200} height={100} className="mx-4 border-b pb-2 " />
            <Image src={circleCI} alt="CircleCI Logo" width={200} height={100} className="mx-4 border-b pb-2 " />
            <Image src={gitlab} alt="GitLab Logo" width={200} height={100} className="mx-4 border-b pb-2 "  />
            <Image src={Github} alt="GitHub Logo" width={200} height={100} className="mx-4 border-b pb-2 " />
            <Image src={Java} alt="Java Logo" width={200} height={100} className="mx-4 border-b pb-2 " />
            <Image src={Golang} alt="Go Logo" width={200} height={100} className="mx-4 border-b pb-2 "  />
            
          </div>   

          <p className="text-(--seqpulse-slowblack) text-center" >
            and more..</p>       

        </div>
        
        
    </div>
  )
}
