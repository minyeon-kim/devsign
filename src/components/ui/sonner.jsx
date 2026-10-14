import { useEffect } from "react"
import { Toaster as Sonner, toast } from "sonner";
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useLanguage } from "@/i18n/language"
import { translateText } from "@/i18n/translate"

const Toaster = ({
  ...props
}) => {
  // The toast region's label ("Notifications alt+T") is Sonner's own
  // string, outside the JSX translation boundary.
  const language = useLanguage()
  // A toast is put away by pressing it, like a notice card: anywhere but its own buttons and
  // links, and not while a text selection is being made. (It presses the toast's own close
  // button, so the toast leaves — and says so — the way its × would.)
  useEffect(() => {
    function onPress(event) {
      const toast = event.target.closest?.("[data-sonner-toast]")
      if (!toast || event.target.closest("button, a, input, textarea, select") || window.getSelection?.()?.toString()) return
      toast.querySelector("[data-close-button]")?.click()
    }
    document.addEventListener("click", onPress)
    // …and by pressing anywhere else: a notice up on the screen goes when the person goes on with something
    // else. (On the press, before the click — a notice the click itself raises isn't put away by that click.)
    function onPressElsewhere(event) {
      if (event.target.closest?.("[data-sonner-toast], [data-sonner-toaster]")) return
      toast.dismiss()
    }
    document.addEventListener("pointerdown", onPressElsewhere, true)
    return () => { document.removeEventListener("click", onPress); document.removeEventListener("pointerdown", onPressElsewhere, true) }
  }, [])
  return (
    <Sonner
      theme="dark"
      closeButton
      containerAriaLabel={translateText("Notifications", language)}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)"
        }
      }
      toastOptions={{
        closeButtonAriaLabel: translateText("Close", language),
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
}

export { Toaster }
