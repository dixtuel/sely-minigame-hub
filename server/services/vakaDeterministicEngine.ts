import type { VakaDetailedCase, VakaSuspect, VakaClue } from "../../shared/vakaTypes";

export type InterrogationActionType =
  | "question"
  | "present_evidence"
  | "cross_examine"
  | "stay_silent"
  | "bluff"
  | "confront";

export type DeterministicEngineResult = {
  text: string;
  behavioralCue: string;
  newStress: number;
  stressDelta: number;
  confessed: boolean;
  unlockedClueId?: string;
};

export function processDeterministicInterrogation(
  caseData: VakaDetailedCase,
  suspectId: string,
  actionType: InterrogationActionType = "question",
  payload: {
    question?: string;
    presentedClueId?: string;
    crossSuspectId?: string;
    crossQuote?: string;
    bluffClaim?: string;
    sentenceId?: string;
  },
  currentStress = 10,
  locale: "tr" | "en" = "tr"
): DeterministicEngineResult {
  const suspect = caseData.suspects.find((s: VakaSuspect) => s.id === suspectId);
  if (!suspect) {
    return {
      text: locale === "en" ? "Suspect not found in dossier." : "Şüpheli dosyada bulunamadı.",
      behavioralCue: "",
      newStress: currentStress,
      stressDelta: 0,
      confessed: false,
    };
  }

  let stress = Math.max(0, Math.min(100, currentStress));
  const startStress = stress;

  // Beden dili ipucu seçici
  const getCue = (st: number) => {
    if (st >= 75) return locale === "en" ? suspect.behavioralCues.breaking.en : suspect.behavioralCues.breaking.tr;
    if (st >= 40) return locale === "en" ? suspect.behavioralCues.nervous.en : suspect.behavioralCues.nervous.tr;
    return locale === "en" ? suspect.behavioralCues.calm.en : suspect.behavioralCues.calm.tr;
  };

  // 1. EYLEM: DELİL YÜZLEŞTİRME (Present Evidence)
  if (actionType === "present_evidence" && payload.presentedClueId) {
    const clue = caseData.clues.find((c: VakaClue) => c.id === payload.presentedClueId);
    if (!clue) {
      return {
        text: locale === "en" ? "That evidence does not exist in our dossier." : "Bu kanıt dosyamızda kayıtlı değil.",
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: 0,
        confessed: false,
      };
    }

    // Doğrudan faili çürüten kritik delil
    if (clue.contradictsSuspectId === suspect.id) {
      stress = Math.min(100, stress + 25);

      if (stress >= suspect.breakThreshold && suspect.isCulprit) {
        return {
          text: locale === "en" ? suspect.confessionEn : suspect.confession,
          behavioralCue: locale === "en" ? suspect.behavioralCues.breaking.en : suspect.behavioralCues.breaking.tr,
          newStress: stress,
          stressDelta: stress - startStress,
          confessed: true,
          unlockedClueId: clue.id,
        };
      }

      const reply =
        locale === "en"
          ? `(Voice shaking) Where... where did you get that ${clue.labelEn.toLowerCase()}?! I told you that wasn't me!`
          : `(Sesi titreyerek) O... o ${clue.label.toLowerCase()} belgesini nereden buldunuz?! Benimle bir ilgisi olmadığını söylemiştim!`;

      return {
        text: `${reply} ${suspect.lies.level3}`,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
        unlockedClueId: clue.id,
      };
    }

    // Şüpheliyi temize çıkaran delil
    if (clue.clearsSuspectId === suspect.id) {
      stress = Math.max(0, stress - 15);
      const reply =
        locale === "en"
          ? `See? Even this ${clue.labelEn.toLowerCase()} proves my innocence! You are barking up the wrong tree.`
          : `Gördünüz mü? Bu ${clue.label.toLowerCase()} bile masumiyetimi kanıtlıyor! Boşuna vaktimi harcıyorsunuz dedektif.`;

      return {
        text: reply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    }

    // Alakasız delil -> Şüpheli özgüven kazanır (stres düşer)
    stress = Math.max(0, stress - 8);
    const reply =
      locale === "en"
        ? `What does this ${clue.labelEn.toLowerCase()} have to do with me? You have absolutely nothing on me, detective.`
        : `Bu ${clue.label.toLowerCase()} ile benim ne alakam var? Elinizde bana dair hiçbir somut şey yok dedektif.`;

    return {
      text: reply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: stress - startStress,
      confessed: false,
    };
  }

  // 2. EYLEM: ÇAPRAZ SORGU (Cross-Examine / Quote other suspect)
  if (actionType === "cross_examine" && payload.crossSuspectId) {
    const other = caseData.suspects.find((s) => s.id === payload.crossSuspectId);
    const otherName = other ? other.name : (locale === "en" ? "the other witness" : "diğer tanık");

    // Şüphelinin o kişi hakkındaki dedikodusu var mı?
    const gossipObj = suspect.gossip[payload.crossSuspectId];
    const gossipText = gossipObj ? (locale === "en" ? gossipObj.en : gossipObj.tr) : "";

    stress = Math.min(100, stress + 16);

    const intro =
      locale === "en"
        ? `${otherName} said that about me?! That liar is just trying to save their own neck!`
        : `${otherName} benim hakkımda bunu mu söyledi?! O yalancı sırf kendi paçasını kurtarmak için iftira atıyor!`;

    const fullReply = gossipText ? `${intro} ${gossipText}` : intro;

    return {
      text: fullReply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: stress - startStress,
      confessed: false,
    };
  }

  // 3. EYLEM: SESSİZ KALIP BEKLEME (Stay Silent)
  if (actionType === "stay_silent") {
    stress = Math.min(100, stress + 10);

    let reply = "";
    if (suspect.isCulprit) {
      if (stress >= 65) {
        reply =
          locale === "en"
            ? "(Fidgets uncomfortably) Why are you staring at me like that?! Ask your questions or let me go!"
            : "(Huzursuzca kıpırdanıyor) Neden bana öyle dik dik bakıyorsunuz?! Sorunuz varsa sorun, yoksa beni bırakın!";
      } else {
        reply =
          locale === "en"
            ? "(Clears throat nervously) The silence won't fabricate an alibi for you, detective."
            : "(Boğazını gergince temizliyor) Sessiz kalmanız gerçeği değiştirmez dedektif. Ne bilmek istiyorsunuz?";
      }
    } else {
      reply =
        locale === "en"
          ? "Staring at me in silence won't make me guilty. Call my lawyer if you're not going to speak."
          : "Bana sessizce bakmanız beni suçlu yapmaz. Konuşmayacaksanız avukatımı arayacağım.";
    }

    return {
      text: reply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: stress - startStress,
      confessed: false,
    };
  }

  // 4. EYLEM: BLÖF YAPMA (Bluff)
  if (actionType === "bluff") {
    // Suçluysa blöf şüpheyi artırabilir ama risklidir
    if (suspect.isCulprit) {
      stress = Math.min(100, stress + 14);
      const reply =
        locale === "en"
          ? `(Blinks rapidly) You... you have that on record?! No, you're bluffing! You can't possibly prove that!`
          : `(Hızla gözlerini kırpıştırıyor) O... o kayıt elinizde mi?! Hayır, blöf yapıyorsunuz! Bunu kanıtlayamazsınız!`;

      return {
        text: reply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    } else {
      // Masumsa blöfü sezer, stres düşer
      stress = Math.max(0, stress - 12);
      const reply =
        locale === "en"
          ? "Nice try detective, but that's an obvious bluff. I know my rights."
          : "Güzel deneme dedektif, ama bariz bir blöf yapıyorsunuz. Masum olduğumu ikimiz de biliyoruz.";

      return {
        text: reply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    }
  }

  // 5. EYLEM: SERBEST SORU VE ANAHTAR KELİME ANALİZİ (Question)
  const qLower = (payload.question || "").toLowerCase().trim();
  const triggerWords = [
    "neredeydin", "saat", "alibi", "cinayet", "zehir", "kasa", "saat", "fırtına", "kamera", "neden", "yalan",
    "para", "borç", "kurban", "ilişki", "sır", "bıçak", "anahtar", "nerede",
    "where", "time", "murder", "poison", "vault", "storm", "camera", "why", "lie", "money", "debt", "victim", "secret", "weapon",
  ];

  const matched = triggerWords.some((w) => qLower.includes(w));
  if (matched) {
    stress = Math.min(100, stress + 12);
  } else {
    stress = Math.min(100, stress + 4);
  }

  // İtiraf eşiği
  if (stress >= suspect.breakThreshold && suspect.isCulprit) {
    return {
      text: locale === "en" ? suspect.confessionEn : suspect.confession,
      behavioralCue: locale === "en" ? suspect.behavioralCues.breaking.en : suspect.behavioralCues.breaking.tr,
      newStress: stress,
      stressDelta: stress - startStress,
      confessed: true,
    };
  }

  // Kademeli yalanlar
  let replyText = "";
  if (stress >= 70) {
    replyText = locale === "en" ? suspect.lies.level3 : suspect.lies.level3;
  } else if (stress >= 35) {
    replyText = locale === "en" ? suspect.lies.level2 : suspect.lies.level2;
  } else {
    replyText = locale === "en" ? suspect.lies.level1 : suspect.lies.level1;
  }

  return {
    text: replyText,
    behavioralCue: getCue(stress),
    newStress: stress,
    stressDelta: stress - startStress,
    confessed: false,
  };
}
