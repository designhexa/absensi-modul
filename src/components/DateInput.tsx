import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------
// DateInput — input tanggal (yyyy-MM-dd) dengan tombol panah prev/next
// agar pindah hari cepat, konsisten dengan DateRangeFilter & pemilih
// outlet yang sudah punya tombol panah.
//
// Props:
//   value    – tanggal aktif (format ISO "yyyy-MM-dd")
//   onChange – callback (value: string) saat tanggal berubah
//   className– kelas tambahan untuk wrapper (lebar/teks/dll)
//   disabled – nonaktifkan input & tombol panah
// ------------------------------------------------------------------
interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function DateInput({ value, onChange, className, disabled }: DateInputProps) {
  const has = !!value;

  const shift = (dir: 1 | -1) => {
    if (!value) return;
    onChange(format(addDays(parseISO(value), dir), "yyyy-MM-dd"));
  };

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-xl border bg-card/60 backdrop-blur px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring/40",
        className
      )}
    >
      {/* Tombol Previous */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={() => shift(-1)}
        disabled={disabled || !has}
        aria-label="Tanggal sebelumnya"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0.5 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
      />

      {/* Tombol Next */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={() => shift(1)}
        disabled={disabled || !has}
        aria-label="Tanggal berikutnya"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
