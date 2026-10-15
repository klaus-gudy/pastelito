import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <span className="flex items-center gap-2 text-lg font-semibold">
        <BrandMark className="size-10" />
        Pastelito
      </span>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
