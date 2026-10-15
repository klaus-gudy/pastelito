"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Cinzel } from "next/font/google"
import { useEffect, useId, useState } from "react"

import { BrandGoldGradient, MARK_VIEW_BOX, markPaths } from "@/components/brand-mark"
import { Wordmark } from "@/components/wordmark"
import { cn } from "@/lib/utils"

// The serif capitals under the wordmark in the brand artwork.
const cinzel = Cinzel({ weight: "500", subsets: ["latin"] })

// How long the logo plays before the overlay fades away, in seconds.
const PLAY = 3.6
const REDUCED_PLAY = 1.2

type Curve = readonly [number, number, number, number]
const ease: Curve = [0.65, 0, 0.35, 1]
const easeOut: Curve = [0.22, 1, 0.36, 1]
const step = (delay: number, duration: number, curve: Curve = ease) => ({ delay, duration, ease: curve })
const popIn = (delay: number) => ({ delay, type: "spring" as const, stiffness: 420, damping: 14 })

// The Pastelito Scents logo drawing itself in over the page, then fading away
// to reveal it. Tapping anywhere skips it. Render it with the page on the
// server, so the page never shows first.
export function LogoIntro({ label }: { label: string }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(true)
  const id = useId().replace(/[^\w-]/g, "")

  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), (reduce ? REDUCED_PLAY : PLAY) * 1000)
    return () => clearTimeout(timer)
  }, [reduce])

  // With reduced motion, everything starts in its finished state.
  const from = <T,>(start: T, end: T) => (reduce ? end : start)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="intro"
          role="status"
          aria-label={label}
          onClick={() => setOpen(false)}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-background px-4"
        >
          <motion.div
            initial={{ scale: from(0.96, 1) }}
            animate={{ scale: 1 }}
            exit={{ scale: 1.04 }}
            transition={{ duration: reduce ? 0 : PLAY, ease: easeOut }}
            // Sizes also follow the screen height (svh), so a phone held
            // sideways still fits the whole logo.
            className="flex flex-col items-center gap-[min(1.5rem,3.5svh)]"
          >
            <svg viewBox={MARK_VIEW_BOX} fill="none" aria-hidden="true" className="h-[min(10rem,28svh)] w-auto sm:h-[min(12rem,30svh)]">
              <defs>
                <BrandGoldGradient id={`${id}-gold`} />
                <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#fff" stopOpacity="0.7" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                {/* Wipes that uncover the filled shapes. */}
                <clipPath id={`${id}-crescent`}>
                  <motion.rect
                    y="380"
                    height="320"
                    initial={{ attrX: from(262, 22), width: from(0, 480) }}
                    animate={{ attrX: 22, width: 480 }}
                    transition={step(0.75, 0.6)}
                  />
                </clipPath>
                <clipPath id={`${id}-highlight`}>
                  <motion.rect
                    x="130"
                    y="310"
                    width="180"
                    initial={{ height: from(0, 260) }}
                    animate={{ height: 260 }}
                    transition={step(1.0, 0.45)}
                  />
                </clipPath>
                <clipPath id={`${id}-mist`}>
                  <motion.rect
                    x="220"
                    width="170"
                    initial={{ attrY: from(156, 56), height: from(0, 100) }}
                    animate={{ attrY: 56, height: 100 }}
                    transition={step(1.25, 0.45, easeOut)}
                  />
                </clipPath>
                <clipPath id={`${id}-gold-shape`}>
                  <path d={markPaths.crescentGold} />
                </clipPath>
              </defs>

              <g clipPath={`url(#${id}-mist)`} fill="var(--brand-gold)">
                <path d={markPaths.mistLeft} />
                <path d={markPaths.mistRight} />
              </g>
              <motion.circle cx="378" cy="64" fill="var(--brand-gold)"
                initial={{ r: from(0, 13) }} animate={{ r: 13 }} transition={popIn(1.5)} />
              <motion.circle cx="425" cy="50" fill="var(--brand-gold)"
                initial={{ r: from(0, 9) }} animate={{ r: 9 }} transition={popIn(1.6)} />

              <motion.rect x="213" y="175" width="99" height="88" rx="6" stroke="var(--brand-ink)" strokeWidth="13"
                initial={{ pathLength: from(0, 1) }} animate={{ pathLength: 1 }} transition={step(0.1, 0.45)} />
              <motion.circle cx="248" cy="211" fill="var(--brand-gold)"
                initial={{ r: from(0, 8) }} animate={{ r: 8 }} transition={popIn(1.15)} />
              <motion.path d="M290 252V192" stroke="var(--brand-gold-light)" strokeWidth="11" strokeLinecap="round"
                initial={{ pathLength: from(0, 1) }} animate={{ pathLength: 1 }} transition={step(1.2, 0.3, easeOut)} />
              <motion.path d={markPaths.body} stroke="var(--brand-ink)" strokeWidth="15" strokeLinejoin="round"
                initial={{ pathLength: from(0, 1) }} animate={{ pathLength: 1 }} transition={step(0.25, 0.8)} />

              <path d={markPaths.highlight} fill="var(--brand-gold)" clipPath={`url(#${id}-highlight)`} />
              <g clipPath={`url(#${id}-crescent)`}>
                <path d={markPaths.crescentShadow} fill="var(--brand-ink)" />
                <path d={markPaths.crescentGold} fill={`url(#${id}-gold)`} />
              </g>
              {!reduce && (
                <g clipPath={`url(#${id}-gold-shape)`}>
                  <motion.rect y="380" width="160" height="300" fill={`url(#${id}-shine)`}
                    initial={{ attrX: -200 }} animate={{ attrX: 560 }} transition={step(2.6, 0.8)} />
                </g>
              )}
            </svg>

            {/* "Pastelito" writes itself in from left to right. */}
            <motion.div
              initial={{ clipPath: from("inset(0 100% 0 0)", "inset(0 0% 0 0)") }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={step(1.5, 0.9)}
              className="-mt-1 text-foreground"
            >
              <Wordmark className="h-[min(4rem,12svh)] sm:h-[min(5rem,13svh)]" />
            </motion.div>

            <motion.div
              initial={{ opacity: from(0, 1), letterSpacing: from("0.2em", "0.4em") }}
              animate={{ opacity: 1, letterSpacing: "0.4em" }}
              transition={step(2.15, 0.6, easeOut)}
              className="-mt-2 flex items-center gap-4 text-brand-gold"
            >
              <motion.span
                initial={{ scaleX: from(0, 1) }}
                animate={{ scaleX: 1 }}
                transition={step(2.25, 0.6, easeOut)}
                className="h-px w-12 origin-right bg-current sm:w-16"
              />
              {/* Letter spacing also trails the last letter; pull it back to centre. */}
              <span className={cn(cinzel.className, "-mr-[0.4em] text-lg sm:text-xl")}>SCENTS</span>
              <motion.span
                initial={{ scaleX: from(0, 1) }}
                animate={{ scaleX: 1 }}
                transition={step(2.25, 0.6, easeOut)}
                className="h-px w-12 origin-left bg-current sm:w-16"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
