import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/export";

interface Props {
  filename: string;
  title: string;
  headers: string[];
  /** Rows for PDF — array of primitive cells in same order as headers */
  rows: (string | number)[][];
  /** Optional richer rows for Excel (objects). Falls back to building from headers+rows. */
  excelRows?: Record<string, any>[];
}

export function ExportButtons({ filename, title, headers, rows, excelRows }: Props) {
  const data =
    excelRows ??
    rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));

  const handleExcel = () => {
    exportToExcel(data, filename);
  };
  const handlePDF = () => exportToPDF(data, filename, title);

  return (
    <div className="flex flex-nowrap gap-2">
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={handleExcel}
        className="hover-lift"
        aria-label="Download Excel"
        title="Download Excel"
      >
        <FileSpreadsheet className="h-4 w-4 text-success" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={handlePDF}
        className="hover-lift"
        aria-label="Download PDF"
        title="Download PDF"
      >
        <FileText className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
