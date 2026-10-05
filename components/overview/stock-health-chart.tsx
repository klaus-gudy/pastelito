"use client"

import { Label, Pie, PieChart } from "recharts"

import { statusStyles } from "@/components/health/status"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCount } from "@/lib/format"

// Stock states use the shared status colours and icons.
const config = {
  inStock: { ...statusStyles.good, label: "In stock" },
  low: { ...statusStyles.watch, label: "Running low" },
  out: { ...statusStyles.action, label: "Out of stock" },
} satisfies ChartConfig

type State = keyof typeof config

/** How many products are in stock, running low or out, as a donut. */
export function StockHealthChart({
  counts,
}: {
  counts: Record<State, number>
}) {
  const total = counts.inStock + counts.low + counts.out
  const data = (Object.keys(config) as State[])
    .map((state) => ({ state, products: counts[state], fill: `var(--color-${state})` }))
    // Empty slices would still draw a sliver of padding.
    .filter((slice) => slice.products > 0)

  return (
    <div className="flex flex-wrap items-center gap-6">
      <ChartContainer config={config} className="aspect-square h-36">
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="state" />}
          />
          <Pie
            data={data}
            dataKey="products"
            nameKey="state"
            innerRadius={44}
            outerRadius={64}
            paddingAngle={data.length > 1 ? 2 : 0}
            // A 2px surface gap between slices; none around a lone slice.
            stroke="var(--card)"
            strokeWidth={data.length > 1 ? 2 : 0}
          >
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox)) return null
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-2xl font-semibold"
                    >
                      {formatCount(total)}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 18}
                      className="fill-muted-foreground text-xs"
                    >
                      products
                    </tspan>
                  </text>
                )
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="grid gap-2 text-sm">
        {(Object.keys(config) as State[]).map((state) => {
          const { label, color, icon: Icon } = config[state]
          return (
            <li key={state} className="flex items-center gap-2">
              <Icon className="size-4" style={{ color }} aria-hidden />
              <span>{label}</span>
              <span className="ml-auto pl-4 font-medium tabular-nums">
                {formatCount(counts[state])}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
