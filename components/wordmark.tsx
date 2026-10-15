import { cn } from "@/lib/utils"

// "Pastelito" in the logo's script lettering. The script runs small, so it is
// set larger than the text around it.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-brand text-[1.4em] leading-none font-normal", className)}>
      Pastelito
    </span>
  )
}
