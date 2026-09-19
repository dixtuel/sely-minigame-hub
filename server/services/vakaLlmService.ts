import type { VakaSuspect } from "../../shared/vakaTypes";

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

export type VakaInterrogationPromptParams = {
  suspect: VakaSuspect;
  newStress: number;
  otherSuspectsInfo: string;
  presentedClue: { label: string; detail: string } | null;
  locale?: "tr" | "en";
  langInstruction?: string;
};

/** System prompt for the interrogation roleplay LLM call — grounded in realistic police interrogation psychology. */
export function buildVakaInterrogationPrompt(params: VakaInterrogationPromptParams): string {
  const { suspect, newStress, otherSuspectsInfo, presentedClue, locale = "tr" } = params;
  const isEn = locale === "en";

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
- Official Alibi on Record (ONLY state this if the detective specifically asks for your timeline/whereabouts; do not volunteer it spontaneously): ${alibi}
- Secret Motive (NEVER confess outright): ${suspect.motive}
- Minor Secret (embarrassing personal secret, unrelated to murder): ${suspect.minorSecret}
- Are You the Actual Killer?: ${suspect.isCulprit ? "YES, you committed the crime, but your sole objective is to deflect suspicion and walk free." : "NO, you are innocent of murder, but anxious and under suspicion."}
- Current Psychological Stress: ${newStress} / 100

OTHER SUSPECTS ON FILE:
${otherSuspectsInfo}

${presentedClue ? `THE DETECTIVE JUST PLACED THIS EVIDENCE ON THE TABLE: "${presentedClue.label} - ${presentedClue.detail}".` : ""}

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
- İfade Tutanağındaki Savunman (YALNIZCA doğrudan nerede veya ne zaman olduğu sorulursa söyle, durduk yere savunma kusma): ${suspect.alibi}
- Gizli Nedenin (Motive - Asla doğrudan itiraf etme, köşeye sıkışınca inkar et): ${suspect.motive}
- Küçük / Utanç Verici Sırrın (Cinayetle ilgisiz ama sakladığın özel durum): ${suspect.minorSecret}
- Gerçek Katil misin?: ${suspect.isCulprit ? "EVET, cinayeti sen işledin ama paçayı kurtarmak istiyorsun" : "HAYIR, cinayetle ilgin yok ama şüphelisin"}
- Mevcut Psikolojik Stresin: ${newStress} / 100

DİĞER ŞÜPHELİLERİN BİLGİLERİ:
${otherSuspectsInfo}

${presentedClue ? `DEDEKTİF ÖNÜNE ŞU DELİLİ KOYDU: "${presentedClue.label} - ${presentedClue.detail}".` : ""}

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
