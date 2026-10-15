import { useId } from "react"

import { cn } from "@/lib/utils"

// The Pastelito perfume-bottle logo. Colours come from the --brand-* tokens
// in globals.css, so it switches to its ivory-and-gold form in dark mode.
export function BrandMark({ className }: { className?: string }) {
  // useId output can hold characters that url(#…) won't resolve.
  const gold = `brand-gold-${useId().replace(/[^\w-]/g, "")}`

  return (
    <svg
      viewBox="30 30 460 655"
      fill="none"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-gold)" />
          <stop offset="0.5" stopColor="var(--brand-gold-light)" />
          <stop offset="1" stopColor="var(--brand-gold-pale)" />
        </linearGradient>
      </defs>
      <g fill="var(--brand-gold)">
        <path d="M248 154C230 110 266 76 340 70C296 86 268 110 266 154Z" />
        <path d="M274 152C280 112 316 96 374 92C330 106 302 126 292 152Z" />
        <circle cx="378" cy="64" r="13" />
        <circle cx="425" cy="50" r="9" />
      </g>
      <rect x="213" y="175" width="99" height="88" rx="6" stroke="var(--brand-ink)" strokeWidth="13" />
      <circle cx="248" cy="211" r="8" fill="var(--brand-gold)" />
      <path d="M290 192V252" stroke="var(--brand-gold-light)" strokeWidth="11" strokeLinecap="round" />
      <path
        d="M157 600L110 326Q102 272 156 269L358 266Q416 268 409 324L370 600"
        stroke="var(--brand-ink)"
        strokeWidth="15"
        strokeLinejoin="round"
      />
      <path
        d="M144 318C144 430 158 522 204 550C236 568 272 562 294 552C262 548 234 544 214 530C176 500 162 430 154 320Z"
        fill="var(--brand-gold)"
      />
      <path
        d="M50 424C40 560 150 672 262 670C380 668 488 570 472 418C470 540 380 640 262 642C150 642 62 560 50 424Z"
        fill="var(--brand-ink)"
      />
      <path
        d="M56 428C70 545 160 612 262 612C365 612 455 545 468 416C470 540 390 642 262 642C140 642 62 555 56 428Z"
        fill={`url(#${gold})`}
      />
    </svg>
  )
}
