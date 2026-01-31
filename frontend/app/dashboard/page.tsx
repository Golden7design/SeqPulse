import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SectionCards } from "@/components/section-cards"
import { LatestSDH } from "@/components/latest-sdh"
import type { SDH } from "@/components/latest-sdh"

import sdhData from "./sdh-data.json"
import { DashboardHeader } from "@/components/dashboard-header"

const sdhDataTyped = sdhData as SDH[]

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <DashboardHeader />
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <div className="px-4 lg:px-6">
        <LatestSDH data={sdhDataTyped} />
      </div>
    </div>
  )
}