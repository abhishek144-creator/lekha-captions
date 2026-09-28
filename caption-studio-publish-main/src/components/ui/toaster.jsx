import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, open, onOpenChange: _onOpenChange, ...props }) {
        if (open === false) return null;
        return (
            <Toast
              key={id}
              role="status"
              {...props}
              className="cursor-pointer"
              onClick={() => dismiss(id)}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose
              aria-label="Dismiss notification"
              onClick={(event) => {
                event.stopPropagation();
                dismiss(id);
              }}
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
} 
