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
  unlockedClueLabel?: string;
  unlockedSuspectId?: string;
  unlockedSuspectName?: string;
};

export function processDeterministicInterrogation(
  caseData: VakaDetailedCase,
  suspectId: string,
  actionType: InterrogationActionType = "question",
  payload: {
    question?: string;
    presentedClueId?: string;
    crossSuspectId?: string;
    crossMode?: "ask_about" | "confront";
    crossQuote?: string;
    bluffClaim?: string;
    sentenceId?: string;
    isExposedByContradiction?: boolean;
    exposedContradictionInfo?: {
      sentence?: string;
      clue?: string;
      explanation?: string;
    };
    history?: Array<{ role: "user" | "assistant"; content: string; actionType?: string }>;
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

  // Çelişki Avında Yakalanmış Şüpheli Kontrolü (Cross-Mode Contradiction Awareness)
  if (payload.isExposedByContradiction) {
    if (suspect.isCulprit) {
      stress = Math.max(90, Math.min(100, stress + 12));
      const expSentence = payload.exposedContradictionInfo?.sentence || suspect.alibi;
      const expClue = payload.exposedContradictionInfo?.clue || "resmi kanıt";
      const motive = isEn
        ? (caseData.correctMotiveEn || suspect.motiveEn || suspect.motive)
        : (caseData.correctMotive || suspect.motive);
      const confDetail = isEn ? (suspect.confessionEn || suspect.confession) : suspect.confession;
      const reply = isEn
        ? `(Head hung in defeat, voice trembling) I know you caught my contradiction regarding "${expSentence}" with the ${expClue}, detective... There's no point in denying it anymore. ${confDetail} (Motive: ${motive})`
        : `(Başını ellerinin arasına alıp yere bakıyor, sesi titriyor) O resmi ifademdeki "${expSentence}" yalanımı ${expClue} ile yakaladığınızı biliyorum dedektif... Artık inkar etmenin bir anlamı kalmadı. ${confDetail} (Amacım: ${motive})`;

      return {
        text: reply,
        behavioralCue: isEn ? suspect.behavioralCues.breaking.en : suspect.behavioralCues.breaking.tr,
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: true,
      };
    } else {
      stress = Math.min(65, Math.max(35, stress));
      const reply = isEn
        ? "(Embarrassed, clearing throat) Fine! You caught that discrepancy in my official statement. But I only lied about my personal embarrassment, I swear to you I didn't murder anyone!"
        : "(Mahcupça boğazını temizliyor) Tamam! Resmi ifademdeki o tutarsızlığı yakaladınız. Ama o sadece kendi küçük utancımı gizlemek içindi; yemin ederim cinayetle en ufak bir ilgim yok!";

      return {
        text: reply,
        behavioralCue: isEn ? suspect.behavioralCues.nervous.en : suspect.behavioralCues.nervous.tr,
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    }
  }

  // Beden dili ipucu seçici (0-29 Sakin, 30-64 Huzursuz/Defansif, 65+ Kırılma)
  const getCue = (st: number) => {
    if (st >= 65) return isEn ? suspect.behavioralCues.breaking.en : suspect.behavioralCues.breaking.tr;
    if (st >= 30) return isEn ? suspect.behavioralCues.nervous.en : suspect.behavioralCues.nervous.tr;
    return isEn ? suspect.behavioralCues.calm.en : suspect.behavioralCues.calm.tr;
  };

  const allHistory = payload.history || [];
  // Mevcut aksiyon çağrısı sırasında history dizisinin sonuna eklenmiş olan son kullanıcı mesajını
  // önceki geçmiş (priorHistory) kontrollerinde hariç tut
  const priorHistory =
    allHistory.length > 0 && allHistory[allHistory.length - 1].role === "user"
      ? allHistory.slice(0, -1)
      : allHistory;

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
      const gain = stress < 40 ? 28 : 22;
      stress = Math.min(100, stress + gain);

      if (stress >= suspect.breakThreshold && suspect.isCulprit) {
        const motive = isEn
          ? (caseData.correctMotiveEn || suspect.motiveEn || suspect.motive)
          : (caseData.correctMotive || suspect.motive);
        const confDetail = isEn ? suspect.confessionEn : suspect.confession;
        return {
          text: isEn ? `${confDetail} (Motive: ${motive})` : `${confDetail} (Amacım: ${motive})`,
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
      stress = Math.max(10, stress - 10);
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

    // Alakasız delil -> Şüpheli hafif özgüven kazanır
    stress = Math.max(10, stress - 4);
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

  // 2. EYLEM: BLÖF YAPMA (Bluff) - Spam Korumalı & Gerçekçi Psikolojik Baskı
  if (actionType === "bluff") {
    const priorBluffs = priorHistory.filter(
      (m) =>
        m.role === "user" &&
        (m.actionType === "bluff" ||
          m.content.includes("BLÖF") ||
          m.content.includes("BLUFF") ||
          m.content.includes("kamera kayıtları") ||
          m.content.includes("surveillance footage") ||
          m.content.includes("baz istasyon") ||
          m.content.includes("parmak izlerini ve DNA"))
    ).length;

    // SPAM ENGELİ: 2. veya daha fazla blöfte şüpheli dedektifin elinde bir şey olmadığını anlar
    if (priorBluffs >= 1) {
      stress = Math.max(15, stress - 5);
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

    // İlk blöf: Katil blöf karşısında sarsılır ve panikler (+16 stres)
    if (suspect.isCulprit) {
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
      stress = Math.min(60, stress + 8);
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

  // 3. EYLEM: ÇAPRAZ SORGU & DEDİKODU (Cross-Examine & Gossip)
  if (actionType === "cross_examine" && payload.crossSuspectId) {
    const other = caseData.suspects.find((s) => s.id === payload.crossSuspectId);
    const otherName = other ? other.name : (isEn ? "the other witness" : "diğer tanık");

    const gossipObj = suspect.gossip[payload.crossSuspectId];
    const gossipText = gossipObj ? (isEn ? gossipObj.en : gossipObj.tr) : "";

    const isAskAbout = payload.crossMode === "ask_about";

    if (isAskAbout) {
      // 3A: DİĞER KİŞİ HAKKINDA İSTİHBARAT / DEDİKODU ALMA (Ask About)
      if (stress > 25) stress = Math.max(20, stress - 4);
      const reply = gossipText
        ? (isEn
            ? `Regarding ${otherName}? Let me tell you: ${gossipText}`
            : `${otherName} hakkında mı? Size şunu söyleyeyim: ${gossipText}`)
        : (isEn
            ? `I haven't paid much attention to ${otherName}, but their demeanor around here is always suspicious.`
            : `${otherName} ile pek muhatap olmam ama hareketleri bana hep tekinsiz ve şüpheli gelmiştir.`);

      return {
        text: reply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    }

    // 3B: DİĞER KİŞİNİN İFADESİNİ YÜZÜNE ÇARPMA / YÜZLEŞTİRME (Confront)
    if (stress < 75) {
      stress = Math.min(75, stress + 16);
    } else {
      stress = Math.min(80, stress + 4);
    }

    if (suspect.isCulprit) {
      const attack = isEn
        ? `${otherName} said that about me?! That liar is just trying to save their own neck! ${gossipText ? `You should investigate them instead: ${gossipText}` : "Don't believe their slander!"}`
        : `${otherName} benim hakkımda bunu mu söyledi?! O yalancı sırf kendi paçasını kurtarmak için bana iftira atıyor! ${gossipText ? `Asıl onun yaptıklarına bakın: ${gossipText}` : "Onun uydurmalarına mı inanacaksınız?!"}`;

      return {
        text: attack,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    } else {
      const innocentDefense = isEn
        ? `${otherName} is lying through their teeth! Bring them in here right now, I'll say it to their face!`
        : `${otherName} kuyruklu bir yalan söylüyor! Getirin onu buraya, bu iftirayı yüzüme karşı söylesin!`;

      return {
        text: innocentDefense,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
      };
    }
  }

  // 4. EYLEM: SESSİZ KALIP BEKLEME (Stay Silent) - Spam Korumalı & Geri Tepme
  if (actionType === "stay_silent") {
    const priorSilences = priorHistory.filter(
      (m) =>
        m.role === "user" &&
        (m.actionType === "stay_silent" ||
          m.content.includes("SESSİZLİK") ||
          m.content.includes("SILENCE") ||
          m.content.includes("sessizliği uzatıyor") ||
          m.content.includes("soğukça süzüyor") ||
          m.content.includes("unbroken eye contact") ||
          m.content.includes("measuring the suspect"))
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

  // Şüphelinin sırrına, kurbana, cinayet motifine veya doğrudan suçlamaya temas eden soruları tespit et
  const motiveWords = [
    ...(suspect.motive || "").toLowerCase().split(/\s+/),
    ...(suspect.minorSecret || "").toLowerCase().split(/\s+/),
    (caseData.victim.name || "").toLowerCase(),
    "kurban", "victim", "para", "money", "borç", "debt", "miras", "inheritance", "kavga", "fight", "sır", "secret", "cinayet", "murder", "öldür", "kill"
  ].filter((w) => w.length > 3);

  const alibiWords = [
    "saat", "time", "neredeydin", "where", "kamera", "camera", "görgü", "witness", "fırtına", "storm", "oda", "room", "otel", "hotel"
  ];

  const accusationWords = [
    "katil", "killer", "suçlu", "guilty", "öldürdün", "öldürdüğünü", "murdered", "yalan", "lie", "lying", "itiraf", "confess", "sen yaptın", "you did it",
    "inkar", "suç ortağı", "accomplice", "biliyorum", "kurtulamazsın", "cezanı"
  ];

  const customBluffWords = [
    "görmüş", "gören var", "şahit var", "tanık var", "saw you", "witness saw", "camdan", "pencereden",
    "tırmanırken", "koşarken", "climbing", "running", "kamera kaydı", "gizli kamera", "footage", "kayıtlar",
    "elimde kayıt", "ses kaydı", "parmak izin", "parmak izi", "kan izin", "kan izi", "izlerini bulduk",
    "suçüstü", "gözleriyle görmüş", "biri seni gördü", "someone saw"
  ];

  const touchesSecret = motiveWords.some((w) => qLower.includes(w));
  const touchesAlibi = alibiWords.some((w) => qLower.includes(w));
  const touchesAccusation = accusationWords.some((w) => qLower.includes(w));
  const touchesCustomBluff = customBluffWords.some((w) => qLower.includes(w));

  // Son dedektif sorusunun aynısı mı (spam soru)? (Mevcut soru hariç en son sorulmuş soru ile karşılaştır)
  const lastPriorUserMsg = [...priorHistory].reverse().find((m) => m.role === "user");
  const isDuplicateQuestion =
    lastPriorUserMsg &&
    lastPriorUserMsg.content.toLowerCase().trim() === qLower &&
    qLower.length > 5;

  if (isDuplicateQuestion) {
    stress = Math.max(10, stress - 4);
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

  // Gayriciddi veya selamlama soruları (naber, selam, nasılsın vb.)
  const greetings = ["naber", "selam", "merhaba", "nasılsın", "günaydın", "iyi akşamlar", "hey", "hi", "hello", "how are you", "sup"];
  const isGreeting = greetings.some((g) => qLower === g || qLower.startsWith(g + " ") || qLower.endsWith(" " + g));

  if (isGreeting) {
    const greetReply = isEn
      ? "We're not here for casual chit-chat, detective. If you have an actual question regarding the case, ask it."
      : "Buraya çay sohbetine gelmedik dedektif. Olayla ilgili soracağınız gerçek bir soru varsa sorun, vaktimi çalmayın.";

    return {
      text: greetReply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: 0,
      confessed: false,
    };
  }

  let gain = 4;
  if ((touchesAccusation || touchesCustomBluff) && suspect.isCulprit) {
    // Katil doğrudan suçlandığında veya serbest blöfle (camdan tırmanma, kamera, gizli şahit) köşeye sıkıştırıldığında yüksek stres kazanır (+18 stres)
    gain = stress < 50 ? 18 : 12;
  } else if (touchesCustomBluff && !suspect.isCulprit) {
    // Masum şüpheli asılsız blöfle itham edildiğinde savunmaya geçer (+6 stres)
    gain = 6;
  } else if (touchesSecret) {
    // Sırra veya kurbanla olan çatışmaya dokunursa yüksek stres
    gain = stress < 50 ? 14 : 7;
  } else if (touchesAlibi) {
    // Savunma ve zaman çelişkisine dokunursa orta stres
    gain = stress < 50 ? 10 : 6;
  } else if (touchesAccusation) {
    // Masum şüpheli doğrudan suçlandığında savunmaya geçer
    gain = 6;
  }

  if (stress < 85) {
    stress = Math.min(85, stress + gain);
  }

  // Şüphelinin yalanlayacağı sahte alibi ve fail tespiti
  const triggerSuspect = caseData.suspects.find(
    (s) => s.id === suspect.unlockCondition?.triggerSuspectId
  );
  const triggerNameParts = triggerSuspect
    ? triggerSuspect.name.toLowerCase().split(/\s+/)
    : [];

  const mentionsTriggerSuspect = triggerNameParts.some(
    (part) => part.length > 2 && qLower.includes(part)
  );

  const mentionsAlibiThemes = [
    "çay", "cay", "tea", "akü", "aku", "battery", "prova", "rehearsal", "kafe", "kafeterya", "cafe",
    "garaj", "kulis", "jeneratör", "şalter", "salter", "restoran", "vagon", "arıza", "tamir",
    "neredeydin", "neredeydi", "seninle", "beraber", "birlikte", "alibi", "savunma", "doğru mu",
    "yalan", "gördün mü", "iddia", "with", "true", "saw him", "see him", "was he"
  ].some((kw) => qLower.includes(kw));

  const isAlibiDenialMatch =
    Boolean(suspect.alibiDenial) &&
    (mentionsTriggerSuspect ||
      (mentionsAlibiThemes && touchesAlibi) ||
      qLower.includes("seninle") ||
      qLower.includes("birlikte") ||
      qLower.includes("beraber") ||
      qLower.includes("with you") ||
      qLower.includes("alibi") ||
      qLower.includes("doğru mu") ||
      qLower.includes("is that true"));

  // Kademeli ve bağlamsal yalanlar veya tanık alibi yalanlaması
  let replyText = "";
  let isDenialTriggered = false;

  if (isAlibiDenialMatch && suspect.alibiDenial) {
    replyText = isEn ? suspect.alibiDenial.en : suspect.alibiDenial.tr;
    isDenialTriggered = true;
  } else if (touchesCustomBluff) {
    if (suspect.isCulprit) {
      replyText = isEn
        ? `(Eyes widening in momentary panic, hands trembling) Wh-what window?! Who saw that?! That's a complete lie, no one could have seen me out there... I mean, I was inside all along! Stop trying to rattle me with absurd bluffs, detective!`
        : `(Göz bebekleri büyüyor, elleri hafifçe titriyor) N-ne penceresi?! Hangi yolcu görmüş?! Yalan söylüyorlar dedektif, beni o saatte kimse dışarıda göremez... yani ben zaten içerideydim! Bana boş blöfler savurarak bir yere varamazsınız!`;
    } else {
      replyText = isEn
        ? `(Raises eyebrows in utter disbelief) Climbing out a window?! Detective, have you completely lost your mind? Do I look like an acrobat to you?! Whoever invented that ridiculous lie, bring them in here to say it to my face!`
        : `(Hayretle kaşlarını kaldırıyor) Pencereden tırmanırken mi?! Dedektif siz aklınızı mı kaçırdınız, sirk cambazı mıyım ben?! Hangi yalancı bunu uydurduysa getirin karşıma, yüzüme söylesin! Boş iddialarla vaktimi harcamayın!`;
    }
  } else if (touchesAccusation && suspect.isCulprit) {
    if (stress >= 65) {
      replyText = isEn
        ? `(Sweating profusely, pounding table) Stop pointing fingers at me without proof! You don't know what happened that night!`
        : `(Alnından ter damlıyor, masaya vuruyor) Elinizde kesin bir kanıt olmadan bana katil diyemezsiniz! O gece orada ne olduğunu bilmiyorsunuz!`;
    } else {
      replyText = isEn
        ? `(Stiffens defensively) How dare you accuse me of murder, detective?! Watch your tone unless you have hard evidence!`
        : `(Savunmaya geçerek dikleşiyor) Bana katil demeye nasıl cüret edersiniz dedektif?! Elinizde somut bir delil olmadan beni suçlayamazsınız!`;
    }
  } else if (touchesSecret) {
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

  // Tanık şüpheli sahte savunmayı yalanladığında resmi ifade delilinin kilidini aç
  let unlockedClueId: string | undefined;
  let unlockedClueLabel: string | undefined;
  if (isDenialTriggered && suspect.alibiDenial) {
    const cleanKey = suspect.id.replace("suspect-", "");
    const testimonyClue = caseData.clues.find(
      (c) => c.category === "witness" && c.type === "alibi" && c.id.includes(cleanKey)
    ) || caseData.clues.find(
      (c) => c.category === "witness" && c.type === "alibi" && (c.contradictsSuspectId || c.clearsSuspectId)
    );

    if (testimonyClue) {
      unlockedClueId = testimonyClue.id;
      unlockedClueLabel = isEn ? (testimonyClue.labelEn || testimonyClue.label) : testimonyClue.label;
    }
  }

  // Kilitli bir şüphelinin açılma koşulunu kontrol et (Sadece cevabında açıkça bahsettiyse veya dedektif sorduysa)
  let unlockedSuspectId: string | undefined;
  let unlockedSuspectName: string | undefined;
  const lockedSuspects = caseData.suspects.filter((s) => s.isInitiallyLocked);
  const replyLower = replyText.toLowerCase();
  const qCleanLower = (payload.question || "").toLowerCase();
  const crossQuoteCleanLower = (payload.crossQuote || "").toLowerCase();

  for (const ls of lockedSuspects) {
    if (!ls.unlockCondition) continue;
    const { keywords, triggerSuspectId } = ls.unlockCondition;
    if (triggerSuspectId && triggerSuspectId !== suspect.id) continue;

    const mentionedInReply = keywords.some((kw) => replyLower.includes(kw.toLowerCase()));
    const askedDirectlyByDetective =
      keywords.some((kw) => qCleanLower.includes(kw.toLowerCase()) || crossQuoteCleanLower.includes(kw.toLowerCase())) ||
      (actionType === "cross_examine" && payload.crossSuspectId === ls.id);

    if (mentionedInReply || askedDirectlyByDetective) {
      unlockedSuspectId = ls.id;
      unlockedSuspectName = ls.name;
      break;
    }
  }

  return {
    text: replyText,
    behavioralCue: getCue(stress),
    newStress: stress,
    stressDelta: stress - startStress,
    confessed: false,
    unlockedClueId,
    unlockedClueLabel,
    unlockedSuspectId,
    unlockedSuspectName,
  };
}
