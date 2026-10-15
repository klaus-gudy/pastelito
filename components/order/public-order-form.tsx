"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight, CircleCheck, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  submitPublicOrder,
  type PublicOrderFormState,
} from "@/lib/actions/public-order";
import { formatMoney } from "@/lib/format";
import { issuesByPath } from "@/lib/validations/common";
import { publicOrderSchema } from "@/lib/validations/public-order";

export type OrderProductOption = {
  id: string;
  label: string;
  /** Selling price in whole shillings. */
  price: number;
};

type Row = { key: number; productId: string; brand: string; quantity: string };

// Each step is checked with its slice of the server's schema before moving on.
const STEPS = [
  {
    title: "Your details",
    schema: publicOrderSchema.pick({ name: true, phone: true }),
  },
  { title: "Your order", schema: publicOrderSchema.pick({ items: true }) },
  { title: "Additional info", schema: publicOrderSchema.pick({ note: true }) },
] as const;

/** The step that holds a field, from its error key like "items.0.quantity". */
const stepOf = (key: string) =>
  key.startsWith("items") ? 1 : key === "note" ? 2 : 0;

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }));

export function PublicOrderForm({
  shopSlug,
  products,
}: {
  shopSlug: string;
  products: OrderProductOption[];
}) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [state, action, pending] = useActionState(
    async (previous: PublicOrderFormState, formData: FormData) => {
      const result = await submitPublicOrder(previous, formData);
      if (result?.errors) {
        // Send the customer back to the first step that needs fixing.
        setErrors(result.errors);
        setStep(Math.min(...Object.keys(result.errors).map(stepOf)));
      }
      return result;
    },
    undefined,
  );

  // Kept in state, not the DOM, so earlier steps survive being unmounted.
  const [details, setDetails] = useState({ name: "", phone: "", note: "" });
  const emptyRow = { productId: "", brand: "", quantity: "1" };
  // Row keys only need to be unique; the counter is read in event handlers.
  const nextKey = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ key: 0, ...emptyRow }]);
  const updateRow = (key: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  const items = rows.map(({ productId, brand, quantity }) => ({
    productId,
    brand,
    quantity,
  }));

  const priceOf = (id: string) => products.find((p) => p.id === id)?.price ?? 0;
  const total = rows.reduce(
    (sum, row) => sum + priceOf(row.productId) * (Number(row.quantity) || 0),
    0,
  );

  // Move focus to the new step's heading, but not on first load.
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step]);
  const goTo = (next: number) => {
    moved.current = true;
    setStep(next);
  };

  if (state?.success) {
    return (
      <Alert>
        <CircleCheck />
        <AlertTitle>Thank you!</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  const isLast = step === STEPS.length - 1;

  return (
    // Submitted via onSubmit so React doesn't reset the rows on an error.
    <form
      className="grid gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = STEPS[step].schema.safeParse({ ...details, items });
        if (!parsed.success) {
          setErrors(issuesByPath(parsed.error));
          return;
        }
        setErrors({});
        if (!isLast) {
          goTo(step + 1);
          return;
        }
        const formData = new FormData();
        formData.set("shop", shopSlug);
        formData.set("name", details.name);
        formData.set("phone", details.phone);
        formData.set("note", details.note);
        formData.set("items", JSON.stringify(items));
        startTransition(() => action(formData));
      }}
    >
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h3 ref={heading} tabIndex={-1} className="font-medium outline-none">
            {STEPS[step].title}
          </h3>
          <span className="text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <Progress
          value={((step + 1) / STEPS.length) * 100}
          aria-label={`Step ${step + 1} of ${STEPS.length}`}
        />
      </div>

      {state?.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {step === 0 && (
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Your name</FieldLabel>
            <Input
              id="name"
              autoComplete="name"
              required
              maxLength={100}
              value={details.name}
              aria-invalid={!!errors.name}
              onChange={(event) =>
                setDetails({ ...details, name: event.target.value })
              }
            />
            <FieldError errors={toErrors(errors.name)} />
          </Field>
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="phone">Phone number</FieldLabel>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              required
              value={details.phone}
              aria-invalid={!!errors.phone}
              onChange={(event) =>
                setDetails({ ...details, phone: event.target.value })
              }
            />
            <FieldError errors={toErrors(errors.phone)} />
          </Field>
        </FieldGroup>
      )}

      {step === 1 && (
        <FieldSet data-invalid={!!errors.items}>
          <FieldLegend variant="label">What would you like?</FieldLegend>
          <div className="grid gap-4">
            {rows.map((row, index) => {
              const rowErrors = [
                ...(errors[`items.${index}.productId`] ?? []),
                ...(errors[`items.${index}.brand`] ?? []),
                ...(errors[`items.${index}.quantity`] ?? []),
              ];
              return (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-lg border p-3 sm:border-0 sm:p-0"
                >
                  {/* One line from sm up; on phones the perfume gets its own
                      line above the brand and quantity. */}
                  <div className="grid grid-cols-[minmax(0,1fr)_5rem_auto] gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_5rem_auto]">
                    <NativeSelect
                      className="col-span-3 w-full sm:col-span-1"
                      value={row.productId}
                      aria-label={`Item ${index + 1} product`}
                      aria-invalid={!!errors[`items.${index}.productId`]}
                      onChange={(event) =>
                        updateRow(row.key, { productId: event.target.value })
                      }
                    >
                      <NativeSelectOption value="" disabled>
                        Pick a perfume
                      </NativeSelectOption>
                      {products.map((product) => (
                        <NativeSelectOption key={product.id} value={product.id}>
                          {product.label} · {formatMoney(product.price)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <Input
                      value={row.brand}
                      placeholder="Brand or scent (optional)"
                      maxLength={100}
                      aria-label={`Item ${index + 1} brand`}
                      onChange={(event) =>
                        updateRow(row.key, { brand: event.target.value })
                      }
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      value={row.quantity}
                      aria-label={`Item ${index + 1} quantity`}
                      aria-invalid={!!errors[`items.${index}.quantity`]}
                      onChange={(event) =>
                        updateRow(row.key, { quantity: event.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove item ${index + 1}`}
                      disabled={rows.length === 1}
                      onClick={() =>
                        setRows((current) =>
                          current.filter((other) => other.key !== row.key),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <FieldError errors={toErrors(rowErrors)} />
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              disabled={rows.length >= 20}
              onClick={() =>
                setRows((current) => [
                  ...current,
                  { key: nextKey.current++, ...emptyRow },
                ])
              }
            >
              <Plus data-icon="inline-start" />
              Add another
            </Button>
          </div>
          <FieldError errors={toErrors(errors.items)} />
        </FieldSet>
      )}

      {step === 2 && (
        <FieldGroup>
          <Field data-invalid={!!errors.note}>
            <FieldLabel htmlFor="note">Anything else? (optional)</FieldLabel>
            <Textarea
              id="note"
              maxLength={500}
              placeholder="When you need it, where to deliver, …"
              value={details.note}
              aria-invalid={!!errors.note}
              onChange={(event) =>
                setDetails({ ...details, note: event.target.value })
              }
            />
            <FieldError errors={toErrors(errors.note)} />
          </Field>
        </FieldGroup>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setErrors({});
              goTo(step - 1);
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4">
          {step > 0 && (
            <span className="text-sm text-muted-foreground">
              Total{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatMoney(total)}
              </span>
            </span>
          )}
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {isLast ? "Send order" : "Next"}
            {!isLast && <ArrowRight data-icon="inline-end" />}
          </Button>
        </div>
      </div>
    </form>
  );
}
