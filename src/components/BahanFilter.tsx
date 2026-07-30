import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ------------------------------------------------------------------
// BahanFilter — reusable combobox-style filter for bahan baku
//
// Props:
//   bahan      – array of bahan objects (must have id, kode, nama)
//   selectedId – currently selected bahan id (controlled by parent)
//   onSelect   – callback fired when user picks a bahan from the list
//   label      – optional label text (default "Bahan")
// ------------------------------------------------------------------
export interface BahanBakuItem {
  id: string;
  kode: string;
  nama: string;
  // allow additional fields without restricting shape
  [key: string]: any;
}

export interface BahanFilterProps {
  bahan: BahanBakuItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
}

export default function BahanFilter({
  bahan,
  selectedId,
  onSelect,
  label = "Bahan",
}: BahanFilterProps) {
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredBahan = useMemo(() => {
    if (!searchText.trim()) return bahan;
    const q = searchText.toLowerCase();
    return bahan.filter(
      (b) =>
        b.kode.toLowerCase().startsWith(q) ||
        b.nama.toLowerCase().startsWith(q)
    );
  }, [bahan, searchText]);

  const selectedBahan = useMemo(
    () => bahan.find((b) => b.id === selectedId),
    [bahan, selectedId]
  );

  // IMPORTANT: inputValue harus SELALU dari searchText, BUKAN dari selectedBahan.
  // Kalau dari selectedBahan, input jadi frozen saat user mengetik karena
  // string kode-nama tidak berubah meski searchText diupdate oleh onChange.
  // Simpan nama bahan ke searchText saat user memilih dari popup (lihat onClick).
  const inputValue = searchText;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        placeholder="Cari kode/nama bahan..."
        value={inputValue}
        onChange={(e) => {
          setSearchText(e.target.value);
          onSelect("");
          setIsOpen(true);
        }}
        onFocus={() => {
          // Hanya reset kalau sebelumnya sudah ada bahan terpilih,
          // biar teks pencarian yang sedang diketik tidak hilang
          if (selectedBahan) {
            setSearchText("");
            onSelect("");
          }
          setIsOpen(true);
        }}
        onBlur={(e) => {
          // Capture DOM ref before setTimeout (React pools synthetic events)
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
          // Prevent blur/close when clicking inside the popup
          onMouseDown={(e) => e.preventDefault()}
          className="border rounded-lg max-h-[180px] overflow-y-auto mt-1 divide-y bg-background shadow-lg"
        >
          {filteredBahan.map((b) => (
            <div
              key={b.id}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                selectedId === b.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted"
              }`}
              onClick={() => {
                // Input tetap kosong setelah pilih biar langsung bisa ngetik
                onSelect(b.id);
                setSearchText("");
                setIsOpen(false);
              }}
            >
              <span className="font-mono text-xs text-muted-foreground">
                {b.kode}
              </span>
              {" — "}
              {b.nama}
            </div>
          ))}
          {filteredBahan.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Tidak ditemukan
            </div>
          )}
        </div>
      )}
    </div>
  );
}
