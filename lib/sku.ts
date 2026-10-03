/**
 * Stock-keeping unit generated from the product name and size, e.g.
 * "Pastelito large" 100 ml -> "PASTELITO-LARGE-100ML". Name + size is already
 * unique per user, so the SKU is too.
 */
export function generateSku(name: string, sizeMl: number) {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${slug || "PRODUCT"}-${sizeMl}ML`
}
