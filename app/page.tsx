import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Boxes,
  ClipboardList,
  HandCoins,
  Landmark,
  PiggyBank,
  ReceiptText,
  Scale,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Area = {
  icon: LucideIcon;
  title: string;
  question: string;
  answers: string[];
};

const areas: Area[] = [
  {
    icon: TrendingUp,
    title: "Demand",
    question: "Which products and sizes sell most, and what should I restock?",
    answers: ["Best sellers by size", "Restock suggestions"],
  },
  {
    icon: ShoppingBag,
    title: "Purchases",
    question: "What did I buy, when, from whom, and at what cost?",
    answers: ["Supplier history", "Cost per item"],
  },
  {
    icon: PiggyBank,
    title: "Profit",
    question:
      "After stock costs and expenses, how much did I actually earn?",
    answers: ["Real margin per sale", "Expenses deducted"],
  },
  {
    icon: Users,
    title: "Customers",
    question: "Who buys from me, what do they buy, and who comes back?",
    answers: ["Purchase history", "Repeat buyers"],
  },
  {
    icon: ClipboardList,
    title: "Preorders",
    question:
      "Who is waiting, what did they order, and have they paid a deposit?",
    answers: ["Waiting list", "Deposits received"],
  },
  {
    icon: HandCoins,
    title: "Capital",
    question:
      "Who contributed money, was it repayable, and how much remains owed?",
    answers: ["Contributions", "Balances still owed"],
  },
  {
    icon: Scale,
    title: "Business position",
    question:
      "How much money is in cash, unsold stock, and customer debts?",
    answers: ["Cash on hand", "Stock and debts valued"],
  },
];

const position: { icon: LucideIcon; label: string }[] = [
  { icon: Banknote, label: "Cash" },
  { icon: Boxes, label: "Unsold stock" },
  { icon: ReceiptText, label: "Customer debts" },
];

const steps = [
  {
    title: "Add your products",
    description: "List what you sell, with the sizes you stock.",
  },
  {
    title: "Record stock purchases",
    description: "Note what you bought, from whom, and what it cost.",
  },
  {
    title: "Log sales and preorders",
    description: "Every sale and deposit fills in the picture above.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          Pastelito
        </Link>
        <Badge variant="secondary">Early preview</Badge>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div className="flex flex-col items-start gap-6">
            <Badge variant="outline">Sales tracking for small sellers</Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Know what sells, what you earned, and who you owe.
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              Pastelito keeps your sales, stock purchases, customers,
              preorders and capital in one place, so the answers are there
              when you need them.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <a href="#start">
                  Get started
                  <ArrowRight data-icon="inline-end" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#areas">See what it tracks</a>
              </Button>
            </div>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="size-4 text-primary" />
                Business position
              </CardTitle>
              <CardDescription>
                Where your money is right now.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {position.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg bg-muted px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm">
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">
                    —
                  </span>
                </div>
              ))}
            </CardContent>
            <CardFooter className="border-t py-3 text-xs text-muted-foreground">
              Fills in as you record purchases and sales.
            </CardFooter>
          </Card>
        </section>

        <section
          id="areas"
          className="scroll-mt-8 bg-secondary/40 py-16 lg:py-20"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Seven questions, answered
              </h2>
              <p className="mt-3 text-muted-foreground">
                Each part of Pastelito exists to settle one question every
                seller keeps asking.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map(({ icon: Icon, title, question, answers }) => (
                <Card key={title} className="last:sm:col-span-2 last:lg:col-span-1">
                  <CardHeader>
                    <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                      <Icon className="size-5" />
                    </span>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription className="text-pretty">
                      {question}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto flex flex-wrap gap-2">
                    {answers.map((answer) => (
                      <Badge key={answer} variant="secondary">
                        {answer}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section
          id="start"
          className="mx-auto w-full max-w-6xl scroll-mt-8 px-4 py-16 sm:px-6 lg:py-20"
        >
          <h2 className="text-3xl font-semibold tracking-tight">
            Start in three steps
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm text-primary-foreground">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <Separator />
      <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
        Pastelito · Your sales, stock and money in one place.
      </footer>
    </div>
  );
}
