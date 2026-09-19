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
  const isEn = locale === "en";
  const suspect = caseData.suspects.find((s: VakaSuspect) => s.id === suspectId);
  if (!suspect) {
    return {
      text: isEn ? "Suspect not found in dossier." : "Şüpheli dosyada bulunamadı.",
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
    if (st >= 75) return isEn ? suspect.behavioralCues.breaking.en : suspect.behavioralCues.breaking.tr;
    if (st >= 40) return isEn ? suspect.behavioralCues.nervous.en : suspect.behavioralCues.nervous.tr;
    return isEn ? suspect.behavioralCues.calm.en : suspect.behavioralCues.calm.tr;
  };

  // 1. EYLEM: DELİL YÜZLEŞTİRME (Present Evidence) - Asıl Kırılma Yolu
  if (actionType === "present_evidence" && payload.presentedClueId) {
    const clue = caseData.clues.find((c: VakaClue) => c.id === payload.presentedClueId);
    if (!clue) {
      return {
        text: isEn ? "That evidence does not exist in our dossier." : "Bu kanıt dosyamızda kayıtlı değil.",
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: 0,
        confessed: false,
      };
    }

    // Doğrudan bu şüpheliyi çürüten kritik delil
    if (clue.contradictsSuspectId === suspect.id) {
      // Düşük stresteyken (+18), yüksek stresteyken (+24) stres artışı
      const gain = stress < 45 ? 18 : 24;
      stress = Math.min(100, stress + gain);

      // SADECE ve SADECE: Stres kırılma eşiğini aştıysa VE şüpheli gerçekten suçluysa itiraf gerçekleşir
      if (stress >= suspect.breakThreshold && suspect.isCulprit) {
        return {
          text: isEn ? suspect.confessionEn : suspect.confession,
          behavioralCue: isEn ? suspect.behavioralCues.breaking.en : suspect.behavioralCues.breaking.tr,
          newStress: stress,
          stressDelta: stress - startStress,
          confessed: true,
          unlockedClueId: clue.id,
        };
      }

      // Henüz kırılmadıysa panikle bir savunma veya 2. kademe yalan sunar
      const reply =
        isEn
          ? `(Voice shaking) Where... where did you get that ${clue.labelEn.toLowerCase()}?! I told you that wasn't me!`
          : `(Sesi titreyerek) O... o ${clue.label.toLowerCase()} belgesini nereden buldunuz?! Benimle bir ilgisi olmadığını söylemiştim!`;

      return {
        text: `${reply} ${stress >= 65 ? suspect.lies.level3 : suspect.lies.level2}`,
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
        isEn
          ? `See? Even this ${clue.labelEn.toLowerCase()} proves my innocence! You are barking up the wrong tree, detective.`
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
    stress = Math.max(0, stress - 10);
    const reply =
      isEn
        ? `What does this ${clue.labelEn.toLowerCase()} have to do with me? You have absolutely nothing on me, detective.`
        : `Bu ${clue.label.toLowerCase()} ile benim ne alakam var? Elinizde bana dair hiçbir somut delil yok dedektif.`;

    return {
      text: reply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: stress - startStress,
      confessed: false,
    };
  }

  // 2. EYLEM: BLÖF YAPMA (Bluff) - Akıllı İki Yönlü Risk/Ödül Mekaniği
  if (actionType === "bluff") {
    if (suspect.isCulprit) {
      // Suçlu düşük stresteyken blöfü görür ve dedektifin elinin boş olduğunu anlar
      if (startStress < 45) {
        stress = Math.max(5, stress - 12);
        const reply =
          isEn
            ? `(Smiles coldly) You're trying to bluff me, detective. You don't have a shred of surveillance footage or testimony, or you would have handcuffed me already.`
            : `(Soğukça gülümsüyor) Bana blöf yapmaya çalışıyorsunuz dedektif. Elinizde ne kamera kaydı ne de görgü tanığı var; olsaydı çoktan kelepçeyi takmıştınız.`;

        return {
          text: reply,
          behavioralCue: getCue(stress),
          newStress: stress,
          stressDelta: stress - startStress,
          confessed: false,
        };
      }

      // Suçlu zaten stresliyken blöf yapılırsa paniğe kapılır
      stress = Math.min(100, stress + 16);
      const reply =
        isEn
          ? `(Blinks rapidly, sweating) What... you pulled that record?! No, you can't have! The blind spot... I mean, you're bluffing! You have nothing!`
          : `(Hızla gözlerini kırpıştırıyor, terliyor) Ne... o kaydı mı buldunuz?! Hayır, bulmuş olamazsınız! O saatteki kör noktayı... Yani, blöf yapıyorsunuz!`;

      return {
        text: reply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    } else {
      // Masum şüpheli blöf karşısında haksızlığa uğradığını hissedip sertleşir
      stress = Math.max(0, stress - 12);
      const reply =
        isEn
          ? "Nice try detective, but that's an obvious bluff. I know my rights and I won't let you intimidate me."
          : "Güzel deneme dedektif, ama bariz bir blöf yapıyorsunuz. Haklarımı biliyorum ve asılsız iddialarla beni yıldıramazsınız.";

      return {
        text: reply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    }
  }

  // 3. EYLEM: ÇAPRAZ SORGU (Cross-Examine / Quote other suspect)
  if (actionType === "cross_examine" && payload.crossSuspectId) {
    const other = caseData.suspects.find((s) => s.id === payload.crossSuspectId);
    const otherName = other ? other.name : (isEn ? "the other witness" : "diğer tanık");

    const gossipObj = suspect.gossip[payload.crossSuspectId];
    const gossipText = gossipObj ? (isEn ? gossipObj.en : gossipObj.tr) : "";

    // Çapraz sorgu stresi artırır (soft-cap 75)
    if (stress < 75) {
      stress = Math.min(75, stress + 16);
    } else {
      stress = Math.min(80, stress + 4);
    }

    const intro =
      isEn
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

  // 4. EYLEM: SESSİZ KALIP BEKLEME (Stay Silent)
  if (actionType === "stay_silent") {
    // Sessizlik psikolojik baskı kurar ancak tek başına 55'i geçemez (soft-cap)
    if (stress < 55) {
      stress = Math.min(55, stress + 10);
    }

    let reply = "";
    if (suspect.isCulprit) {
      if (stress >= 50) {
        reply =
          isEn
            ? "(Fidgets uncomfortably) Why are you staring at me like that?! Ask your questions or let me walk out of here!"
            : "(Huzursuzca kıpırdanıyor) Neden bana öyle dik dik bakıyorsunuz?! Sorunuz varsa sorun, yoksa beni buradan bırakın!";
      } else {
        reply =
          isEn
            ? "(Clears throat nervously) The silence won't fabricate an alibi for you, detective."
            : "(Boğazını gergince temizliyor) Sessiz kalmanız gerçeği değiştirmez dedektif. Ne bilmek istiyorsunuz?";
      }
    } else {
      reply =
        isEn
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

  // 5. EYLEM: SERBEST SORU VE ANAHTAR KELİME ANALİZİ (Question)
  // KURAL: Düz soru sormak ASLA suç itirafına yol açamaz!
  // Soru sormak stresi sadece psikolojik tavan olan 55'e kadar yükseltebilir.
  const qLower = (payload.question || "").toLowerCase().trim();
  const triggerWords = [
    "neredeydin", "saat", "alibi", "cinayet", "zehir", "kasa", "fırtına", "kamera", "neden", "yalan",
    "para", "borç", "kurban", "ilişki", "sır", "bıçak", "anahtar", "nerede", "itiraf", "kim",
    "where", "time", "murder", "poison", "vault", "storm", "camera", "why", "lie", "money", "debt", "victim", "secret", "weapon", "confess", "who",
  ];

  const matched = triggerWords.some((w) => qLower.includes(w));
  const gain = matched ? 6 : 3;

  if (stress < 55) {
    stress = Math.min(55, stress + gain);
  } else if (stress < 60) {
    stress = Math.min(60, stress + 1);
  }
  // 60 ve üzerinde düz sorular ek stres üretmez; dedektif delil veya çelişki sunmalıdır.

  // Kademeli yalanlar (Stres seviyesine göre hikayenin çatlaması)
  let replyText = "";
  if (stress >= 65) {
    replyText = isEn ? suspect.lies.level3 : suspect.lies.level3;
  } else if (stress >= 35) {
    replyText = isEn ? suspect.lies.level2 : suspect.lies.level2;
  } else {
    replyText = isEn ? suspect.lies.level1 : suspect.lies.level1;
  }

  return {
    text: replyText,
    behavioralCue: getCue(stress),
    newStress: stress,
    stressDelta: stress - startStress,
    confessed: false, // Düz sorularla ASLA itiraf gerçekleşmez!
  };
}
