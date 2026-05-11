import React from 'react'

const HowItWork2 = () => {
  return (
      <div className="relative z-30 px-18 mt-20 pt-12 pb-6">
        <div>
        <h2 className="font-display font-medium text-3xl text-seqpulse-black">2- SeqPulse analyzes your deployment in real conditions</h2>
        <p className="mt-2 text-xl text-seqpulse-slowblack">After each pipeline, SeqPulse  <span className='font-bold' >collects key signals</span> over time and <span className='font-bold' >analyzes</span> how they change in the minutes that follow.</p>
        <p className="mt-1 text-xl text-seqpulse-slowblack">This helps detect regressions early, before they turn into real incidents.</p>

        </div>

        <div className='mt-15'>
        <h2 className="font-display font-medium text-3xl text-seqpulse-black">3- Get a clear decision after every deploy</h2>
        <p className="mt-2 text-xl text-seqpulse-slowblack">Each deployment gets a simple, actionable verdict:</p>
        <p className="mt-1 text-xl text-seqpulse-slowblack"> <span className='font-bold' >OK</span>, <span className='font-bold' >Warning</span>, or <span className='font-bold' ><span translate="no"> Rollback </span> recommended</span>.</p>

        </div>
        
        
        </div>
  )
}

export default HowItWork2
