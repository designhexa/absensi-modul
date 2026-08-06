import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarRange, X } from "lucide-react";
import { DateRange } from "@/lib/format";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowNav } from "@/components/ArrowNav";
import type { DateRange as RDPRange } from "react-day-picker";

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
  className?: string;
}

const toISO = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : undefined);
const fromISO = (s?: string) => (s ? parseISO(s) : undefined);
const fmt = (s?: string) => (s ? format(parseISO(s), "dd MMM yy", { locale: idLocale }) : "Pilih");

export function DateRangeFilter({ value, onChange, className }: Props) {
  const isMobile = useIsMobile();
  const clear = () => onChange({});
  const has = value.from || value.to;

  const selected: RDPRange | undefined =
    value.from || value.to
      ? { from: fromISO(value.from), to: fromISO(value.to) }
      : undefined;

  const handleSelect = (r: RDPRange | undefined) => {
    onChange({ from: toISO(r?.from), to: toISO(r?.to) });
  };

  const shiftRange = (direction: "prev" | "next") => {
    const from = fromISO(value.from);
    const to = fromISO(value.to);

    if (!from && !to) return;

    // Hitung durasi rentang: jika from & to ada, shift sebesar durasi; jika hanya satu hari, shift 1 hari
    const diff = from && to ? Math.max(1, differenceInCalendarDays(to, from)) : 1;
    const multiplier = direction === "prev" ? -1 : 1;
    const shift = diff * multiplier;

    if (from && to) {
      onChange({
        from: toISO(addDays(from, shift)),
        to: toISO(addDays(to, shift)),
      });
    } else if (from) {
      onChange({
        from: toISO(addDays(from, shift)),
        to: undefined,
      });
    } else if (to) {
      onChange({
        from: undefined,
        to: toISO(addDays(to, shift)),
      });
    }
  };

  const label = !value.from && !value.to
    ? "Pilih rentang tanggal"
    : `${fmt(value.from)} → ${fmt(value.to)}`;

  return (
    <ArrowNav
      variant="pill"
      size="sm"
      onPrev={() => shiftRange("prev")}
      onNext={() => shiftRange("next")}
      disabledPrev={!has}
      disabledNext={!has}
      prevLabel="Tanggal sebelumnya"
      nextLabel="Tanggal berikutnya"
      className={cn("sm:w-auto sm:inline-flex", className)}
      trailing={
        has ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={clear}
            aria-label="Reset filter tanggal"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : undefined
      }
    >
      <CalendarRange className="h-4 w-4 text-primary shrink-0" />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-2 flex-1 sm:flex-none sm:w-[230px] justify-start font-normal text-xs sm:text-sm truncate",
              !has && "text-muted-foreground"
            )}
          >
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0 z-50">
          <Calendar
            mode="range"
            selected={selected}
            onSelect={handleSelect}
            numberOfMonths={isMobile ? 1 : 2}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </ArrowNav>
  );
}
