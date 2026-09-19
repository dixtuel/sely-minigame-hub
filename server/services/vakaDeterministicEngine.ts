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
    history?: Array<{ role: "user" | "assistant"; content: string }>;
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

  const history = payload.history || [];

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
      const gain = stress < 45 ? 18 : 24;
      stress = Math.min(100, stress + gain);

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

  // 2. EYLEM: BLÖF YAPMA (Bluff) - Spam Korumalı & Ters Tepme (Backfire) Mekaniği
  if (actionType === "bluff") {
    const priorBluffs = history.filter(
      (m) => m.role === "user" && (m.content.includes("BLÖF") || m.content.includes("BLUFF"))
    ).length;

    // SPAM ENGELİ: 2. veya daha fazla blöfte şüpheli dedektifin elinde bir şey olmadığını anlar ve ÖZGÜVEN KAZANIR
    if (priorBluffs >= 1) {
      stress = Math.max(5, stress - 14);
      const spamReply = isEn
        ? "(Laughs dismissively) The exact same bluff again? Detective, if you actually had conclusive proof, you would have charged me already. Your empty threats are pathetic."
        : "(Alaycı bir tebessümle başını sallıyor) Yine mi aynı temelsiz blöf dedektif? Elinizde gerçekten bir kayıt ya da somut delil olsaydı şimdiye kadar masaya koymuştunuz. Bu boş tehditleriniz sadece çaresizliğinizi gösteriyor!";

      return {
        text: spamReply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    }

    // İlk blöf: Risk & Ödül
    if (suspect.isCulprit) {
      if (startStress < 45) {
        stress = Math.max(5, stress - 12);
        const reply = isEn
          ? "(Smiles coldly) You're trying to bluff me, detective. You don't have a shred of surveillance footage or testimony, or you would have handcuffed me already."
          : "(Soğukça gülümsüyor) Bana blöf yapmaya çalışıyorsunuz dedektif. Elinizde ne kamera kaydı ne de görgü tanığı var; olsaydı çoktan kelepçeyi takmıştınız.";

        return {
          text: reply,
          behavioralCue: getCue(stress),
          newStress: stress,
          stressDelta: stress - startStress,
          confessed: false,
        };
      }

      stress = Math.min(100, stress + 16);
      const reply = isEn
        ? "(Blinks rapidly, sweating) What... you pulled that record?! No, you can't have! The blind spot... I mean, you're bluffing! You have nothing!"
        : "(Hızla gözlerini kırpıştırıyor, terliyor) Ne... o kaydı mı buldunuz?! Hayır, bulmuş olamazsınız! O saatteki kör noktayı... Yani, blöf yapıyorsunuz!";

      return {
        text: reply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    } else {
      stress = Math.max(0, stress - 12);
      const reply = isEn
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

  // 3. EYLEM: ÇAPRAZ SORGU (Cross-Examine)
  if (actionType === "cross_examine" && payload.crossSuspectId) {
    const other = caseData.suspects.find((s) => s.id === payload.crossSuspectId);
    const otherName = other ? other.name : (isEn ? "the other witness" : "diğer tanık");

    const gossipObj = suspect.gossip[payload.crossSuspectId];
    const gossipText = gossipObj ? (isEn ? gossipObj.en : gossipObj.tr) : "";

    if (stress < 75) {
      stress = Math.min(75, stress + 16);
    } else {
      stress = Math.min(80, stress + 4);
    }

    const intro = isEn
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

  // 4. EYLEM: SESSİZ KALIP BEKLEME (Stay Silent) - Spam Korumalı & Geri Tepme
  if (actionType === "stay_silent") {
    const priorSilences = history.filter(
      (m) => m.role === "user" && (m.content.includes("SESSİZLİK") || m.content.includes("SILENCE"))
    ).length;

    // SPAM ENGELİ: 2'den fazla sessizlikte şüpheli dedektifin tıkandığını anlar, rahatlar ve stres düşer
    if (priorSilences >= 2) {
      stress = Math.max(10, stress - 8);
      const spamReply = isEn
        ? "(Crosses arms and checks wristwatch) Staring at me in silence is getting ridiculous, detective. It's clear you've run out of questions and have no case. Call my attorney or let me go."
        : "(Kollarını kavuşturup saatine bakıyor) Dakikalardır boş boş susup bakmanız artık gülünç olmaya başladı dedektif. Soracak sorunuz ve elinizde tek bir delil dahi olmadığı aşikâr. Ya avukatımı çağırın ya da beni serbest bırakın!";

      return {
        text: spamReply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    }

    if (priorSilences === 1) {
      // 2. Sessizlik: Şüpheli temkinli
      if (stress < 55) stress = Math.min(55, stress + 3);
      const reply = isEn
        ? "(Shifts slightly) Prolonged silence won't fabricate evidence out of thin air, detective. Ask what you want to ask."
        : "(Hafifçe kıpırdanıyor) Susarak havadan delil yaratamazsınız dedektif. Ne sormak istiyorsanız sorun artık.";

      return {
        text: reply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    }

    // İlk Sessizlik: Psikolojik baskı etkili (+10 stres, max 55)
    if (stress < 55) {
      stress = Math.min(55, stress + 10);
    }

    let reply = "";
    if (suspect.isCulprit) {
      if (stress >= 50) {
        reply = isEn
          ? "(Fidgets uncomfortably) Why are you staring at me like that?! Ask your questions or let me walk out of here!"
          : "(Huzursuzca kıpırdanıyor) Neden bana öyle dik dik bakıyorsunuz?! Sorunuz varsa sorun, yoksa beni buradan bırakın!";
      } else {
        reply = isEn
          ? "(Clears throat nervously) Your silence won't change the facts, detective. What do you want to know?"
          : "(Boğazını gergince temizliyor) Sessiz kalmanız gerçeği değiştirmez dedektif. Ne bilmek istiyorsunuz?";
      }
    } else {
      reply = isEn
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

  // 5. EYLEM: SERBEST SORU VE BAĞLAMSAL ANALİZ (Question)
  const qText = payload.question || "";
  const qLower = qText.toLowerCase().trim();

  // Şüphelinin sırrına, kurbana veya cinayet motifine temas eden soruları tespit et
  const motiveWords = [
    ...(suspect.motive || "").toLowerCase().split(/\s+/),
    ...(suspect.minorSecret || "").toLowerCase().split(/\s+/),
    (caseData.victim.name || "").toLowerCase(),
    "kurban", "victim", "para", "money", "borç", "debt", "miras", "inheritance", "kavga", "fight", "sır", "secret", "cinayet", "murder", "öldür", "kill"
  ].filter((w) => w.length > 3);

  const alibiWords = [
    "saat", "time", "neredeydin", "where", "kamera", "camera", "görgü", "witness", "fırtına", "storm", "oda", "room", "otel", "hotel"
  ];

  const touchesSecret = motiveWords.some((w) => qLower.includes(w));
  const touchesAlibi = alibiWords.some((w) => qLower.includes(w));

  // Son dedektif sorusunun aynısı mı (spam soru)?
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
  const isDuplicateQuestion = lastUserMsg && lastUserMsg.content.toLowerCase().trim() === qLower && qLower.length > 5;

  if (isDuplicateQuestion) {
    stress = Math.max(5, stress - 5);
    const repReply = isEn
      ? "You just asked me that exact same thing. Repeating questions won't change my answer, detective."
      : "Bana az önce sorduğunuz sorunun tıpatıp aynısını soruyorsunuz. Tekrarlamanız cevabımı değiştirmeyecek dedektif.";

    return {
      text: repReply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: stress - startStress,
      confessed: false,
    };
  }

  let gain = 3;
  if (touchesSecret) {
    // Sırra veya kurbanla olan çatışmaya dokunursa yüksek stres
    gain = stress < 60 ? 14 : 6;
  } else if (touchesAlibi) {
    // Savunma ve zaman çelişkisine dokunursa orta stres
    gain = stress < 60 ? 8 : 4;
  }

  if (stress < 70) {
    stress = Math.min(70, stress + gain);
  }

  // Kademeli ve bağlamsal yalanlar
  let replyText = "";
  if (touchesSecret) {
    replyText = isEn
      ? `(Eyes shifting nervously) That matter with ${caseData.victim.name} was strictly personal! ${stress >= 50 ? suspect.lies.level3 : suspect.lies.level2}`
      : `(Gözleri gergince kaçıyor) ${caseData.victim.name} ile aramızdaki o mesele tamamen kişiseldi! ${stress >= 50 ? suspect.lies.level3 : suspect.lies.level2}`;
  } else if (touchesAlibi) {
    replyText = isEn
      ? `I already gave my timeline to the precinct: ${stress >= 45 ? suspect.lies.level2 : suspect.lies.level1}`
      : `İfade tutanağımda o saatte nerede olduğumu açıkça belirttim: ${stress >= 45 ? suspect.lies.level2 : suspect.lies.level1}`;
  } else if (stress >= 65) {
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
    confessed: false,
  };
}
