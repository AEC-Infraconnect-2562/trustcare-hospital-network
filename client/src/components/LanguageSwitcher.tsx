import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

/**
 * Language Switcher Toggle
 * Displays a compact TH/EN toggle button for the header area.
 */
export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "th" ? "en" : "th")}
      className="gap-1.5 h-8 px-2.5 text-xs font-medium"
      title={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
    >
      <Globe className="h-3.5 w-3.5" />
      <span className="font-semibold">{lang === "th" ? "EN" : "TH"}</span>
    </Button>
  );
}
