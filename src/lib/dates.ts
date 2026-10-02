import {
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  startOfISOWeek,
  endOfISOWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export function toYearMonth(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM");
}

export function toIsoWeek(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const week = String(getISOWeek(d)).padStart(2, "0");
  return `${getISOWeekYear(d)}-W${week}`;
}

export function toDateInput(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDateBr(date: string): string {
  return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
}

export function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return format(d, "MMMM 'de' yyyy", { locale: ptBR });
}

export function formatWeekLabel(isoWeek: string): string {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return isoWeek;
  const year = Number(match[1]);
  const week = Number(match[2]);
  // Approximate: ISO week 1 contains Jan 4
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return `Semana ${week} (${format(monday, "dd/MM")}–${format(sunday, "dd/MM")})`;
}

export function weeksInMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = startOfMonth(new Date(y, m - 1, 1));
  const end = endOfMonth(start);
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
  const unique = new Set(weeks.map((w) => toIsoWeek(w)));
  return [...unique];
}

export function previousIsoWeek(isoWeek: string): string {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return isoWeek;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  monday.setUTCDate(monday.getUTCDate() - 7);
  return toIsoWeek(monday);
}

export { startOfISOWeek, endOfISOWeek };
