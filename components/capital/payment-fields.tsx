"use client"

import { DatePicker } from "@/components/date-picker"
import { MoneyInput } from "@/components/money-input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { paymentMethodLabels } from "@/lib/labels"

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

/** Amount, payment method and date, shared by the capital dialogs. */
export function PaymentFields({
  errors,
  values,
  today,
  amountLabel = "Amount",
  required = true,
}: {
  errors?: Partial<Record<string, string[]>>
  values?: Record<string, string>
  today: string
  amountLabel?: string
  required?: boolean
}) {
  return (
    <>
      <Field data-invalid={!!errors?.amount}>
        <FieldLabel htmlFor="amount">{amountLabel}</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>TZS</InputGroupText>
          </InputGroupAddon>
          <MoneyInput
            id="amount"
            name="amount"
            placeholder="500,000"
            defaultValue={values?.amount}
            aria-invalid={!!errors?.amount}
            required={required}
          />
        </InputGroup>
        <FieldError errors={toErrors(errors?.amount)} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field data-invalid={!!errors?.method}>
          <FieldLabel htmlFor="method">Paid by</FieldLabel>
          <Select name="method" defaultValue={values?.method || "CASH"}>
            <SelectTrigger
              id="method"
              className="w-full"
              aria-invalid={!!errors?.method}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(paymentMethodLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={toErrors(errors?.method)} />
        </Field>
        <Field data-invalid={!!errors?.date}>
          <FieldLabel htmlFor="date">Date</FieldLabel>
          <DatePicker
            id="date"
            name="date"
            defaultValue={values?.date || today}
            maxDate={today}
            invalid={!!errors?.date}
          />
          <FieldError errors={toErrors(errors?.date)} />
        </Field>
      </div>
    </>
  )
}
