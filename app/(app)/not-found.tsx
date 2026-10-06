import { NotFoundState } from "@/components/not-found-state"

// A record that no longer exists, e.g. a deleted customer's page; the
// sidebar and header stay usable.
export default function DashboardNotFound() {
  return <NotFoundState className="flex-1 border border-dashed" />
}
