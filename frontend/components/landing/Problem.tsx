import React from 'react'

const Problem = () => {
  return (
    <div className='relative z-50 flex flex-col w-full min-h-screen overflow-visible' >
        <h1 className='text-4xl text-seqpulse-black pl-18 font-display ' >A "successful" deployment does not <br /> mean "stable production".</h1>
        <p className='text-2xl text-seqpulse-slowblack pl-18 mt-5' >After a deployment, the team often does the same thing:</p>

        <div className='flex flex-col gap-10 mt-25 mx-18' >
            <div className='flex justify-between items-center px-5' >
              <div>
                <h2 className='text-3xl text-seqpulse-black font-display' >Too many dashboards.</h2>
                <p className='text-seqpulse-slowblack text-xl ' >You check multiple tools to understand what’s happening</p>

              </div>
      <video
        className="relative inset-0 h-120 w-180 rounded-lg object-cover object-center motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src="/assets/PipelineSuccess.webm" type="video/webm" />
        <source src="/assets/PipelineSuccess.mp4" type="video/mp4" />
      </video>

            </div>
            <div className='flex justify-between items-center px-5' >
              <div>
                <h2 className='text-3xl text-seqpulse-black font-display' >Slow analysis.</h2>
                <p className='text-seqpulse-slowblack text-xl ' >I spend too much time trying to understand</p>

              </div>
      <video
        className="relative inset-0 h-120 w-180 rounded-lg object-cover object-center motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src="/assets/SlowAnalyse.webm" type="video/webm" />
        <source src="/assets/SlowAnalyse.mp4" type="video/mp4" />
      </video>

            </div>
            <div className='flex justify-between items-center px-5' >
              <div>
                <h2 className='text-3xl text-seqpulse-black font-display' >Team hesitation</h2>
                <p className='text-seqpulse-slowblack text-xl ' >Nobody knows what to do</p>

              </div>
      <video
        className="relative inset-0 h-120 w-180 rounded-lg object-cover object-center motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src="/assets/Debate.webm" type="video/webm" />
        <source src="/assets/Debate.mp4" type="video/mp4" />
      </video>

            </div>
        </div>

        <p className='text-3xl font-display text-seqpulse-black pl-18 mt-25' >SeqPulse replaces 20 minutes of uncertainty with <br /> a verdict in a few minutes.</p>
    </div>
  )
}

export default Problem
