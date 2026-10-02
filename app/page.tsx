import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const areas = [
  "Demand",
  "Purchases",
  "Profit",
  "Customers",
  "Preorders",
  "Capital",
  "Business position",
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Sparkles className="size-6" />
      </span>
      <p className="mt-4 font-semibold">Pastelito</p>

      <h1 className="mt-8 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Know what sells, what you earned, and who you owe.
      </h1>
      <p className="mt-4 max-w-md text-lg text-pretty text-muted-foreground">
        Your sales, stock, customers and money, all in one place.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" asChild>
          <Link href="/sign-up">Get started</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>

      <ul className="mt-10 flex max-w-lg flex-wrap justify-center gap-2">
        {areas.map((area) => (
          <li key={area}>
            <Badge variant="secondary">{area}</Badge>
          </li>
        ))}
      </ul>
    </main>
  );
}
