import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ConfirmDeleteButtonProps {
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  size?: "icon" | "sm" | "default" | "lg";
  className?: string;
}

export default function ConfirmDeleteButton({
  onConfirm,
  title = "Hapus Data",
  description = "Data akan dihapus permanen dan tidak bisa dikembalikan. Lanjutkan?",
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  size = "icon",
  className,
}: ConfirmDeleteButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size={size} variant="ghost" aria-label={title} className={className}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                await onConfirm();
              } catch (err: any) {
                toast.error(err?.message || "Gagal menghapus data");
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
