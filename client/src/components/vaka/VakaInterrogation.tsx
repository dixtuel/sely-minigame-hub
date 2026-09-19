import { useState, useRef, useEffect } from "react";
import type { VakaDetailedCase, VakaSuspect, VakaInterrogationMessage } from "@shared/vakaTypes";
import type { SiteLocale } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { playAccuse, playContradiction, playHit } from "@/lib/sfx";

type Props = {
  vakaCase: VakaDetailedCase;
  locale: SiteLocale;
  soundOn: boolean;
  onOpenVerdict: (accusedId: string) => void;
  onSolved?: (score: number) => void;
};

export default function VakaInterrogation({
  vakaCase,
  locale,
  soundOn,
  onOpenVerdict,
  onSolved,
}: Props) {
  const isEn = locale === "en";
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>(vakaCase.suspects[0]?.id || "");
  const [stressMap, setStressMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    vakaCase.suspects.forEach((s) => (map[s.id] = 12));
    return map;
  });
  const [messages, setMessages] = useState<VakaInterrogationMessage[]>([
    {
      id: "init-msg",
      sender: "system",
      text: isEn
        ? "Interrogation room prepared. Choose a suspect and use questions, evidence confrontation, cross-examination, silence or bluffs to break them."
        : "Sorgu odası hazırlandı. Bir şüpheli seçin; sorular, delil yüzleştirme, çapraz sorgu, sessizlik veya blöf ile baskı kurarak çözün.",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [selectedClueId, setSelectedClueId] = useState<string>("");
  const [crossSuspectId, setCrossSuspectId] = useState<string>("");
  const [solved, setSolved] = useState(false);
  const [verdictText, setVerdictText] = useState<string | null>(null);
  const [activeActionTab, setActiveActionTab] = useState<"chips" | "clues" | "cross" | "tactics">("chips");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeSuspect = vakaCase.suspects.find((s) => s.id === selectedSuspectId) || vakaCase.suspects[0];
  const currentStress = stressMap[selectedSuspectId] || 12;

  const interrogateMutation = trpc.vaka.interrogate.useMutation();

  // Vaka değiştiğinde sorgu odasını, şüpheliyi, mesajları, delilleri ve stres haritasını sıfırla
  useEffect(() => {
    setSelectedSuspectId(vakaCase.suspects[0]?.id || "");
    const map: Record<string, number> = {};
    vakaCase.suspects.forEach((s) => (map[s.id] = 12));
    setStressMap(map);
    setMessages([
      {
        id: `init-${vakaCase.id}-${Date.now()}`,
        sender: "system",
        text: isEn
          ? "Interrogation room prepared. Choose a suspect and use questions, evidence confrontation, cross-examination, silence or bluffs to break them."
          : "Sorgu odası hazırlandı. Bir şüpheli seçin; sorular, delil yüzleştirme, çapraz sorgu, sessizlik veya blöf ile baskı kurarak çözün.",
        timestamp: Date.now(),
      },
    ]);
    setInputText("");
    setSelectedClueId("");
    setCrossSuspectId("");
    setSolved(false);
    setVerdictText(null);
    setActiveActionTab("chips");
  }, [vakaCase.id, locale]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const dispatchAction = async (
    actionType: "question" | "present_evidence" | "cross_examine" | "stay_silent" | "bluff",
    customPayload?: {
      question?: string;
      clueId?: string;
      crossId?: string;
    }
  ) => {
    if (interrogateMutation.isPending || solved) return;

    let userDisplayText = "";
    const clueId = customPayload?.clueId || (actionType === "present_evidence" ? selectedClueId : undefined);
    const crossId = customPayload?.crossId || (actionType === "cross_examine" ? crossSuspectId : undefined);
    const qText = customPayload?.question || inputText.trim();

    if (actionType === "question") {
      if (!qText) return;
      userDisplayText = qText;
    } else if (actionType === "present_evidence") {
      if (!clueId) {
        alert(isEn ? "Select a piece of evidence first!" : "Önce yüzleştireceğiniz delili seçin!");
        return;
      }
      const cObj = vakaCase.clues.find((c) => c.id === clueId);
      userDisplayText = isEn
        ? `[CONFRONT WITH EVIDENCE: ${cObj?.labelEn}] Explain this immediately!`
        : `[DELİLLE YÜZLEŞTİRME: ${cObj?.label}] Derhal bunu açıkla!`;
    } else if (actionType === "cross_examine") {
      if (!crossId) {
        alert(isEn ? "Select the other suspect to quote!" : "İfadesini yüzleştireceğiniz diğer şüpheliyi seçin!");
        return;
      }
      const other = vakaCase.suspects.find((s) => s.id === crossId);
      userDisplayText = isEn
        ? `[CROSS-EXAMINATION] ${other?.name} told me your alibi is completely fake!`
        : `[ÇAPRAZ SORGU] ${other?.name} bana senin alibinin tamamen yalan olduğunu söyledi!`;
    } else if (actionType === "stay_silent") {
      userDisplayText = isEn
        ? "[DETECTIVE STARES IN UTTER SILENCE] (Applying psychological pressure...)"
        : "[DEDEKTİF SESSİZCE GÖZLERİNİN İÇİNE BAKIYOR] (Psikolojik baskı kuruluyor...)";
    } else if (actionType === "bluff") {
      userDisplayText = isEn
        ? "[TACTICAL BLUFF] We already pulled the security surveillance footage that places you there!"
        : "[TAKTİKSEL BLÖF] O saatte orada olduğunu gösteren gizli kamera kayıtları elimizde!";
    }

    setInputText("");
    setSelectedClueId("");
    setCrossSuspectId("");

    const userMsg: VakaInterrogationMessage = {
      id: `usr-${Date.now()}`,
      sender: "detective",
      text: userDisplayText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const history = messages
        .filter((m) => m.sender === "detective" || m.sender === "suspect")
        .slice(-4)
        .map((m) => ({
          role: m.sender === "detective" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        }));

      const res = await interrogateMutation.mutateAsync({
        caseId: vakaCase.id,
        suspectId: selectedSuspectId,
        actionType,
        question: qText || undefined,
        presentedClueId: clueId,
        crossSuspectId: crossId,
        currentStress,
        locale: isEn ? "en" : "tr",
        history,
      });

      setStressMap((prev) => ({
        ...prev,
        [selectedSuspectId]: res.stress,
      }));

      const suspectMsg: VakaInterrogationMessage = {
        id: `susp-${Date.now()}`,
        sender: "suspect",
        text: res.reply,
        behavioralCue: res.behavioralCue,
        stressChange: res.stressDelta,
        currentStress: res.stress,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, suspectMsg]);

      if (res.confessed) {
        playContradiction(soundOn);
        setSolved(true);
        setVerdictText(
          isEn
            ? `BREAKING POINT CONFESSION! ${activeSuspect.name} broke down under relentless pressure and confessed to the crime! You can now take them to court.`
            : `KIRILMA NOKTASI İTİRAFI! ${activeSuspect.name} aralıksız baskıya dayanamayarak suçunu itiraf etti! Artık resmi mahkemeye sevk edebilirsiniz.`
        );
      } else if (res.stressDelta > 15) {
        playContradiction(soundOn);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "suspect",
          text: isEn ? "(Clenches jaw and refuses to reply)" : "(Çenesini sıkıp yanıt vermeyi reddediyor)",
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const getStressColor = (val: number) => {
    if (val >= 75) return "#ef4444";
    if (val >= 40) return "#f59e0b";
    return "#10b981";
  };

  const quickPrompts = isEn
    ? [
        "Where exactly were you at the time of the incident?",
        "What was your financial or personal conflict with the victim?",
        "Someone saw you tampering with evidence, explain that!",
        "Are you covering for an accomplice or lying for yourself?",
      ]
    : [
        "Olay saatinde tam olarak neredeydin?",
        "Kurbanla arandaki maddi ya da kişisel husumet neydi?",
        "Olay yerinde delillerle oynarken görüldün, bunu açıkla!",
        "Bir suç ortağını mı koruyorsun yoksa kendin için mi yalan söylüyorsun?",
      ];

  return (
    <div className="vaka-interrogation-desk">
      {/* Şüpheli Seçim Şeridi */}
      <div className="vaka-suspect-tabs">
        {vakaCase.suspects.map((suspect) => {
          const sStress = stressMap[suspect.id] || 12;
          const isSelected = suspect.id === selectedSuspectId;
          return (
            <button
              key={suspect.id}
              type="button"
              className={`vaka-suspect-tab ${isSelected ? "is-active" : ""}`}
              onClick={() => setSelectedSuspectId(suspect.id)}
            >
              <div className="vaka-tab-avatar">{suspect.name.charAt(0)}</div>
              <div className="vaka-tab-info">
                <span className="vaka-tab-name">{suspect.name}</span>
                <span className="vaka-tab-role">{isEn ? suspect.roleEn : suspect.role}</span>
                <span className="vaka-tab-temp">{isEn ? suspect.temperamentEn : suspect.temperament}</span>
              </div>
              <div className="vaka-tab-stress-indicator" style={{ backgroundColor: getStressColor(sStress) }}>
                %{sStress}
              </div>
            </button>
          );
        })}
      </div>

      {/* Psikolojik Baskı Paneli */}
      <div className="vaka-pressure-panel">
        <div className="vaka-pressure-header">
          <div className="vaka-pressure-title">
            <span>{isEn ? "INTERROGATION ROOM:" : "SORGU ODASI:"} <b>{activeSuspect.name}</b></span>
            <small>{isEn ? activeSuspect.relationshipToVictimEn : activeSuspect.relationshipToVictim}</small>
          </div>
          <b style={{ color: getStressColor(currentStress) }}>
            {currentStress >= 75
              ? (isEn ? "CRACKING UNDER PRESSURE" : "KIRILMA NOKTASINDA")
              : currentStress >= 40
              ? (isEn ? "NERVOUS & DEFENSIVE" : "HUZURSUZ / DEFANSİF")
              : (isEn ? "COMPOSED & GUARDED" : "SAKİN / KONTROLLÜ")}
            {" "}(%{currentStress})
          </b>
        </div>
        <div className="vaka-stress-bar-track">
          <div
            className="vaka-stress-bar-fill"
            style={{
              width: `${currentStress}%`,
              backgroundColor: getStressColor(currentStress),
            }}
          />
        </div>
      </div>

      {/* İtiraf Rozeti */}
      {verdictText && (
        <div className="vaka-confession-banner">
          <h3>{isEn ? "BREAKING POINT REACHED!" : "KIRILMA NOKTASINA ULAŞILDI!"}</h3>
          <p>{verdictText}</p>
          <button
            type="button"
            className="vaka-indict-now-btn"
            onClick={() => onOpenVerdict(selectedSuspectId)}
          >
            🏛️ {isEn ? "PROCEED TO FORMAL INDICTMENT" : "RESMİ MAHKEME SUÇLAMASINA GEÇ"}
          </button>
        </div>
      )}



      {/* Sohbet / Tutanak Akışı */}
      <div className="vaka-chat-transcript">
        {messages.map((msg) => (
          <div key={msg.id} className={`vaka-chat-bubble is-${msg.sender}`}>
            <div className="vaka-bubble-meta">
              <b>
                {msg.sender === "detective"
                  ? (isEn ? "Detective" : "Dedektif")
                  : msg.sender === "suspect"
                  ? activeSuspect.name
                  : (isEn ? "Stenographer" : "Zabıt")}
              </b>
              {msg.behavioralCue && (
                <span className="vaka-behavioral-cue">👁️ {msg.behavioralCue}</span>
              )}
            </div>
            <p>{msg.text}</p>
          </div>
        ))}
        {interrogateMutation.isPending && (
          <div className="vaka-chat-bubble is-suspect is-thinking">
            <p>{isEn ? "Suspect is hesitating and shifting posture..." : "Şüpheli tereddüt ediyor ve oturuşunu düzeltiyor..."}</p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Mobil ve Masaüstü Aksiyon Konsolu (Segmented Tab Bar) */}
      {!solved && (
        <div className="vaka-action-console">
          <div className="vaka-action-segmented-bar">
            <button
              type="button"
              className={`vaka-segmented-tab ${activeActionTab === "chips" ? "is-active" : ""}`}
              onClick={() => setActiveActionTab("chips")}
            >
              💬 {isEn ? "Questions" : "Sorular"}
            </button>
            <button
              type="button"
              className={`vaka-segmented-tab ${activeActionTab === "clues" ? "is-active" : ""}`}
              onClick={() => setActiveActionTab("clues")}
            >
              🔍 {isEn ? "Clues" : "Deliller"} ({vakaCase.clues.length})
            </button>
            <button
              type="button"
              className={`vaka-segmented-tab ${activeActionTab === "cross" ? "is-active" : ""}`}
              onClick={() => setActiveActionTab("cross")}
            >
              🗣️ {isEn ? "Cross-Exam" : "Çapraz"}
            </button>
            <button
              type="button"
              className={`vaka-segmented-tab ${activeActionTab === "tactics" ? "is-active" : ""}`}
              onClick={() => setActiveActionTab("tactics")}
            >
              ⚡ {isEn ? "Tactics" : "Taktikler"}
            </button>
          </div>

          <div className="vaka-action-body">
            {/* 1. Hazır Soru Çipleri */}
            {activeActionTab === "chips" && (
              <div className="vaka-quick-chips">
                {quickPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="vaka-chip-btn"
                    disabled={interrogateMutation.isPending}
                    onClick={() => dispatchAction("question", { question: q })}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* 2. Delil Masası */}
            {activeActionTab === "clues" && (
              <div className="vaka-evidence-subpanel">
                <label>{isEn ? "Tap a clue to confront the suspect:" : "Şüpheliyle yüzleştirmek için bir delile dokunun:"}</label>
                <div className="vaka-evidence-pills">
                  {vakaCase.clues.map((clue) => (
                    <button
                      key={clue.id}
                      type="button"
                      className={`vaka-evidence-pill ${selectedClueId === clue.id ? "is-selected" : ""}`}
                      onClick={() => {
                        setSelectedClueId(clue.id);
                        dispatchAction("present_evidence", { clueId: clue.id });
                      }}
                    >
                      🔍 {isEn ? clue.labelEn : clue.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Çapraz Sorgu */}
            {activeActionTab === "cross" && (
              <div className="vaka-cross-subpanel">
                <label>{isEn ? "Quote another suspect's testimony:" : "Diğer şüphelinin ifadesiyle köşeye sıkıştır:"}</label>
                <div className="vaka-cross-pills">
                  {vakaCase.suspects
                    .filter((s) => s.id !== selectedSuspectId)
                    .map((other) => (
                      <button
                        key={other.id}
                        type="button"
                        className="vaka-cross-pill"
                        onClick={() => dispatchAction("cross_examine", { crossId: other.id })}
                      >
                        🗣️ {other.name} ({isEn ? other.roleEn : other.role})
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* 4. Taktikler & Suçlama */}
            {activeActionTab === "tactics" && (
              <div className="vaka-tactical-options">
                <button
                  type="button"
                  className="vaka-tactic-btn"
                  disabled={interrogateMutation.isPending}
                  onClick={() => dispatchAction("stay_silent")}
                >
                  🤫 {isEn ? "Stay Silent (Stare)" : "Sessiz Kal (Baskı Kur)"}
                </button>
                <button
                  type="button"
                  className="vaka-tactic-btn"
                  disabled={interrogateMutation.isPending}
                  onClick={() => dispatchAction("bluff")}
                >
                  🃏 {isEn ? "Tactical Bluff" : "Taktiksel Blöf"}
                </button>
                <button
                  type="button"
                  className="vaka-tactic-btn vaka-tactic-accuse"
                  onClick={() => onOpenVerdict(selectedSuspectId)}
                >
                  🏛️ {isEn ? "Indict in Court" : "Mahkemede Suçla"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Serbest Soru Metin Girişi */}
      {!solved && (
        <div className="vaka-input-row">
          <input
            type="text"
            className="vaka-text-input"
            value={inputText}
            placeholder={
              isEn
                ? "Type a tailored question or choose a tactic above..."
                : "Özel sorunuzu yazın veya yukarıdaki taktiklerden birini seçin..."
            }
            disabled={interrogateMutation.isPending}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") dispatchAction("question");
            }}
          />
          <button
            type="button"
            className="vaka-send-btn"
            disabled={interrogateMutation.isPending || !inputText.trim()}
            onClick={() => dispatchAction("question")}
          >
            {isEn ? "Ask Question" : "Soruyu Sor"}
          </button>
        </div>
      )}

      {/* İtiraf Sonrası Dev İddianame Aksiyon Çubuğu */}
      {solved && (
        <div className="vaka-confession-footer-bar">
          <div className="vaka-confession-footer-info">
            <span>✨ {isEn ? "Suspect has cracked!" : "Şüpheli çözüldü ve teslim oldu!"}</span>
            <p>
              {isEn
                ? "Submit the official four-pillar indictment to finalize the court verdict."
                : "Hükmü kesinleştirmek için 4 ayaklı resmi iddianameyi mahkemeye sunun."}
            </p>
          </div>
          <button
            type="button"
            className="vaka-indict-giant-btn"
            onClick={() => onOpenVerdict(selectedSuspectId)}
          >
            🏛️ {isEn ? "PROCEED TO FORMAL INDICTMENT" : "RESMİ MAHKEME SUÇLAMASINA GEÇ"}
          </button>
        </div>
      )}
    </div>
  );
}
