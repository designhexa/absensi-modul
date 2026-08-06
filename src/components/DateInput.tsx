import { Input } from "@/components/ui/input";
import { ArrowNav } from "@/components/ArrowNav";
import { addDays, format, parseISO } from "date-fns";

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
  const canShift = !disabled && has;

  const shift = (dir: 1 | -1) => {
    if (!value) return;
    onChange(format(addDays(parseISO(value), dir), "yyyy-MM-dd"));
  };

  return (
    <ArrowNav
      variant="pill"
      size="sm"
      onPrev={() => shift(-1)}
      onNext={() => shift(1)}
      disabledPrev={!canShift}
      disabledNext={!canShift}
      prevLabel="Tanggal sebelumnya"
      nextLabel="Tanggal berikutnya"
      className={className}
    >
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 w-full border-0 bg-transparent px-0.5 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </ArrowNav>
  );
}
