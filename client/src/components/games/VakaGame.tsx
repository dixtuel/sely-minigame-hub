import type { SiteLocale } from "@/lib/i18n";
import VakaHub from "@/components/VakaHub";
import { useFinishOnce, type GameResult } from "./shared";

export default function VakaGame({ locale, soundOn, onFinish }: { locale: SiteLocale; seed: number; mastery: number; soundOn: boolean; onFinish: (result: GameResult) => void }) {
  const finish = useFinishOnce(onFinish);

  const handleSolved = (earned: number) => {
    finish({
      outcome: "success",
      score: earned,
      label: locale === "en" ? "Case Closed" : "Dosya Kapandı",
      detail: locale === "en" ? "The truth was uncovered and recorded in the bureau archives." : "Gerçekler açığa çıkarıldı ve büro arşivine kaydedildi.",
    });
  };

  return (
    <div className="vaka-game game-surface">
      <VakaHub locale={locale} soundOn={soundOn} onSolved={handleSolved} />
    </div>
  );
}
