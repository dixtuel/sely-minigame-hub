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

function getInitialMessagesMap(vakaCase: VakaDetailedCase, isEn: boolean): Record<string, VakaInterrogationMessage[]> {
  const map: Record<string, VakaInterrogationMessage[]> = {};
  vakaCase.suspects.forEach((s) => {
    map[s.id] = [
      {
        id: `init-${vakaCase.id}-${s.id}`,
        sender: "system",
        text: isEn
          ? `Interrogation room prepared for ${s.name} (${s.roleEn || s.role}). Confront with evidence, cross-examine, or question.`
          : `${s.name} (${s.role}) için sorgu odası hazırlandı. Sorular sorabilir, delillerle yüzleştirebilir veya çapraz sorgulayabilirsiniz.`,
        timestamp: Date.now(),
      },
    ];
  });
  return map;
}

export default function VakaInterrogation({
  vakaCase,
  locale,
  soundOn,
  onOpenVerdict,
  onSolved,
}: Props) {
  const isEn = locale === "en";
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>(vakaCase.suspects[0]?.id || "");

  // Şüpheli bazında izole edilmiş mesaj geçmişi (suspectId -> VakaInterrogationMessage[])
  const [suspectMessagesMap, setSuspectMessagesMap] = useState<Record<string, VakaInterrogationMessage[]>>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(`sely_vaka_session_${vakaCase.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.messagesMap && typeof parsed.messagesMap === "object") {
            return parsed.messagesMap;
          }
        }
      }
    } catch {}
    return getInitialMessagesMap(vakaCase, isEn);
  });

  // Şüpheli bazında izole edilmiş stres haritası (suspectId -> number)
  const [stressMap, setStressMap] = useState<Record<string, number>>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(`sely_vaka_session_${vakaCase.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.stressMap && typeof parsed.stressMap === "object") {
            return parsed.stressMap;
          }
        }
      }
    } catch {}
    const map: Record<string, number> = {};
    vakaCase.suspects.forEach((s) => (map[s.id] = 12));
    return map;
  });

  const [inputText, setInputText] = useState("");
  const [selectedClueId, setSelectedClueId] = useState<string>("");
  const [crossSuspectId, setCrossSuspectId] = useState<string>("");
  const [solved, setSolved] = useState(false);
  const [verdictText, setVerdictText] = useState<string | null>(null);
  const [activeActionTab, setActiveActionTab] = useState<"chips" | "clues" | "cross" | "tactics">("chips");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeSuspect = vakaCase.suspects.find((s) => s.id === selectedSuspectId) || vakaCase.suspects[0];
  const currentStress = stressMap[selectedSuspectId] || 12;
  const activeMessages = suspectMessagesMap[selectedSuspectId] || [];

  const interrogateMutation = trpc.vaka.interrogate.useMutation();
  const configQuery = trpc.vaka.config.useQuery();
  const hasLlm = Boolean(configQuery.data?.hasLlmKeys);

  const persistSession = (
    updatedMessages: Record<string, VakaInterrogationMessage[]>,
    updatedStress: Record<string, number>,
    isSolved?: boolean,
    vText?: string | null
  ) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `sely_vaka_session_${vakaCase.id}`,
          JSON.stringify({
            messagesMap: updatedMessages,
            stressMap: updatedStress,
            solved: isSolved !== undefined ? isSolved : solved,
            verdictText: vText !== undefined ? vText : verdictText,
          })
        );
      }
    } catch {}
  };

  // Vaka veya dil değiştiğinde (seviye atlama / günlük değişimi) o vakaya ait izole hafızayı yükle
  useEffect(() => {
    setSelectedSuspectId(vakaCase.suspects[0]?.id || "");
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(`sely_vaka_session_${vakaCase.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.messagesMap && typeof parsed.messagesMap === "object") {
            setSuspectMessagesMap(parsed.messagesMap);
            if (parsed.stressMap && typeof parsed.stressMap === "object") {
              setStressMap(parsed.stressMap);
            }
            if (parsed.solved !== undefined) setSolved(Boolean(parsed.solved));
            if (parsed.verdictText !== undefined) setVerdictText(parsed.verdictText);
            setInputText("");
            setSelectedClueId("");
            setCrossSuspectId("");
            setActiveActionTab("chips");
            return;
          }
        }
      }
    } catch {}

    const map: Record<string, number> = {};
    vakaCase.suspects.forEach((s) => (map[s.id] = 12));
    const initMsgs = getInitialMessagesMap(vakaCase, isEn);
    setStressMap(map);
    setSuspectMessagesMap(initMsgs);
    setInputText("");
    setSelectedClueId("");
    setCrossSuspectId("");
    setSolved(false);
    setVerdictText(null);
    setActiveActionTab("chips");
  }, [vakaCase.id, locale]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, selectedSuspectId]);

  const dispatchAction = async (
    actionType: "question" | "present_evidence" | "cross_examine" | "stay_silent" | "bluff",
    customPayload?: {
      question?: string;
      clueId?: string;
      crossId?: string;
    }
  ) => {
    if (interrogateMutation.isPending || solved) return;

    const clueId = customPayload?.clueId || (actionType === "present_evidence" ? selectedClueId : undefined);
    const crossId = customPayload?.crossId || (actionType === "cross_examine" ? crossSuspectId : undefined);
    const qText = customPayload?.question || (actionType === "question" ? inputText.trim() : undefined);

    let userDisplayText = qText || "";

    const currentSuspectMsgs = suspectMessagesMap[selectedSuspectId] || [];

    if (actionType === "present_evidence") {
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
        ? `[CROSS-EXAMINATION] ${other?.name} told me your statements and defenses are completely fabricated!`
        : `[ÇAPRAZ SORGU] ${other?.name} bana senin ifadelerinin ve savunmanın tamamen yalan olduğunu söyledi!`;
    } else if (actionType === "stay_silent") {
      const silentCount = currentSuspectMsgs.filter((m) => m.text.includes("SESSİZ") || m.text.includes("SILEN")).length;
      const silentVariationsTr = [
        "[SESSİZLİK & BASKI] Dedektif kollarını kavuşturup doğrudan şüphelinin gözlerinin içine bakıyor.",
        "[SESSİZLİK & BASKI] Dedektif parmaklarını yavaşça masaya vurarak gerilimli sessizliği uzatıyor...",
        "[SESSİZLİK & BASKI] Dedektif hiçbir şey söylemeden şüpheliyi soğukça süzüyor.",
      ];
      const silentVariationsEn = [
        "[SILENCE & PRESSURE] Detective crosses arms and maintains unbroken eye contact.",
        "[SILENCE & PRESSURE] Detective taps slowly on the desk, letting the tension mount...",
        "[SILENCE & PRESSURE] Detective remains completely silent, measuring the suspect's breathing.",
      ];
      userDisplayText = isEn
        ? silentVariationsEn[silentCount % silentVariationsEn.length]
        : silentVariationsTr[silentCount % silentVariationsTr.length];
    } else if (actionType === "bluff") {
      const bluffCount = currentSuspectMsgs.filter((m) => m.text.includes("BLÖF") || m.text.includes("BLUFF")).length;
      const bluffVariationsTr = [
        "[TAKTİKSEL BLÖF] O saatte orada olduğunu gösteren gizli kamera kayıtları elimizde!",
        "[TAKTİKSEL BLÖF] Telefonunun olay yerindeki baz istasyonundan sinyal verdiği kesinleşti!",
        "[TAKTİKSEL BLÖF] Adli tıp kurbanın kıyafetlerinde senin parmak izlerini ve DNA izlerini buldu!",
      ];
      const bluffVariationsEn = [
        "[TACTICAL BLUFF] We already pulled the security surveillance footage that places you there!",
        "[TACTICAL BLUFF] Cell tower triangulation places your phone right at the murder scene!",
        "[TACTICAL BLUFF] Forensics recovered your fingerprints and DNA from the victim's jacket!",
      ];
      userDisplayText = isEn
        ? bluffVariationsEn[bluffCount % bluffVariationsEn.length]
        : bluffVariationsTr[bluffCount % bluffVariationsTr.length];
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

    // Sadece aktif şüphelinin geçmişine ekle
    const newSuspectMsgs = [...currentSuspectMsgs, userMsg];
    const mapWithUser = {
      ...suspectMessagesMap,
      [selectedSuspectId]: newSuspectMsgs,
    };
    setSuspectMessagesMap(mapWithUser);
    persistSession(mapWithUser, stressMap);

    try {
      // YALNIZCA bu şüpheliyle yapılan diyalog geçmişini gönder (izole ve temiz)
      const history = newSuspectMsgs
        .filter((m) => m.sender === "detective" || m.sender === "suspect")
        .slice(-8)
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

      const updatedStressMap = {
        ...stressMap,
        [selectedSuspectId]: res.stress,
      };
      setStressMap(updatedStressMap);

      const suspectMsg: VakaInterrogationMessage = {
        id: `susp-${Date.now()}`,
        sender: "suspect",
        text: res.reply,
        behavioralCue: res.behavioralCue,
        stressChange: res.stressDelta,
        currentStress: res.stress,
        timestamp: Date.now(),
      };

      const finalSuspectMsgs = [...newSuspectMsgs, suspectMsg];
      const finalMap = {
        ...mapWithUser,
        [selectedSuspectId]: finalSuspectMsgs,
      };
      setSuspectMessagesMap(finalMap);

      const isConfessed = res.confessed;
      const vText = isConfessed
        ? isEn
          ? `BREAKING POINT CONFESSION! ${activeSuspect.name} broke down under relentless pressure and confessed to the crime! You can now take them to court.`
          : `KIRILMA NOKTASI İTİRAFI! ${activeSuspect.name} aralıksız baskıya dayanamayarak suçunu itiraf etti! Artık resmi mahkemeye sevk edebilirsiniz.`
        : verdictText;

      if (isConfessed) {
        playContradiction(soundOn);
        setSolved(true);
        setVerdictText(vText);
      } else if (res.stressDelta > 15) {
        playContradiction(soundOn);
      }

      persistSession(finalMap, updatedStressMap, isConfessed || solved, vText);
    } catch {
      const errorMsg: VakaInterrogationMessage = {
        id: `err-${Date.now()}`,
        sender: "suspect",
        text: isEn ? "(Clenches jaw and refuses to reply)" : "(Çenesini sıkıp yanıt vermeyi reddediyor)",
        timestamp: Date.now(),
      };
      const errorSuspectMsgs = [...newSuspectMsgs, errorMsg];
      const errorMap = {
        ...mapWithUser,
        [selectedSuspectId]: errorSuspectMsgs,
      };
      setSuspectMessagesMap(errorMap);
      persistSession(errorMap, stressMap);
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
        {activeMessages.map((msg) => (
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

      {/* Serbest Soru Metin Girişi - Yalnızca AI anahtarları mevcutken aktif */}
      {!solved && hasLlm && (
        <div className="vaka-input-row">
          <input
            type="text"
            className="vaka-text-input"
            value={inputText}
            placeholder={
              isEn
                ? "Type a tailored question to interrogate via AI..."
                : "Yapay zekâ ile şüpheliye özel sorunuzu yöneltin..."
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

      {!solved && !hasLlm && (
        <div className="vaka-ai-gated-banner">
          <span>⚖️</span>
          <p>
            {isEn
              ? "Tactical interrogation mode: Use the panels above (Prepared Questions, Evidence, Cross-Exam, and Tactics) to break the suspect."
              : "Taktiksel sorgu modu: Şüpheliyi çözmek için yukarıdaki panelleri (Hazır Sorular, Deliller, Çapraz Sorgu ve Taktikler) kullanın."}
          </p>
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
