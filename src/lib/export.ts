import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export function exportToExcel(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(data: Record<string, any>[], filename: string, title?: string) {
  if (!data.length) return;
  const doc = new jsPDF();
  const headers = Object.keys(data[0]);
  const rows = data.map((r) => headers.map((h) => String(r[h] ?? "")));

  doc.setFontSize(14);
  doc.text(title || filename, 14, 22);

  (doc as any).autoTable({
    startY: 30,
    head: [headers],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save(`${filename}.pdf`);
}
