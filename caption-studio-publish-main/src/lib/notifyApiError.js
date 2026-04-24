import { toast } from "@/components/ui/use-toast"
import { getApiErrorMessage } from "@/lib/apiClient"

export function notifyApiError(error, title = "Request failed") {
  if (error?.name === "AbortError") {
    return
  }
  toast({
    variant: "destructive",
    title,
    description: getApiErrorMessage(error),
  })
}
