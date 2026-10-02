export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

export function formatQty(value: number, unit: string): string {
  const decimals = unit === "un" ? 0 : 3;
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${formatted} ${unit}`;
}

export function parseDecimal(input: string | number): number {
  if (typeof input === "number") return input;
  const normalized = input.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export type PriceDelta = {
  previous: number;
  current: number;
  absolute: number;
  percent: number;
  direction: "up" | "down" | "same";
};

export function calcPriceDelta(previous: number, current: number): PriceDelta {
  const absolute = current - previous;
  const percent = previous === 0 ? 0 : (absolute / previous) * 100;
  const direction =
    Math.abs(absolute) < 0.005 ? "same" : absolute > 0 ? "up" : "down";

  return {
    previous,
    current,
    absolute,
    percent,
    direction,
  };
}
