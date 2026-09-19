import { useState, useRef, useEffect } from "react";
import type { VakaDetailedCase, VakaSuspect, VakaInterrogationMessage } from "@shared/vakaTypes";
import type { SiteLocale } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { playAccuse, playContradiction, playHit } from "@/lib/sfx";
import { secureStorage } from "@/lib/secureStorage";

type Props = {
  vakaCase: VakaDetailedCase;
  locale: SiteLocale;
  soundOn: boolean;
  onOpenVerdict: (accusedId: string) => void;
  onSolved?: (score: number) => void;
  isCaseSolved?: boolean;
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
  isCaseSolved,
  onOpenVerdict,
  onSolved,
}: Props) {
  const isEn = locale === "en";
  // Açılmış şüphelilerin haritası (suspectId -> boolean)
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window !== "undefined") {
        return secureStorage.getJSON(`sely_vaka_unlocked_${vakaCase.id}`, {});
      }
    } catch {}
    return {};
  });

  // Açılmış tanık delillerinin haritası (clueId -> boolean)
  const [unlockedCluesMap, setUnlockedCluesMap] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window !== "undefined") {
        return secureStorage.getJSON(`sely_vaka_unlocked_clues_${vakaCase.id}`, {});
      }
    } catch {}
    return {};
  });

  const [newlyUnlockedClueToast, setNewlyUnlockedClueToast] = useState<{ id: string; label: string } | null>(null);

  const triggerClueUnlock = (clueId: string, clueLabel?: string) => {
    const targetClue = vakaCase.clues.find((c) => c.id === clueId);
    const label = clueLabel || (targetClue ? (isEn ? targetClue.labelEn : targetClue.label) : clueId);

    setUnlockedCluesMap((prev) => {
      const updated = { ...prev, [clueId]: true };
      try {
        if (typeof window !== "undefined") {
          secureStorage.setJSON(`sely_vaka_unlocked_clues_${vakaCase.id}`, updated);
        }
      } catch {}
      return updated;
    });

    setNewlyUnlockedClueToast({
      id: clueId,
      label,
    });
  };

  const isSuspectUnlocked = (s: VakaSuspect) => {
    if (!s.isInitiallyLocked) return true;
    return Boolean(unlockedMap[s.id]);
  };

  const visibleSuspects = vakaCase.suspects.filter(isSuspectUnlocked);

  const [newlyUnlockedToast, setNewlyUnlockedToast] = useState<{ id: string; name: string; role: string } | null>(null);

  const triggerUnlock = (suspectId: string, suspectName?: string) => {
    if (unlockedMap[suspectId]) return;
    const target = vakaCase.suspects.find((s) => s.id === suspectId);
    if (!target) return;

    playContradiction(soundOn);
    setUnlockedMap((prev) => {
      const updated = { ...prev, [suspectId]: true };
      try {
        if (typeof window !== "undefined") {
          secureStorage.setJSON(`sely_vaka_unlocked_${vakaCase.id}`, updated);
        }
      } catch {}
      return updated;
    });

    setNewlyUnlockedToast({
      id: target.id,
      name: suspectName || target.name,
      role: isEn ? target.roleEn || target.role : target.role,
    });
  };

  const checkClientKeywordUnlock = (text: string) => {
    const textLower = text.toLowerCase();
    vakaCase.suspects.forEach((s) => {
      if (s.isInitiallyLocked && !unlockedMap[s.id] && s.unlockCondition) {
        if (s.unlockCondition.triggerSuspectId && s.unlockCondition.triggerSuspectId !== selectedSuspectId) {
          return;
        }
        if (s.unlockCondition.keywords.some((kw) => textLower.includes(kw.toLowerCase()))) {
          triggerUnlock(s.id, s.name);
        }
      }
    });
  };

  const initialSuspect = visibleSuspects[0] || vakaCase.suspects[0];
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>(initialSuspect?.id || "");

  // Şüpheli bazında izole edilmiş mesaj geçmişi (suspectId -> VakaInterrogationMessage[])
  const [suspectMessagesMap, setSuspectMessagesMap] = useState<Record<string, VakaInterrogationMessage[]>>(() => {
    try {
      if (typeof window !== "undefined") {
        const parsed = secureStorage.getJSON<any>(`sely_vaka_session_${vakaCase.id}`, null);
        if (parsed && parsed.messagesMap && typeof parsed.messagesMap === "object") {
          return parsed.messagesMap;
        }
      }
    } catch {}
    return getInitialMessagesMap(vakaCase, isEn);
  });

  // Şüpheli bazında izole edilmiş stres haritası (suspectId -> number)
  const [stressMap, setStressMap] = useState<Record<string, number>>(() => {
    try {
      if (typeof window !== "undefined") {
        const parsed = secureStorage.getJSON<any>(`sely_vaka_session_${vakaCase.id}`, null);
        if (parsed && parsed.stressMap && typeof parsed.stressMap === "object") {
          return parsed.stressMap;
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
  const configQuery = trpc.vaka.config.useQuery(undefined, { staleTime: Infinity, refetchOnWindowFocus: false });
  const hasLlm = Boolean(configQuery.data?.hasLlmKeys);

  const persistSession = (
    updatedMessages: Record<string, VakaInterrogationMessage[]>,
    updatedStress: Record<string, number>,
    isSolved?: boolean,
    vText?: string | null
  ) => {
    try {
      if (typeof window !== "undefined") {
        secureStorage.setJSON(`sely_vaka_session_${vakaCase.id}`, {
          messagesMap: updatedMessages,
          stressMap: updatedStress,
          solved: isSolved !== undefined ? isSolved : solved,
          verdictText: vText !== undefined ? vText : verdictText,
        });
      }
    } catch {}
  };

function cleanInterrogationText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^\[(TAKTİKSEL BLÖF|TACTICAL BLUFF|SESSİZLİK & BASKI|SILENCE & PRESSURE|ÇAPRAZ SORGU|CROSS-EXAM|DELİLLE YÜZLEŞTİRME|CONFRONT WITH EVIDENCE)\]\s*/i, "")
    .replace(/\[(TAKTİKSEL BLÖF|TACTICAL BLUFF|SESSİZLİK & BASKI|SILENCE & PRESSURE|ÇAPRAZ SORGU|CROSS-EXAM|DELİLLE YÜZLEŞTİRME|CONFRONT WITH EVIDENCE)\]/gi, "")
    .trim();
}

  // Çelişki Avı'nda yakalanan şüphelilerin haritası
  const [exposedMap, setExposedMap] = useState<
    Record<string, { sentenceId: string; clueId: string; explanation?: string; timestamp?: number }>
  >({});

  // Vaka veya dil değiştiğinde (seviye atlama / günlük değişimi) o vakaya ait izole hafızayı yükle
  useEffect(() => {
    setSelectedSuspectId(vakaCase.suspects[0]?.id || "");

    // Çelişki Avı tespiti kontrolü
    try {
      if (typeof window !== "undefined") {
        setExposedMap(secureStorage.getJSON(`sely_vaka_exposed_${vakaCase.id}`, {}));
      }
    } catch {}

    try {
      if (typeof window !== "undefined") {
        const parsed = secureStorage.getJSON<any>(`sely_vaka_session_${vakaCase.id}`, null);
        if (parsed) {
          if (parsed.messagesMap && typeof parsed.messagesMap === "object") {
            // Eski oturumlardaki yapay [TAKTİKSEL BLÖF] vb. etiketleri temizleyip rozete dönüştür
            const cleanedMap: Record<string, VakaInterrogationMessage[]> = {};
            for (const [sId, msgs] of Object.entries(parsed.messagesMap)) {
              if (Array.isArray(msgs)) {
                cleanedMap[sId] = msgs.map((m: VakaInterrogationMessage) => {
                  let badge = m.actionBadge;
                  if (!badge && m.text) {
                    if (m.text.includes("BLÖF") || m.text.includes("BLUFF")) badge = isEn ? "BLUFF" : "BLÖF";
                    else if (m.text.includes("SESSİZ") || m.text.includes("SILEN")) badge = isEn ? "SILENCE" : "SESSİZLİK";
                    else if (m.text.includes("ÇAPRAZ") || m.text.includes("CROSS")) badge = isEn ? "CROSS-EXAM" : "ÇAPRAZ SORGU";
                    else if (m.text.includes("DELİL") || m.text.includes("EVIDENCE")) badge = isEn ? "EVIDENCE" : "DELİL";
                  }
                  return {
                    ...m,
                    text: cleanInterrogationText(m.text),
                    actionBadge: badge,
                  };
                });
              }
            }

            setSuspectMessagesMap(cleanedMap);
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
      crossMode?: "ask_about" | "confront";
    }
  ) => {
    if (interrogateMutation.isPending || solved || isCaseSolved) return;

    const clueId = customPayload?.clueId || (actionType === "present_evidence" ? selectedClueId : undefined);
    const crossId = customPayload?.crossId || (actionType === "cross_examine" ? crossSuspectId : undefined);
    const crossMode = customPayload?.crossMode || (actionType === "cross_examine" ? "confront" : undefined);
    const qText = customPayload?.question || (actionType === "question" ? inputText.trim() : undefined);

    let userDisplayText = qText || "";
    let actionBadge: string | undefined = undefined;

    const currentSuspectMsgs = suspectMessagesMap[selectedSuspectId] || [];

    if (actionType === "present_evidence") {
      if (!clueId) {
        alert(isEn ? "Select a piece of evidence first!" : "Önce yüzleştireceğiniz delili seçin!");
        return;
      }
      const cObj = vakaCase.clues.find((c) => c.id === clueId);
      actionBadge = isEn ? "EVIDENCE" : "DELİL";
      userDisplayText = cObj
        ? isEn
          ? `Take a look at this ${cObj.labelEn}. Explain this immediately!`
          : `Önüne şu delili koyuyorum: ${cObj.label}. Bunu derhal açıkla!`
        : (isEn ? "Explain this evidence!" : "Bu delili açıkla!");
    } else if (actionType === "cross_examine") {
      if (!crossId) {
        alert(isEn ? "Select the other suspect to quote!" : "İfadesini yüzleştireceğiniz diğer şüpheliyi seçin!");
        return;
      }
      const other = vakaCase.suspects.find((s) => s.id === crossId);
      const otherName = other?.name || (isEn ? "The other suspect" : "Diğer şüpheli");
      actionBadge = isEn ? "CROSS-EXAM" : "ÇAPRAZ SORGU";

      if (crossMode === "ask_about") {
        userDisplayText = isEn
          ? `What can you tell me about ${otherName}? Did you notice anything suspicious about them that night?`
          : `${otherName} hakkında ne biliyorsun? O gece onunla ilgili şüpheli bir şey gördün mü?`;
      } else {
        userDisplayText = isEn
          ? `${otherName} claims you were lying about your whereabouts and saw you near the scene! How do you explain that?!`
          : `${otherName} senin olay anında yalan söylediğini ve suç mahallinin yakınında olduğunu anlattı! Buna ne diyeceksin?!`;
      }
    } else if (actionType === "stay_silent") {
      actionBadge = isEn ? "SILENCE" : "SESSİZLİK";
      const silentCount = currentSuspectMsgs.filter(
        (m) => m.actionType === "stay_silent" || m.text.includes("sessizliği") || m.text.includes("silent")
      ).length;
      const silentVariationsTr = [
        "(Dedektif kollarını kavuşturup doğrudan şüphelinin gözlerinin içine bakıyor.)",
        "(Dedektif parmaklarını yavaşça masaya vurarak gerilimli sessizliği uzatıyor...)",
        "(Dedektif hiçbir şey söylemeden şüpheliyi soğukça süzüyor.)",
      ];
      const silentVariationsEn = [
        "(Detective crosses arms and maintains unbroken eye contact.)",
        "(Detective taps slowly on the desk, letting the tension mount...)",
        "(Detective remains completely silent, measuring the suspect's breathing.)",
      ];
      userDisplayText = isEn
        ? silentVariationsEn[silentCount % silentVariationsEn.length]
        : silentVariationsTr[silentCount % silentVariationsTr.length];
    } else if (actionType === "bluff") {
      actionBadge = isEn ? "BLUFF" : "BLÖF";
      const bluffCount = currentSuspectMsgs.filter(
        (m) => m.actionType === "bluff" || m.text.includes("kamera") || m.text.includes("surveillance")
      ).length;
      const bluffVariationsTr = [
        "O saatte orada olduğunu gösteren gizli kamera kayıtları elimizde!",
        "Telefonunun olay yerindeki baz istasyonundan sinyal verdiği kesinleşti!",
        "Adli tıp kurbanın kıyafetlerinde senin parmak izlerini ve DNA izlerini buldu!",
      ];
      const bluffVariationsEn = [
        "We already pulled the security surveillance footage that places you there!",
        "Cell tower triangulation places your phone right at the murder scene!",
        "Forensics recovered your fingerprints and DNA from the victim's jacket!",
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
      actionType,
      actionBadge,
      crossSuspectId: crossId,
      crossMode,
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
      // Çelişki Avı tespiti var mı kontrol et
      let isExposed = false;
      let expSentenceId: string | undefined;
      let expClueId: string | undefined;
      if (exposedMap && exposedMap[selectedSuspectId]) {
        isExposed = true;
        expSentenceId = exposedMap[selectedSuspectId].sentenceId;
        expClueId = exposedMap[selectedSuspectId].clueId;
      }

      // YALNIZCA bu şüpheliyle yapılan diyalog geçmişini gönder (izole ve temiz)
      const history = newSuspectMsgs
        .filter((m) => m.sender === "detective" || m.sender === "suspect")
        .slice(-8)
        .map((m) => ({
          role: m.sender === "detective" ? ("user" as const) : ("assistant" as const),
          content: cleanInterrogationText(m.text),
          actionType: m.actionType,
        }));

      const res = await interrogateMutation.mutateAsync({
        caseId: vakaCase.id,
        suspectId: selectedSuspectId,
        actionType,
        question: userDisplayText || undefined,
        presentedClueId: clueId,
        crossSuspectId: crossId,
        crossMode,
        isExposedByContradiction: isExposed,
        exposedSentenceId: expSentenceId,
        exposedClueId: expClueId,
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

      if (res.unlockedSuspectId) {
        triggerUnlock(res.unlockedSuspectId, res.unlockedSuspectName);
      } else {
        checkClientKeywordUnlock(res.reply);
      }

      if (res.unlockedClueId) {
        triggerClueUnlock(res.unlockedClueId, (res as any).unlockedClueLabel);
      }

      if (isConfessed) {
        playContradiction(soundOn);
        setSolved(true);
        setVerdictText(vText);
      } else if (res.stressDelta > 15 || res.unlockedClueId) {
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
    if (val >= 65) return "#ef4444";
    if (val >= 30) return "#f59e0b";
    return "#10b981";
  };

  const quickPrompts = isEn
    ? [
        ...(activeSuspect.alibiDenial ? ["They claim you were together at the time of the incident, is that true?"] : []),
        "Where exactly were you at the time of the incident?",
        "What was your financial or personal conflict with the victim?",
        "Someone saw you tampering with evidence, explain that!",
        "Are you covering for an accomplice or lying for yourself?",
      ]
    : [
        ...(activeSuspect.alibiDenial ? ["Olay anında seninle birlikte olduğunu iddia ediyorlar, doğru mu?"] : []),
        "Olay saatinde tam olarak neredeydin?",
        "Kurbanla arandaki maddi ya da kişisel husumet neydi?",
        "Olay yerinde delillerle oynarken görüldün, bunu açıkla!",
        "Bir suç ortağını mı koruyorsun yoksa kendin için mi yalan söylüyorsun?",
      ];

  return (
    <div className="vaka-interrogation-desk">
      {/* Yeni Şüpheli Keşfedildi Banner */}
      {newlyUnlockedToast && (
        <div className="vaka-unlock-banner">
          <div className="vaka-unlock-banner-content">
            <span className="vaka-unlock-icon">✨</span>
            <div>
              <b>{isEn ? "NEW SUSPECT / WITNESS UNLOCKED:" : "YENİ ŞÜPHELİ / İLGİLİ KİŞİ KEŞFEDİLDİ:"} {newlyUnlockedToast.name} ({newlyUnlockedToast.role})</b>
              <p>{isEn ? "Testimony or alibi mention added them to the investigation. You can now interrogate and cross-examine them." : "Sorgudaki temas üzerine soruşturmaya dahil edildi. Artık sorgulanabilir ve çapraz sorguya çekilebilir."}</p>
            </div>
          </div>
          <div className="vaka-unlock-banner-actions">
            <button
              type="button"
              className="vaka-unlock-switch-btn"
              onClick={() => {
                setSelectedSuspectId(newlyUnlockedToast.id);
                setNewlyUnlockedToast(null);
              }}
            >
              🎙️ {isEn ? "Interrogate Now" : "Hemen Sorgula"}
            </button>
            <button
              type="button"
              className="vaka-unlock-dismiss-btn"
              onClick={() => setNewlyUnlockedToast(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Yeni Resmi İfade Tutanağı Eklendi Banner */}
      {newlyUnlockedClueToast && (
        <div className="vaka-unlock-banner vaka-clue-unlock-banner">
          <div className="vaka-unlock-banner-content">
            <span className="vaka-unlock-icon">📜</span>
            <div>
              <b>{isEn ? "NEW OFFICIAL TESTIMONY RECORDED:" : "YENİ RESMİ İFADE TUTANAĞI EKLENDİ:"} {newlyUnlockedClueToast.label}</b>
              <p>{isEn ? "The witness officially denied the suspect's claim. This sworn testimony is now registered in your clues to confront the culprit." : "Tanık, şüphelinin mazeretini resmi tutanakla yalanladı. Bu ifade delillerinize eklendi, artık katili köşeye sıkıştırmak için kullanabilirsiniz."}</p>
            </div>
          </div>
          <div className="vaka-unlock-banner-actions">
            <button
              type="button"
              className="vaka-unlock-switch-btn"
              onClick={() => {
                setActiveActionTab("clues");
                setSelectedClueId(newlyUnlockedClueToast.id);
                setNewlyUnlockedClueToast(null);
              }}
            >
              🔍 {isEn ? "Inspect Clue" : "Delili İncele"}
            </button>
            <button
              type="button"
              className="vaka-unlock-dismiss-btn"
              onClick={() => setNewlyUnlockedClueToast(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Şüpheli Seçim Şeridi */}
      <div className="vaka-suspect-tabs">
        {visibleSuspects.map((suspect) => {
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
            {currentStress >= 65
              ? (isEn ? "CRACKING UNDER PRESSURE" : "KIRILMA NOKTASINDA")
              : currentStress >= 30
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

        {/* Çelişki Avı Tespiti Rozeti (Katilin yalanı yakalandığında görünür) */}
        {exposedMap[selectedSuspectId] && (
          <div className="vaka-exposed-badge-banner">
            <span>⚖️ {isEn ? "OFFICIAL CONTRADICTION EXPOSED IN COURT" : "RESMİ TUTANAKTA ÇELİŞKİSİ YAKALANDI"}</span>
            <small>{exposedMap[selectedSuspectId].explanation}</small>
          </div>
        )}
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
              {msg.actionBadge && (
                <span className={`vaka-action-badge badge-${msg.actionType || "tactic"}`}>
                  {msg.actionBadge}
                </span>
              )}
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
                  {vakaCase.clues.map((clue) => {
                    const isNew = Boolean(unlockedCluesMap[clue.id]);
                    return (
                      <button
                        key={clue.id}
                        type="button"
                        className={`vaka-evidence-pill ${selectedClueId === clue.id ? "is-selected" : ""} ${isNew ? "is-new-evidence" : ""}`}
                        onClick={() => {
                          setSelectedClueId(clue.id);
                          dispatchAction("present_evidence", { clueId: clue.id });
                        }}
                      >
                        {clue.category === "witness" ? "📜" : "🔍"} {isEn ? clue.labelEn : clue.label}
                        {isNew && (
                          <span
                            className="vaka-new-clue-badge"
                            style={{
                              marginLeft: 6,
                              fontSize: "0.7rem",
                              background: "#f59e0b",
                              color: "#000",
                              padding: "1px 6px",
                              borderRadius: 4,
                              fontWeight: 700,
                              letterSpacing: "0.5px"
                            }}
                          >
                            {isEn ? "TESTIMONY" : "İFADE"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Çapraz Sorgu & Dedikodu */}
            {activeActionTab === "cross" && (
              <div className="vaka-cross-subpanel">
                <label>
                  {isEn
                    ? "Cross-examine using other suspects' relations and gossip:"
                    : "Diğer şüphelilerle ilgili bilgi topla veya ifadelerini yüzleştir:"}
                </label>
                <div className="vaka-cross-list">
                  {visibleSuspects
                    .filter((s) => s.id !== selectedSuspectId)
                    .map((other) => (
                      <div key={other.id} className="vaka-cross-card-row">
                        <div className="vaka-cross-card-info">
                          <b>🗣️ {other.name}</b>
                          <small>{isEn ? other.roleEn : other.role}</small>
                        </div>
                        <div className="vaka-cross-card-actions">
                          <button
                            type="button"
                            className="vaka-cross-action-btn btn-ask"
                            disabled={interrogateMutation.isPending}
                            onClick={() =>
                              dispatchAction("cross_examine", { crossId: other.id, crossMode: "ask_about" })
                            }
                          >
                            💬 {isEn ? "Ask About" : "Dedikodu Sor"}
                          </button>
                          <button
                            type="button"
                            className="vaka-cross-action-btn btn-confront"
                            disabled={interrogateMutation.isPending}
                            onClick={() =>
                              dispatchAction("cross_examine", { crossId: other.id, crossMode: "confront" })
                            }
                          >
                            ⚡ {isEn ? "Confront" : "İfadeyi Yüzüne Çarp"}
                          </button>
                        </div>
                      </div>
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
                  disabled={Boolean(isCaseSolved) || interrogateMutation.isPending}
                  onClick={() => dispatchAction("stay_silent")}
                >
                  🤫 {isEn ? "Stay Silent (Stare)" : "Sessiz Kal (Baskı Kur)"}
                </button>
                <button
                  type="button"
                  className="vaka-tactic-btn"
                  disabled={Boolean(isCaseSolved) || interrogateMutation.isPending}
                  onClick={() => dispatchAction("bluff")}
                >
                  🃏 {isEn ? "Tactical Bluff" : "Taktiksel Blöf"}
                </button>
                <button
                  type="button"
                  className={`vaka-tactic-btn vaka-tactic-accuse ${isCaseSolved ? "is-disabled" : ""}`}
                  disabled={Boolean(isCaseSolved)}
                  onClick={() => !isCaseSolved && onOpenVerdict(selectedSuspectId)}
                >
                  🏛️ {isCaseSolved ? (isEn ? "Verdict Delivered" : "Hüküm Bağlandı") : (isEn ? "Indict in Court" : "Mahkemede Suçla")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vaka Çözüldüğünde / Arşivlendiğinde Bildirim */}
      {isCaseSolved ? (
        <div className="vaka-case-archived-banner" role="status">
          <span>📜</span>
          <p>
            {isEn
              ? "This case has been resolved and officially recorded in the bureau archives. Transcripts and evidence are available for review."
              : "Bu vaka başarıyla çözüldü ve resmi kayıtlara geçti. Sorgu tutanaklarını ve şüpheli ifadelerini inceleyebilirsiniz."}
          </p>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
