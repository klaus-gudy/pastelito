import { cn } from "@/lib/utils"

// "Pastelito" in the brand's script lettering, traced from the artwork. The
// lettering is a mask over the current text colour, so it follows the theme.
// Inline, its letters sit on the text baseline (only the P's tail dips below)
// and the lowercase matches the height of the surrounding text.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Pastelito"
      className={cn(
        "inline-block aspect-[1064/284] h-[1.35em] shrink-0 bg-current align-[-0.105em] [mask:url(/brand/pastelito-wordmark.svg)_center/contain_no-repeat]",
        className,
      )}
    />
  )
}
