import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// ------------------------------------------------------------------
// ArrowNav — pembungkus reusable untuk tombol panah prev/next di
// sekitar sebuah kontrol pilihan (tanggal, bulan, outlet, rentang).
//
// Menyatukan pola yang tadinya diulang di beberapa tempat agar gaya
// konsisten:
//   - variant "pill"   → tombol ghost kecil dalam kotak border
//     (dipakai DateInput & DateRangeFilter)
//   - variant "inline" → tombol outline tanpa kotak
//     (dipakai pemilih outlet & bulan)
//   - size "sm" | "md" | "lg" → ukuran tombol (h-7 / h-10 / h-11)
//
// Props:
//   onPrev/onNext      – handler saat tombol panah diklik
//   disabledPrev/Next  – nonaktifkan panah (batas awal/akhir, nilai kosong)
//   prevLabel/nextLabel– teks aria-label & title tombol
//   variant, size      – gaya tampilan (lihat di atas)
//   trailing           – konten opsional di kanan tombol next (mis. tombol reset)
//   children           – kontrol yang diapit panah
// ------------------------------------------------------------------
export type ArrowNavVariant = "pill" | "inline";
export type ArrowNavSize = "sm" | "md" | "lg";

interface ArrowNavProps {
  onPrev: () => void;
  onNext: () => void;
  disabledPrev?: boolean;
  disabledNext?: boolean;
  prevLabel?: string;
  nextLabel?: string;
  variant?: ArrowNavVariant;
  size?: ArrowNavSize;
  trailing?: ReactNode;
  className?: string;
  children?: ReactNode;
}

const SIZE_CLASS: Record<ArrowNavSize, string> = {
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-11 w-11",
};

export function ArrowNav({
  onPrev,
  onNext,
  disabledPrev,
  disabledNext,
  prevLabel = "Sebelumnya",
  nextLabel = "Berikutnya",
  variant = "inline",
  size = "md",
  trailing,
  className,
  children,
}: ArrowNavProps) {
  const btnVariant = variant === "pill" ? "ghost" : "outline";

  return (
    <div
      className={cn(
        variant === "pill"
          ? "flex w-full min-w-0 items-center gap-1.5 rounded-xl border bg-card/60 backdrop-blur px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring/40"
          : "flex items-center gap-2",
        className
      )}
    >
      <Button
        type="button"
        variant={btnVariant}
        size="icon"
        className={cn(SIZE_CLASS[size], "shrink-0")}
        onClick={onPrev}
        disabled={disabledPrev}
        title={prevLabel}
        aria-label={prevLabel}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {variant === "pill" && children ? (
        <div className="flex flex-1 min-w-0 items-center gap-1.5">{children}</div>
      ) : (
        children
      )}

      <Button
        type="button"
        variant={btnVariant}
        size="icon"
        className={cn(SIZE_CLASS[size], "shrink-0")}
        onClick={onNext}
        disabled={disabledNext}
        title={nextLabel}
        aria-label={nextLabel}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {trailing}
    </div>
  );
}
