import {
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  Package,
  PiggyBank,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** The question this section answers. */
  question: string
}

export const overviewItem: NavItem = {
  title: "Overview",
  href: "/dashboard",
  icon: LayoutDashboard,
  question: "How much money is in cash, unsold stock, and customer debts?",
}

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Sell",
    items: [
      {
        title: "Sales",
        href: "/dashboard/sales",
        icon: ShoppingCart,
        question: "What did I sell, to whom, and for how much?",
      },
      {
        title: "Preorders",
        href: "/dashboard/preorders",
        icon: ClipboardList,
        question:
          "Who is waiting, what did they order, and have they paid a deposit?",
      },
      {
        title: "Customers",
        href: "/dashboard/customers",
        icon: Users,
        question: "Who buys from me, what do they buy, and who comes back?",
      },
    ],
  },
  {
    label: "Stock",
    items: [
      {
        title: "Products",
        href: "/dashboard/products",
        icon: Package,
        question:
          "Which products and sizes sell most, and what should I restock?",
      },
      {
        title: "Purchases",
        href: "/dashboard/purchases",
        icon: ShoppingBag,
        question: "What did I buy, when, from whom, and at what cost?",
      },
    ],
  },
  {
    label: "Money",
    items: [
      {
        title: "Expenses",
        href: "/dashboard/expenses",
        icon: Receipt,
        question: "What did running the business cost, and on what?",
      },
      {
        title: "Profit",
        href: "/dashboard/profit",
        icon: PiggyBank,
        question:
          "After stock costs and expenses, how much did I actually earn?",
      },
      {
        title: "Capital",
        href: "/dashboard/capital",
        icon: HandCoins,
        question:
          "Who contributed money, was it repayable, and how much remains owed?",
      },
    ],
  },
]

const allItems = [overviewItem, ...navGroups.flatMap((group) => group.items)]

export function findNavItem(href: string) {
  return allItems.find((item) => item.href === href)
}

/** The nav item for a pathname, including pages nested under it. */
export function activeNavItem(pathname: string) {
  return (
    navGroups
      .flatMap((group) => group.items)
      .find(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`)
      ) ?? (pathname === overviewItem.href ? overviewItem : undefined)
  )
}
