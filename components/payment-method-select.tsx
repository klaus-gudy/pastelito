"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { paymentMethodLabels } from "@/lib/labels"

/** Payment method picker; submits the method under `name`. */
export function PaymentMethodSelect({
  id,
  name = "method",
  defaultValue = "CASH",
  invalid,
}: {
  id: string
  name?: string
  defaultValue?: string
  invalid?: boolean
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
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
  )
}
