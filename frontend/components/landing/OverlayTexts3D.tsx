"use client";

import { CSSProperties, ReactNode } from "react";

type Step = {
  id: string;
  start: number;
  end: number;
  position: { top: string; left?: string; right?: string };
  content: ReactNode;
  className?: string;
  style?: CSSProperties;
};

const STEPS: Step[] = [
  {
    id: "hero",
    start: 0,
    end: 0.18,
    position: { top: "20%", left: "50%" },
    content: (
      <div className="flex flex-col items-center text-center leading-tight gap-1">
        <span className="text-3xl font-display text-seqpulse-black font-semibold leading-[1.05]">
          1- Add Seqpulse in 2 steps
        </span>
        <span className="text-xl font-flex text-seqpulse-slowblack leading-[1.15]">
          Integrates seamlessly with your existing CI/CD pipeline, no code changes needed.
        </span>
      </div>
    ),
    className: "max-w-[34rem] text-center",
    style: { transform: "translate(-50%, -50%)" },
  },
  {
    id: "trigger",
    start: 0.25,
    end: 0.35,
    position: { top: "18%", left: "10%" },
    content: (
      <div className="flex flex-col leading-tight gap-1">
        <span className="text-2xl font-flex text-seqpulse-black font-semibold leading-[1.1]">
          Capture before deployment
        </span>
        <span className="text-lg mt-1 font-flex text-seqpulse-slowblack leading-[1.2]">
          SeqPulse snapshots your app metrics before anything changes.
        </span>
        <span translate="no" className="text-xs mt-2 font-mono font-semibold text-gray-500 leading-[1.15]">
          npx seqpulse@0.5.2 trigger
        </span>
      </div>
    ),
    className: "max-w-[480px] text-left",
  },
  {
    id: "deploy",
    start: 0.40,
    end: 0.62,
    position: { top: "18%", left: "62%" },
    content: (
      <div className="flex flex-col leading-tight gap-1">
        <span className="text-2xl font-flex text-seqpulse-black font-semibold leading-[1.1]">
          Your pipeline runs as usual
        </span>
        <span className="text-lg mt-1 font-flex text-seqpulse-slowblack leading-[1.2]">
          No changes to your workflow. Deploy with your existing CI/CD.
        </span>
      </div>
    ),
    className: "max-w-[550px] text-left",
  },
  {
    id: "finish",
    start: 0.70,
    end: 1,
    position: { top: "18%", left: "8%" },
    content: (
      <div className="flex flex-col leading-tight gap-1">
        <span className="text-2xl font-flex text-seqpulse-black font-semibold leading-[1.1]">
          Start of analysis
        </span>
        <span className="text-lg mt-1 font-flex text-seqpulse-slowblack leading-[1.2]">
          SeqPulse starts analyzing your application to detect regressions and problems as soon as deployment is complete.
        </span>
        <span translate="no" className="text-xs mt-2 font-mono font-semibold text-gray-500 leading-[1.15]">
          npx seqpulse@0.5.2 finish
        </span>
      </div>
    ),
    className: "max-w-[480px] text-left",
  },
];

export default function OverlayTexts({ progress }: { progress: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 h-full w-full">
      {STEPS.map((step) => {
        const isVisible = progress >= step.start && progress <= step.end;
        return (
          <div
            key={step.id}
            style={{
              position: "absolute",
              top: step.position.top,
              left: step.position.left,
              right: step.position.right,
              opacity: isVisible ? 1 : 0,
              transform: isVisible
                ? "translateY(0px) scale(1)"
                : "translateY(10px) scale(0.99)",
              filter: isVisible ? "blur(0px)" : "blur(10px)",
              clipPath: isVisible
                ? "inset(0% 0% 0% 0%)"
                : "inset(0% 100% 0% 0%)", // wipe-in de gauche vers droite
              transition:
                "opacity 0.55s cubic-bezier(0.19, 1, 0.22, 1), transform 0.55s cubic-bezier(0.19, 1, 0.22, 1), filter 0.55s cubic-bezier(0.19, 1, 0.22, 1), clip-path 0.65s cubic-bezier(0.19, 1, 0.22, 1)",
              willChange: "opacity, transform, filter, clip-path",
              ...step.style,
            }}
            className={`${step.className ?? ""} flex-col`}
          >
            {step.content}
          </div>
        );
      })}
    </div>
  );
}
