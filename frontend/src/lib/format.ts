const nprFormatter = new Intl.NumberFormat("en-NP", {
  style: "currency",
  currency: "NPR",
  maximumFractionDigits: 0,
})

const nprPreciseFormatter = new Intl.NumberFormat("en-NP", {
  style: "currency",
  currency: "NPR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("en-NP")

export function formatNPR(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return nprFormatter.format(value)
}

export function formatNPRPrecise(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return nprPreciseFormatter.format(value)
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return numberFormatter.format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value.length === 10 ? `${value}T00:00:00` : value),
  )
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatMonth(value: string): string {
  const [year, month] = value.split("-")
  const label = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(Number(year), Number(month) - 1, 1))
  return `${label} ${year?.slice(2)}`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
