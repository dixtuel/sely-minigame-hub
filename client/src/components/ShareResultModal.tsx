import { useState } from "react";
import { Share2, Copy, Check, ExternalLink, X } from "lucide-react";
import type { SiteLocale } from "@/lib/i18n";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

export type ShareCardData = {
  gameId: string;
  gameTitle: string;
  score?: number;
  nick?: string;
  outcome?: "success" | "failure" | "solved" | "dismissed";
  grade?: "S" | "A" | "B" | "C";
  caseTitle?: string;
  suspect?: string;
  locale?: SiteLocale;
};

type Props = {
  data: ShareCardData;
  isOpen: boolean;
  onClose: () => void;
};

export default function ShareResultModal({ data, isOpen, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const isEn = data.locale === "en";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://sely.tr";

  // Build the universal share bridge URL
  const query = new URLSearchParams();
  if (data.score !== undefined) query.set("score", String(data.score));
  if (data.nick) query.set("nick", data.nick);
  if (data.outcome) query.set("outcome", data.outcome);
  if (data.grade) query.set("grade", data.grade);
  if (data.caseTitle) query.set("caseTitle", data.caseTitle);
  if (data.suspect) query.set("suspect", data.suspect);
  if (isEn) query.set("locale", "en");

  const shareUrl = `${origin}/share/${data.gameId}?${query.toString()}`;
  const ogImageUrl = `${origin}/api/og?${query.toString()}&game=${data.gameId}`;

  // Pre-filled social text
  let shareText = isEn
    ? `I just played ${data.gameTitle} on SELY.TR! Can you beat my score?`
    : `SELY.TR'de ${data.gameTitle} oynadım! Günün seviyesinde skorumu geçebilir misin?`;

  if (data.gameId === "vaka") {
    const solved = data.outcome === "solved" || data.outcome === "success";
    shareText = isEn
      ? `SELY Bureau Case: ${data.caseTitle || "Dossier"} — ${solved ? "SOLVED (Grade " + (data.grade || "S") + ")" : "DISMISSED"}`
      : `SELY Polis Bürosu: ${data.caseTitle || "Vaka"} — ${solved ? "ÇÖZÜLDÜ (Derece " + (data.grade || "S") + ")" : "DAVA DÜŞTÜ"}`;
  } else if (data.score !== undefined) {
    shareText = isEn
      ? `${data.gameTitle}: ${data.score.toLocaleString("en-US")} pts on SELY.TR!`
      : `${data.gameTitle}: ${data.score.toLocaleString("tr-TR")} puan yaptım!`;
  }

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success(isEn ? "Share link copied to clipboard!" : "Paylaşım linki panoya kopyalandı!");
        setTimeout(() => setCopied(false), 2500);
        trackEvent("share_link_copied", { game: data.gameId });
      }
    } catch {
      toast.error(isEn ? "Failed to copy link" : "Link kopyalanamadı");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `SELY.TR · ${data.gameTitle}`,
          text: shareText,
          url: shareUrl,
        });
        trackEvent("native_share_opened", { game: data.gameId });
        return;
      } catch {}
    }
    handleCopyLink();
  };

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`;

  return (
    <div className="share-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="share-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <div className="share-modal-title-wrap">
            <Share2 size={18} className="share-modal-icon" />
            <h3>{isEn ? "Share Your Result" : "Sonucunu Paylaş"}</h3>
          </div>
          <button className="share-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Live Card Preview */}
        <div className="share-card-preview-wrap">
          <img
            src={ogImageUrl}
            alt="Result Preview Card"
            className="share-card-preview-img"
            loading="lazy"
          />
        </div>

        {/* Action Buttons */}
        <div className="share-modal-actions">
          <button className="share-action-btn share-primary" onClick={handleNativeShare}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? (isEn ? "Copied!" : "Kopyalandı!") : (isEn ? "Copy Share Link" : "Bağlantıyı Kopyala")}</span>
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="share-action-btn share-whatsapp"
            onClick={() => trackEvent("share_whatsapp", { game: data.gameId })}
          >
            <span>WhatsApp</span>
          </a>

          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="share-action-btn share-twitter"
            onClick={() => trackEvent("share_twitter", { game: data.gameId })}
          >
            <span>X (Twitter)</span>
          </a>

          <a
            href={ogImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="share-action-btn share-raw"
            title={isEn ? "Open Image Card" : "Kart Görselini Aç"}
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
