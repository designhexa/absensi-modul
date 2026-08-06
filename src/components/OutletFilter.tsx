import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ------------------------------------------------------------------
// OutletFilter — reusable combobox-style filter/selector for outlets
//
// Props:
//   outlets    – array of outlet objects (must have id, nama)
//   selectedId – currently selected outlet id (controlled by parent)
//   onSelect   – callback fired when user picks an outlet from the list
//   label      – optional label text (default "Outlet")
// ------------------------------------------------------------------
export interface OutletItem {
  id: string;
  nama: string;
  // allow additional fields without restricting shape
  [key: string]: any;
}

export interface OutletFilterProps {
  outlets: OutletItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
  // Opsi "Semua Outlet" opsional — muncul sebagai item teratas di daftar
  showAll?: boolean;
  allLabel?: string;
  allValue?: string;
}

export default function OutletFilter({
  outlets,
  selectedId,
  onSelect,
  label = "Outlet",
  showAll = false,
  allLabel = "Semua Outlet",
  allValue = "",
}: OutletFilterProps) {
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const isAllSelected = showAll && selectedId === allValue;

  const filteredOutlets = useMemo(() => {
    // Saat opsi "Semua Outlet" terpilih, input menampilkan allLabel — biarkan
    // seluruh outlet tetap muncul saat dropdown dibuka kembali.
    if (!searchText.trim() || searchText === allLabel) return outlets;
    const q = searchText.toLowerCase();
    return outlets.filter(
      (o) =>
        o.nama.toLowerCase().includes(q)
    );
  }, [outlets, searchText, allLabel]);

  const selectedOutlet = useMemo(
    () => outlets.find((o) => o.id === selectedId),
    [outlets, selectedId]
  );

  // inputValue harus SELALU dari searchText, BUKAN dari selectedOutlet.
  const inputValue = searchText;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        placeholder="Cari outlet..."
        value={inputValue}
        onChange={(e) => {
          setSearchText(e.target.value);
          onSelect("");
          setIsOpen(true);
        }}
        onFocus={() => {
          // Hanya reset kalau sebelumnya sudah ada outlet terpilih,
          // biar teks pencarian yang sedang diketik tidak hilang
          if (selectedOutlet) {
            setSearchText("");
            onSelect("");
          }
          setIsOpen(true);
        }}
        onBlur={(e) => {
          const container = e.currentTarget.parentElement;
          setTimeout(() => {
            if (!container?.contains(document.activeElement)) {
              setIsOpen(false);
            }
          }, 120);
        }}
        className="h-10"
      />

      {isOpen && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="border rounded-lg max-h-[180px] overflow-y-auto mt-1 divide-y bg-background shadow-lg"
        >
          {showAll && (
            <div
              className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                isAllSelected
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted"
              }`}
              onClick={() => {
                onSelect(allValue);
                setSearchText(allLabel);
                setIsOpen(false);
              }}
            >
              <span className="font-medium">{allLabel}</span>
              <span className="text-[10px] text-muted-foreground">total semua outlet</span>
            </div>
          )}
          {filteredOutlets.map((o) => (
            <div
              key={o.id}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                selectedId === o.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted"
              }`}
              onClick={() => {
                // Tampilkan nama outlet di input setelah pilih
                onSelect(o.id);
                setSearchText(o.nama);
                setIsOpen(false);
              }}
            >
              <span className="font-medium">{o.nama}</span>
            </div>
          ))}
          {filteredOutlets.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Tidak ditemukan
            </div>
          )}
        </div>
      )}
    </div>
  );
}
