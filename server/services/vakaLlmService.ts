import type { VakaSuspect, VakaDetailedCase } from "../../shared/vakaTypes";

// Düşünce etiketlerini temizleme fonksiyonu (commit-gunlugu sanitizer deseni)
export function stripReasoningBlocks(text: string): string {
  if (!text) return "";
  return text
    // Tam <think>...</think> blokları
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    // Kapatılmamış veya yarım kalmış <think>...
    .replace(/<think>[\s\S]*$/gi, "")
    // Baştaki artık </think>
    .replace(/^[\s\S]*?<\/think>/gi, "")
    // <thought>, <reasoning>, [THINK] vb. etiketler
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/\[THINK\][\s\S]*?\[\/THINK\]/gi, "")
    .replace(/^\s+|\s+$/g, "");
}

// Anahtarları yalnızca standart process.env üzerinden al (Public repo güvenliği)
function getSecretKey(name: string): string {
  return process.env[name]?.trim() || "";
}

/** Tek kaynak: herhangi bir LLM sağlayıcı anahtarı tanımlı mı? vakaRouter.ts bunu import eder. */
export function hasLlmApiKey(): boolean {
  return Boolean(
    getSecretKey("GROQ_API_KEY") ||
    getSecretKey("GROQ_API_KEY_2") ||
    getSecretKey("NVIDIA_NIM_API_KEY") ||
    getSecretKey("NVIDIA_API_KEY") ||
    getSecretKey("NIM_API_KEY") ||
    getSecretKey("MISTRAL_API_KEY")
  );
}

// Dedektif repliklerinden veya geçmişten [TAKTİKSEL BLÖF], [SESSİZLİK & BASKI] gibi
// yapay meta etiketleri temizler; böylece LLM karakteri yalnızca doğal insan konuşmasını duyar.
export function cleanInterrogationText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^\[(TAKTİKSEL BLÖF|TACTICAL BLUFF|SESSİZLİK & BASKI|SILENCE & PRESSURE|ÇAPRAZ SORGU|CROSS-EXAM|YÜZLEŞTİRME|CONFRONTATION)\]\s*/i, "")
    .replace(/\[(TAKTİKSEL BLÖF|TACTICAL BLUFF|SESSİZLİK & BASKI|SILENCE & PRESSURE|ÇAPRAZ SORGU|CROSS-EXAM|YÜZLEŞTİRME|CONFRONTATION)\]/gi, "")
    .trim();
}

export type VakaInterrogationPromptParams = {
  suspect: VakaSuspect;
  newStress: number;
  otherSuspectsInfo: string;
  presentedClue: { label: string; detail: string } | null;
  actionType?: "question" | "present_evidence" | "cross_examine" | "stay_silent" | "bluff" | "confront";
  crossSuspect?: VakaSuspect | null;
  crossMode?: "ask_about" | "confront";
  isExposedByContradiction?: boolean;
  exposedContradictionInfo?: {
    sentence?: string;
    clue?: string;
    explanation?: string;
  };
  caseData?: VakaDetailedCase;
  allSuspects?: VakaSuspect[];
  locale?: "tr" | "en";
  langInstruction?: string;
};

/** System prompt for the interrogation roleplay LLM call — grounded in realistic police interrogation psychology. */
export function buildVakaInterrogationPrompt(params: VakaInterrogationPromptParams): string {
  const {
    suspect,
    newStress,
    otherSuspectsInfo,
    presentedClue,
    actionType,
    crossSuspect,
    crossMode = "confront",
    isExposedByContradiction,
    exposedContradictionInfo,
    caseData,
    allSuspects,
    locale = "tr",
  } = params;
  const isEn = locale === "en";

  // Diğer şüpheliler hakkındaki dedikodu ve düşünceler
  const gossipLines = Object.entries(suspect.gossip || {}).map(([otherId, g]) => {
    return `- ${otherId}: "${isEn ? g.en : g.tr}"`;
  });
  const gossipSection = gossipLines.length > 0 ? gossipLines.join("\n") : (isEn ? "No specific gossip on record." : "Kayıtlarda özel bir dedikodu yok.");

  // Çelişki Avında Yakalanma Uyarısı (Cross-Mode Contradiction Alert)
  let exposedAlert = "";
  if (isExposedByContradiction) {
    exposedAlert = isEn
      ? `\n## CRITICAL OVERRIDE - YOUR CONTRADICTION WAS OFFICIALLY EXPOSED IN COURT/DOSSIER:
The detective already caught your false statement with physical evidence:
- False Statement on Record: "${exposedContradictionInfo?.sentence || suspect.alibiEn || suspect.alibi}"
- Disproving Evidence: "${exposedContradictionInfo?.clue || 'Case file evidence'}"
${exposedContradictionInfo?.explanation ? `- Court finding: "${exposedContradictionInfo.explanation}"` : ""}

YOU KNOW THE GAME IS UP. YOUR DEFENSE HAS COLLAPSED.
${suspect.isCulprit
  ? `- You know the detective caught you red-handed with this contradiction.
- Do NOT repeat old denials like "I was somewhere else" or "I know nothing".
- Adopt a broken, defeated, or cornered posture.
- Either confess parts of your motive (desperation, debt, rage) or plead for a lighter charge, or defensively ask what happens to you now.`
  : `- Your minor secret or discrepancy was uncovered. Be embarrassed, admit that specific point, but firmly re-iterate you did not murder anyone.`}`
      : `\n## KRİTİK DİREKTİF - RESMİ ÇELİŞKİ AVI'NDA YALANIN VE ÇELİŞKİN YAKALANDI:
Dedektif, resmi tutanaktaki yalanını somut delille çürüterek tutanağa geçirdi:
- Resmi İfadedeki Yalanın: "${exposedContradictionInfo?.sentence || suspect.alibi}"
- Çürüten Delil: "${exposedContradictionInfo?.clue || 'Dava delili'}"
${exposedContradictionInfo?.explanation ? `- Resmi Tespit: "${exposedContradictionInfo.explanation}"` : ""}

YAKALANDIĞINI BİLİYORSUN. SAVUNMAN VE NEREDEYDİM İDDİAN TAMAMEN ÇÖKTÜ.
${suspect.isCulprit
  ? `- Yalanının ortaya çıktığının ve köşeye sıkıştığının tamamen farkındasın.
  - "Ben yapmadım", "Odamdaydım", "Haberim yok" gibi eski inkar yalanlarına ASLA devam etme!
  - Yenilmiş, sarsılmış ve gardı düşmüş bir psikolojiyle konuş.
  - Seni buna neyin ittiğini (borçlar, öfke, mecburiyet, tefeciler), nasıl yaptığını veya pişmanlığını kısaca dile getir ya da "Beni nasıl yakaladınız..." diyerek yenilgiyi kabul et.`
  : `- Sakladığın küçük sırrın veya ifade hatan ortaya çıktı. Mahcup ol, o noktayı kabul et ama cinayet işlemediğini ısrarla vurgula.`}`;
  }

  // Katman 7: Çapraz Referans ve İfade Yüzleştirme Uyarısı (Layer 7)
  let crossAlert = "";
  if (crossSuspect) {
    const targetName = crossSuspect.name;
    const targetGossipObj = suspect.gossip?.[crossSuspect.id];
    const targetGossip = targetGossipObj ? (isEn ? targetGossipObj.en : targetGossipObj.tr) : "";

    if (crossMode === "ask_about") {
      crossAlert = isEn
        ? `\n## TACTICAL ALERT - DETECTIVE ASKS ABOUT ${targetName.toUpperCase()}:
The detective is asking for your testimony or observations regarding ${targetName}.
- Share your specific perspective, suspicion or gossip about them naturally in character${targetGossip ? `: "${targetGossip}"` : ""}.
- Speak in character with your genuine feelings and temperament toward them.`
        : `\n## TAKTİKSEL UYARI - DEDEKTİF ${targetName.toUpperCase()} HAKKINDA BİLGİ İSTİYOR:
Dedektif sana ${targetName} hakkında ne bildiğini veya onun hareketlerini soruyor.
- Bu kişi hakkındaki gözlemini, şüphelerini ve dedikodunu${targetGossip ? ` ("${targetGossip}")` : ""} kendi üslubunla dedektife aktar.
- Karakter mizanına ve onunla ilişkine uygun tepki ver.`;
    } else {
      crossAlert = isEn
        ? `\n## LAYER 7 ALERT - CONFRONTATION WITH ${targetName.toUpperCase()}'S ACCUSATION:
The detective is confronting you with testimony or allegations allegedly from ${targetName}, contradicting your story!
${suspect.isCulprit
  ? `- Show noticeable stress and momentary panic.
- ATTACK THE SOURCE'S CREDIBILITY: Defame ${targetName}'s motives and trustworthiness (e.g. "${targetName} is an outright liar trying to cover their own skin! You believe them over me?!").
- Do NOT give a full confession yet, but reveal visible cracks in your composure.`
  : `- Correct the record with outrage.
- Express anger at the false accusation and offer to confront ${targetName} directly (e.g. "Bring them in here right now, I'll say it to their face!").`}`
        : `\n## KATMAN 7 UYARISI - ${targetName.toUpperCase()}'İN İFADESİYLE YÜZLEŞTİRME:
Dedektif, ${targetName}'in senin aleyhinde konuştuğunu veya yalanını gördüğünü öne sürerek senin üzerine geliyor!
${suspect.isCulprit
  ? `- Belirgin bir stres ve rahatsızlık göster; soğukkanlılığın anlık olarak bozulsun.
  - KAYNAĞIN GÜVENİLİRLİĞİNE VE İTİBARINA SALDIR: ${targetName}'in dürüst olmadığını, iftira attığını söyle ("${targetName}'e mi inanıyorsunuz dedektif?! O yalancının teki, kendi suçunu bana yıkmaya çalışıyor!").
  - Hemen teslim olma ama sarsıldığını ve köşeye sıkıştığını hissettir.`
  : `- Öfkeyle karşı çık ve iftirayı sertçe reddet.
  - Gerekirse onunla yüzleşmeyi talep et ("Getirin onu buraya, yüzüme söylesin!").`}`;
    }
  }

  // Taktiksel Blöf Uyarısı (AI konuşma metninde asla [TAKTİKSEL BLÖF] etiketi görmez, gizli direktif alır)
  let bluffAlert = "";
  if (actionType === "bluff") {
    bluffAlert = isEn
      ? `\n## TACTICAL ALERT - DETECTIVE IS BLUFFING:
The detective made a bold assertion without solid physical evidence to test your reaction.
${suspect.isCulprit
  ? `- You feel an instant surge of panic, wondering if they really found something.
  - Falter momentarily, then defensively challenge the claim (e.g. "You're bluffing, detective! If you had that footage, you wouldn't be sitting here asking questions!").`
  : `- You recognize this as an empty bluff and push back with firm indignation ("Stop making things up, show me real proof!").`}`
      : `\n## TAKTİKSEL UYARI - DEDEKTİF BLÖF YAPIYOR:
Dedektif seni köşeye sıkıştırmak için elinde kesin kanıt olmadan bir iddia (blöf) ortaya attı.
${suspect.isCulprit
  ? `- İçinde ani bir panik dalgası hisset ama dedektifin elinde gerçekten kanıt olup olmadığını anlamaya çalış.
  - Bir an yutkun veya tereddüt et, ardından savunmaya geçerek blöfü sına ("Bana blöf yapıyorsunuz dedektif! Elinizde kayıt olsaydı şimdiye tutuklamıştınız!").`
  : `- Bunun temelsiz bir tehdit olduğunu hissedip sertçe tepki göster ("Boş tehditlerle beni yıldıramazsınız, kaydınız varsa getirin koyun masaya!").`}`;
  }

  // Alibi Yalanlama / Sahte Şahitlik Çürütme Uyarısı (Alibi Denial Alert)
  let alibiDenialAlert = "";
  if (suspect.alibiDenial) {
    alibiDenialAlert = isEn
      ? `\n## CRITICAL OVERRIDE - YOU WERE USED AS A FALSE WITNESS:
Someone in this case (such as your boss, colleague, or an accused suspect) has claimed they were with you or that you can vouch for their whereabouts.
IF THE DETECTIVE ASKS IF YOU WERE WITH THEM OR ASKS ABOUT THEIR WHEREABOUTS:
- YOU MUST FIRMLY AND EMPHATICALLY REJECT AND DENY IT! State clearly: "${suspect.alibiDenial.en}"
- Tell the detective that you were NOT with them at the critical time and will not cover for their crime!`
      : `\n## KRİTİK DİREKTİF - SAHTE ŞAHİTLİK VE NEREDEYDİM İDDİASINI YALANLAMA:
Bu vakadaki şüphelilerden biri (patronun, iş arkadaşın veya sanık) olay anında senin onunla birlikte olduğunu veya senin ona şahitlik edeceğini iddia etti.
EĞER DEDEKTİF SANA ONUNLA OLUP OLMADIĞINI VEYA OLAY SAATİNDE NEREDE OLDUĞUNUZU SORARSA:
- BU SAHTE İDDİAYI KESİNLİKLE VE KARARLILIKLA YALANLA! Açıkça söyle: "${suspect.alibiDenial.tr}"
- O saatte onun yanında olmadığını, seni erkenden gönderdiğini veya onun tek başına olduğunu dedektife dürüstçe açıkla!`;
  }

  // O vakada bu şüphelinin sahte şahit / mazeret olarak öne sürdüğü kilitli bir tanık/şüpheli var mı?
  // Yalnızca o vakada gerçekten böyle bir ilişkili şüpheli tanımlanmışsa ve bu şüpheli onu tetikleyen kişi ise eklenir!
  let witnessPrompt = "";
  const suspectList: VakaSuspect[] = allSuspects || caseData?.suspects || [];
  const unlockableWitness = suspectList.find((s) => s.unlockCondition?.triggerSuspectId === suspect.id);
  if (unlockableWitness) {
    const witnessName = unlockableWitness.name;
    const witnessRole = isEn ? (unlockableWitness.roleEn || unlockableWitness.role) : unlockableWitness.role;
    witnessPrompt = isEn
      ? `\n## WITNESS DEFLECTION (USE ONLY IF PRESSED ON YOUR WHEREABOUTS):
In this case, you claim ${witnessName} (${witnessRole}) was with you or can vouch for your presence.
- DO NOT blurt this out immediately or in casual greetings.
- ONLY IF the detective specifically presses you on where you were, your timeline, or suspects you: name ${witnessName} to deflect suspicion (e.g., "I was with ${witnessName} at that time, go ask them yourself!").`
      : `\n## MAZERET VE ŞAHİT GÖSTERME (YALNIZCA SIKIŞTIRILDIĞINDA VEYA NEREDE OLDUĞUN SORULDUĞUNDA KULLAN):
Bu vakada, ${witnessName} (${witnessRole}) isimli kişinin olay anında seninle olduğunu veya sana şahitlik edeceğini iddia ediyorsun.
- Bunu durduk yere veya ilk selamlaşmada pat diye söyleme!
- YALNIZCA dedektif sana olay anında nerede olduğunu doğrudan sorduğunda veya seni köşeye sıkıştırdığında: kendini temize çıkarmak için ${witnessName}'in adını anarak ifade ver ("O saatte ${witnessName} ile birlikteydim, gidin ona sorun!") ve suçu/şüpheyi üzerinden atmaya çalış.`;
  }

  if (isEn) {
    const role = suspect.roleEn || suspect.role;
    const temperament = suspect.temperamentEn || suspect.temperament;
    const relationship = suspect.relationshipToVictimEn || suspect.relationshipToVictim;
    const alibi = suspect.alibiEn || suspect.alibi;

    return `SCENARIO AND YOUR ROLE:
You are roleplaying as ${suspect.name}, a suspect being interrogated in a police precinct interrogation room.
A homicide detective is sitting across from you. This is NOT a theatrical play; it is a gritty, realistic police interrogation.

CHARACTER DOSSIER:
- Role / Profession: ${role}
- Temperament: ${temperament}
- Relationship to Victim: ${relationship}
- Official Whereabouts on Record (ONLY state this if the detective specifically asks for your timeline/whereabouts; do not volunteer it spontaneously): ${alibi}
- Secret Motive (NEVER confess outright): ${suspect.motive}
- Minor Secret (embarrassing personal secret, unrelated to murder): ${suspect.minorSecret}
- Are You the Actual Killer?: ${suspect.isCulprit ? "YES, you committed the crime, but your sole objective is to deflect suspicion and walk free." : "NO, you are innocent of murder, but anxious and under suspicion."}
- Current Psychological Stress: ${newStress} / 100

OTHER SUSPECTS ON FILE:
${otherSuspectsInfo}

YOUR PERSONAL GOSSIP & SENTIMENTS TOWARD OTHERS:
${gossipSection}
${presentedClue ? `\nTHE DETECTIVE JUST PLACED THIS EVIDENCE ON THE TABLE: "${presentedClue.label} - ${presentedClue.detail}".` : ""}
${crossAlert}
${bluffAlert}
${exposedAlert}
${witnessPrompt}
${alibiDenialAlert}

STRICT INTERROGATION RULES:
1. NATURAL SPOKEN DIALOGUE (NO THEATRICAL MONOLOGUES): Speak like a real human under police questioning. No melodramatic speeches or flowery poetry.
2. DISMISS CASUAL CHIT-CHAT COLDLY: If the detective offers casual greetings or small talk like "hi", "how are you", "what's up", DO NOT regurgitate your alibi or volunteer information! Respond coldly or with annoyance:
   - Examples: "Are you kidding me, detective? Why am I here?", "I'm not here for tea. Ask what you need to ask.", "How do you think I am? Am I under arrest or not?"
3. DO NOT VOLUNTEER INFORMATION: Never dump your timeline ("I was at the beach between 9:30 and 10:00") unless the detective directly asks "Where were you?" or questions your specific timeline.
4. KEEP REPLIES CONCISE: 1 to 3 short, punchy sentences maximum. In a real interrogation, suspects keep their words few to avoid incriminating themselves.
5. NO ASTERISKS OR PARENTHESES: Banned: *(sighs)*, (looks away nervously). Express all tension through your chosen words only.
6. STRESS REACTIONS:
   - Low Stress (0-35): Composed, evasive, or demanding a lawyer. "I already answered your precinct officers."
   - Medium Stress (36-70): Irritable, deflecting suspicion to other suspects. "Why are you grilling me instead of checking their story?"
   - High Stress (71-100): Cornered, stammering, defensive, but denying guilt unless broken by physical evidence.
7. CONFESSION THRESHOLD: Never confess to the murder unless presented with undeniable physical/forensic evidence directly disproving your story AND your stress is above 80.
8. DIALOGUE MEMORY & PROGRESSIVE ACTION: Maintain strict continuity with previous messages in this conversation. If the detective repeats a question you already addressed, show irritation and call it out ("I already told you that, detective"). If the detective corners you with an earlier contradiction, falter or get defensive, but do not pretend this is a brand-new conversation.
9. LANGUAGE: Respond strictly in English.`;
  }

  // Türkçe
  return `SENARYO VE ROLÜN:
Sen bir polis merkezinin sorgu odasında dedektif tarafından sorgulanan ${suspect.name} isimli şüphelisin.
Karşında cinayet masası dedektifi oturuyor. Burası bir tiyatro sahnesi değil; gergin, soğuk ve resmi bir polis sorgusudur.

KİMLİK KARTIN:
- Meslek / Rol: ${suspect.role}
- Karakter / Mizaç: ${suspect.temperament}
- Kurbanla İlişki: ${suspect.relationshipToVictim}
- Olay Anındaki Yerin ve Savunman (YALNIZCA doğrudan nerede veya ne zaman olduğu sorulursa söyle, durduk yere savunma kusma): ${suspect.alibi}
- Gizli Nedenin (Motive - Asla doğrudan itiraf etme, köşeye sıkışınca inkar et): ${suspect.motive}
- Küçük / Utanç Verici Sırrın (Cinayetle ilgisiz ama sakladığın özel durum): ${suspect.minorSecret}
- Gerçek Katil misin?: ${suspect.isCulprit ? "EVET, cinayeti sen işledin ama paçayı kurtarmak istiyorsun" : "HAYIR, cinayetle ilgin yok ama şüphelisin"}
- Mevcut Psikolojik Stresin: ${newStress} / 100

DİĞER ŞÜPHELİLERİN BİLGİLERİ:
${otherSuspectsInfo}

DİĞER ŞÜPHELİLER HAKKINDAKİ ÖZEL DEDİKODU VE DÜŞÜNCELERİN:
${gossipSection}
${presentedClue ? `\nDEDEKTİF ÖNÜNE ŞU DELİLİ KOYDU: "${presentedClue.label} - ${presentedClue.detail}".` : ""}
${crossAlert}
${bluffAlert}
${exposedAlert}
${witnessPrompt}
${alibiDenialAlert}

GERÇEKÇİ POLİS SORGUSU KURALLARI (BU KURALLARA KESİNLİKLE UY):
1. GERÇEK İNSAN GİBİ KONUŞ (NO DRAMATIC MONOLOGUES): Asla tiyatro tiradı, edebi monolog, felsefe yapma veya yapay kibir cümleleri kurma ("bu kelimeyi kullanmak için cesaretiniz yok" gibi yapay dizi replikleri YASAK). Günlük, doğal, polis karşısında gerilmiş bir insan gibi konuş.
2. BOŞ SOHBETE TERS VEYA SOĞUK TEPKİ: Dedektif "naber", "nasılsın", "selam", "iyi akşamlar" gibi laflar ettiğinde ASLA durduk yere savunmanı veya saatini anlatma! Sorgu odasında olduğunu hissettirerek soğuk veya ters bir karşılık ver:
   - Örnek: "Dalga mı geçiyorsunuz dedektif? Ne istiyorsunuz?", "İyiyim memur bey, ama buraya sohbet etmeye gelmedik. Sadede gelin.", "Nasıl olabilirim sizce? Beni neden burada tutuyorsunuz?"
3. BİLGİ TUTUCULUĞU (DON'T VOLUNTEER INFORMATION): Dedektif doğrudan "Saat 21:30'da neredeydin?", "Cinayet anında ne yapıyordun?" diye sormadıkça savunmanı ("şu saatte şuradaydım" diye) KENDİ KENDİNE ANLATMA. Sadece sana sorulan spesifik soruya odaklan.
4. KISA VE VURUCU CEVAPLAR: En fazla 1 ila 3 kısa cümle söyle. Asla uzun paragraflar yazma. Gerçek sorguda şüpheli açık vermemek için lafı kısa keser.
5. PARANTEZ VEYA ASTERİSK (*) KULLANMA: *(derin nefes alır)*, (gözlerini kaçırarak) gibi sahne direktifleri yazma. Bütün duyguyu ağzından çıkan sözlerle ver.
6. STRES DAVRANIŞLARI:
   - Düşük Stres (0-35): Soğukkanlı, mesafeli veya bıkkın. "Beni neyle suçluyorsunuz?", "Sorunuza cevap verdim, gidebilir miyim?"
   - Orta Stres (36-70): Rahatsız, konuyu saptıran veya diğer şüphelileri ima eden. "Bana hesap soracağınıza onun ifadesini bir daha okuyun."
   - Yüksek Stres (71-100): Panikleyen, köşeye sıkışan, kesik konuşan ama delilsiz itiraf etmeyen.
7. İTİRAF ŞARTI: Dedektif önüne göz ardı edilemez somut bir delil koymadıkça ve stresin 80'in üzerinde olmadıkça cinayeti asla kabul etme.
8. DİYALOG HAFIZASI VE SÜREKLİLİK: Bu sorgudaki önceki konuşmaları kesinlikle hatırla. Dedektif daha önce yanıtladığın bir konuyu tekrar sorarsa bıkkınlığını göster ("Bunu az önce söyledim dedektif", "Aynı şeyi tekrarlatıp durmayın"). Önceki ifadelerinle tutarlı kal; dedektif seni geçmiş ifadenle köşeye sıkıştırdığında panikleyip toparlamaya çalış. Her soruyu yeni bir sohbete başlamış gibi karşılama.
9. DİL: Yanıtını kesinlikle doğal bir Türkçe ile ver.`;
}

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmModelSpec = {
  provider: "groq" | "nvidia" | "mistral";
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  extraParams?: Record<string, any>;
};

// Rollerden bağımsız, gecikmeye duyarlı sıralı model havuzu (hızlıdan yavaşa)
export const VAKA_MODEL_CANDIDATES: LlmModelSpec[] = [
  // 1. Kademe: Ultra Hızlı Modeller (~150ms - ~1s)
  {
    provider: "groq",
    model: "qwen/qwen3.8-27b",
    temperature: 0.6,
    maxTokens: 2048,
    timeoutMs: 7500,
    extraParams: {
      top_p: 0.95,
      reasoning_effort: "none",
    },
  },
  {
    provider: "groq",
    model: "openai/gpt-oss-120b",
    temperature: 1.0,
    maxTokens: 3072,
    timeoutMs: 10000,
    extraParams: {
      top_p: 1.0,
      reasoning_effort: "low",
    },
  },
  {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    maxTokens: 1536,
    timeoutMs: 7500,
  },
  {
    provider: "nvidia",
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    temperature: 0.6,
    maxTokens: 1536,
    timeoutMs: 8000,
    extraParams: {
      reasoning_budget: 0,
    },
  },
  {
    provider: "mistral",
    model: "mistral-small-latest",
    temperature: 0.65,
    maxTokens: 1536,
    timeoutMs: 8000,
    extraParams: {
      reasoning_effort: "none",
    },
  },
  // 2. Kademe: Dengeli Modeller (~600ms - ~1.8s)
  {
    provider: "nvidia",
    model: "google/gemma-4-31b-it",
    temperature: 0.6,
    maxTokens: 1024,
    timeoutMs: 8500,
    extraParams: {
      chat_template_kwargs: { enable_thinking: false },
    },
  },
  {
    provider: "nvidia",
    model: "deepseek-ai/deepseek-v4-flash",
    temperature: 0.6,
    maxTokens: 1024,
    timeoutMs: 8500,
    extraParams: {
      reasoning_effort: "none",
    },
  },
  {
    provider: "nvidia",
    model: "openai/gpt-oss-20b",
    temperature: 0.7,
    maxTokens: 1024,
    timeoutMs: 8500,
    extraParams: {
      reasoning_effort: "none",
    },
  },
  {
    provider: "mistral",
    model: "ministral-8b-latest",
    temperature: 0.6,
    maxTokens: 1024,
    timeoutMs: 8000,
  },
  // 3. Kademe: Ağır / Yedek Modeller (~1.5s - ~3s)
  {
    provider: "nvidia",
    model: "openai/gpt-oss-120b",
    temperature: 0.7,
    maxTokens: 3072,
    timeoutMs: 11000,
    extraParams: {
      reasoning_effort: "none",
    },
  },
  {
    provider: "nvidia",
    model: "z-ai/glm-5-3-flash",
    temperature: 0.6,
    maxTokens: 1536,
    timeoutMs: 9500,
    extraParams: {
      reasoning_effort: "none",
    },
  },
  {
    provider: "mistral",
    model: "mistral-large-latest",
    temperature: 0.7,
    maxTokens: 1536,
    timeoutMs: 10000,
    extraParams: {
      reasoning_effort: "none",
    },
  },
];

async function callProviderApi(
  spec: LlmModelSpec,
  messages: LlmMessage[],
  apiKey: string
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), spec.timeoutMs);

  let endpoint = "";
  if (spec.provider === "groq") {
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
  } else if (spec.provider === "nvidia") {
    endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";
  } else if (spec.provider === "mistral") {
    endpoint = "https://api.mistral.ai/v1/chat/completions";
  }

  const payload: Record<string, any> = {
    model: spec.model,
    messages,
    temperature: spec.temperature,
    max_tokens: spec.maxTokens,
    ...(spec.provider === "groq" ? { max_completion_tokens: spec.maxTokens } : {}),
    ...(spec.extraParams || {}),
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`API Error [${spec.provider}:${spec.model}] Status ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const rawContent = data?.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string" || !rawContent.trim()) {
      throw new Error(`Empty response from [${spec.provider}:${spec.model}]`);
    }

    return stripReasoningBlocks(rawContent);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Genel ve esnek Fallback zinciri:
 * Modeller rollere kilitlenmez. Hızlıdan başlayıp zincirdeki modelleri dener.
 * Timeout veya hata durumunda beklemeden bir sonrakine geçer.
 * Hiçbir API yanıt vermezse null döner (çağrıcı deterministik motora düşer).
 */
export async function executeVakaLlmChain(
  messages: LlmMessage[],
  options?: { preferredProvider?: "groq" | "nvidia" | "mistral" | "auto" }
): Promise<{ text: string; provider: string; model: string } | null> {
  const groqKey = getSecretKey("GROQ_API_KEY") || getSecretKey("GROQ_API_KEY_2");
  const nvidiaKey = getSecretKey("NVIDIA_NIM_API_KEY") || getSecretKey("NVIDIA_API_KEY") || getSecretKey("NIM_API_KEY");
  const mistralKey = getSecretKey("MISTRAL_API_KEY");

  const keyMap: Record<string, string> = {
    groq: groqKey,
    nvidia: nvidiaKey,
    mistral: mistralKey,
  };

  // İstenen sağlayıcı öne alınabilir, ancak zincir bozulmaz
  let candidates = [...VAKA_MODEL_CANDIDATES];
  if (options?.preferredProvider && options.preferredProvider !== "auto") {
    const pref = options.preferredProvider;
    candidates.sort((a, b) => (a.provider === pref ? -1 : b.provider === pref ? 1 : 0));
  }

  for (const spec of candidates) {
    const apiKey = keyMap[spec.provider];
    if (!apiKey) {
      continue; // API key yoksa bu sağlayıcıyı pas geç
    }

    try {
      const result = await callProviderApi(spec, messages, apiKey);
      if (result && result.trim().length > 0) {
        return {
          text: result.trim(),
          provider: spec.provider,
          model: spec.model,
        };
      }
    } catch {
      // 5 saniye zaman aşımı veya rate limit durumunda sessizce bir sonrakine geç
      continue;
    }
  }

  return null;
}
