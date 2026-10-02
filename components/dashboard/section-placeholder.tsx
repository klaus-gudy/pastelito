import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { NavItem } from "@/components/dashboard/navigation"

/** Stand-in for a section that hasn't been built yet. */
export function SectionPlaceholder({ item }: { item: NavItem }) {
  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <item.icon />
        </EmptyMedia>
        <EmptyTitle>{item.title}</EmptyTitle>
        <EmptyDescription>{item.question}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Badge variant="secondary">Coming soon</Badge>
      </EmptyContent>
    </Empty>
  )
}
