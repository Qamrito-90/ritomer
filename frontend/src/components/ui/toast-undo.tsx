import * as Toast from "@radix-ui/react-toast";
import { Button } from "./button";

interface ToastUndoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel?: string;
  onUndo: () => void;
}

export function ToastUndo({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = "Annuler",
  onUndo
}: ToastUndoProps) {
  return (
    <Toast.Provider swipeDirection="right">
      <Toast.Root
        className="fixed bottom-4 right-4 z-50 grid w-[min(360px,calc(100vw-2rem))] gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-surface"
        onOpenChange={onOpenChange}
        open={open}
      >
        <div className="grid gap-1">
          <Toast.Title className="text-sm font-semibold">{title}</Toast.Title>
          <Toast.Description className="text-sm text-muted-foreground">
            {description}
          </Toast.Description>
        </div>
        <Toast.Action altText={actionLabel} asChild>
          <Button onClick={onUndo} size="sm" variant="outline">
            {actionLabel}
          </Button>
        </Toast.Action>
      </Toast.Root>
      <Toast.Viewport />
    </Toast.Provider>
  );
}
