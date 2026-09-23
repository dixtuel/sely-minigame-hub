import { useState, useEffect, type MouseEvent, type KeyboardEvent } from "react";
import { getDecodedContactEmail, getDecodedOperatorName } from "@/lib/contact";
import { Check, Mail } from "lucide-react";

export function ProtectedContact({
  className = "",
  locale = "tr",
}: {
  className?: string;
  locale?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    setIsClient(true);
    setEmail(getDecodedContactEmail());
  }, []);

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    if (!email) return;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(email).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }

    // Trigger user's default email client
    window.location.href = `mailto:${email}`;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e as unknown as MouseEvent);
    }
  };

  if (!isClient || !email) {
    // SSR / Search engine bots fallback: no harvestable address in raw HTML
    return (
      <span className={`protected-contact-fallback ${className}`}>
        [e-posta / contact]
      </span>
    );
  }

  const [user, domain] = email.split("@");
  const tooltip = locale === "en"
    ? "Click to open mail client & copy address"
    : "E-posta göndermek ve adresi kopyalamak için tıklayın";

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`protected-contact-link ${className}`}
      title={tooltip}
      aria-label={email}
    >
      <span className="protected-user">{user}</span>
      <span className="bot-decoy" style={{ display: "none" }} aria-hidden="true">
        -anti-bot-harvest-
      </span>
      <span className="protected-at" aria-hidden="true">&#64;</span>
      <span className="bot-decoy" style={{ display: "none" }} aria-hidden="true">
        -do-not-scrape-
      </span>
      <span className="protected-domain">{domain}</span>
      {copied ? (
        <span className="protected-copied-badge" aria-live="polite">
          <Check size={11} aria-hidden="true" /> {locale === "en" ? "copied" : "kopyalandı"}
        </span>
      ) : (
        <Mail size={12} className="protected-mail-icon" aria-hidden="true" />
      )}
    </span>
  );
}

export function ProtectedName({ className = "" }: { className?: string }) {
  const [isClient, setIsClient] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setIsClient(true);
    setName(getDecodedOperatorName());
  }, []);

  if (!isClient || !name) {
    // SSR / Scraper fallback: no personal name in raw HTML
    return <span className={`protected-name ${className}`}>Site İşleticisi</span>;
  }

  const parts = name.split(" ");
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");

  return (
    <span className={`protected-name ${className}`} title="Platform Yetkilisi">
      <span>{firstName}</span>
      <span className="bot-decoy" style={{ display: "none" }} aria-hidden="true">
        _bot_filter_
      </span>
      <span> </span>
      <span>{lastName}</span>
    </span>
  );
}
