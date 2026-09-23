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

  const [imageCopied, setImageCopied] = useState(false);

  const renderShareImageBlob = async (): Promise<Blob> => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = ogImageUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context failed");
    ctx.drawImage(img, 0, 0, 1200, 630);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("toBlob returned null");
    return blob;
  };

  const downloadShareImage = async () => {
    const blob = await renderShareImageBlob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `sely-${data.gameId}-score.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    setImageCopied(true);
    toast.success(isEn ? "Image downloaded (PNG)!" : "Görsel indirildi (PNG)!");
    setTimeout(() => setImageCopied(false), 2500);
    trackEvent("share_image_downloaded", { game: data.gameId });
  };

  const clipboardImageSupported =
    typeof navigator !== "undefined" && !!navigator.clipboard?.write && typeof ClipboardItem !== "undefined";

  const handleCopyImage = async () => {
    // Some browsers/in-app webviews (older Android WebViews, embedded browsers inside chat
    // apps) never expose an image-capable Clipboard API at all — trying to call it there just
    // throws immediately, so skip straight to a real downloadable file instead of bouncing
    // through a doomed clipboard attempt.
    if (!clipboardImageSupported) {
      try {
        await downloadShareImage();
      } catch {
        handleCopyLink();
      }
      return;
    }

    try {
      // The OG image is fetched over the network and decoded before we have a blob to copy —
      // that can easily take 100ms-1s+. Browsers (Safari in particular) revoke the "user
      // activation" a click grants after just a short async gap, so awaiting the whole image
      // pipeline BEFORE calling navigator.clipboard.write() silently fails there — it never
      // even reaches the catch, the write is just rejected as not user-triggered. Passing a
      // still-pending Promise<Blob> as the ClipboardItem value instead keeps clipboard.write()
      // itself synchronous within the click handler, which both Chrome and Safari accept.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": renderShareImageBlob() }),
      ]);
      setImageCopied(true);
      toast.success(isEn ? "Image copied to clipboard! Ready to paste." : "Görsel panoya kopyalandı! İstediğin yere yapıştırabilirsin.");
      setTimeout(() => setImageCopied(false), 2500);
      trackEvent("share_image_copied", { game: data.gameId });
    } catch {
      // Older engines may reject a Promise-valued ClipboardItem outright — fall back to the
      // sequential await-then-write approach; if the clipboard genuinely won't take an image
      // at all (permissions, unsupported MIME, etc.), download a real PNG file instead of
      // silently degrading to just a text link, since a working image is the actual ask.
      try {
        const blob = await renderShareImageBlob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setImageCopied(true);
        toast.success(isEn ? "Image copied to clipboard! Ready to paste." : "Görsel panoya kopyalandı! İstediğin yere yapıştırabilirsin.");
        setTimeout(() => setImageCopied(false), 2500);
        trackEvent("share_image_copied", { game: data.gameId });
      } catch {
        try {
          await downloadShareImage();
        } catch {
          handleCopyLink();
        }
      }
    }
  };

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
          title: `SELY · ${data.gameTitle}`,
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

        {/* Live Card Preview — SVG, not the PNG: <img> renders SVG natively, and there's no
            reason to pay for server-side rasterization just to show a picture on screen.
            Copy/Download below fetch the real PNG (ogImageUrl, no format param) only when
            actually clicked. */}
        <div className="share-card-preview-wrap">
          <img
            src={`${ogImageUrl}&format=svg`}
            alt="Result Preview Card"
            className="share-card-preview-img"
            loading="lazy"
          />
        </div>

        {/* Action Buttons */}
        <div className="share-modal-actions">
          <button className="share-action-btn share-primary" onClick={handleCopyImage}>
            {imageCopied ? <Check size={16} /> : <Copy size={16} />}
            <span>{imageCopied ? (isEn ? "Image Copied!" : "Görsel Kopyalandı!") : (isEn ? "Copy Image (PNG)" : "Görseli Kopyala")}</span>
          </button>

          <button className="share-action-btn" onClick={handleCopyLink}>
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            <span>{copied ? (isEn ? "Link Copied!" : "Link Kopyalandı!") : (isEn ? "Copy Link" : "Linki Kopyala")}</span>
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
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="share-action-btn share-raw"
            title={isEn ? "Open Showcase Page" : "Paylaşım Sayfasını Aç"}
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
