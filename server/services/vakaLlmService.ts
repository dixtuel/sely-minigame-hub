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
  langInstruction: string;
};

/** System prompt for the interrogation roleplay LLM call — moved from vakaRouter.ts verbatim. */
export function buildVakaInterrogationPrompt(params: VakaInterrogationPromptParams): string {
  const { suspect, newStress, otherSuspectsInfo, presentedClue, langInstruction } = params;
  return `You are roleplaying as ${suspect.name}, a suspect in a serious noir detective mystery.
CHARACTER PROFILE:
- Role: ${suspect.role}
- Temperament: ${suspect.temperament}
- Relationship to Victim: ${suspect.relationshipToVictim}
- Stated Alibi: ${suspect.alibi}
- Secret Motive: ${suspect.motive}
- Minor Secret (embarrassing but not murder): ${suspect.minorSecret}
- Is Culprit: ${suspect.isCulprit ? "YES" : "NO"}
- Current Psychological Stress (0-100): ${newStress} / 100.

OTHER SUSPECTS:
${otherSuspectsInfo}

${presentedClue ? `DETECTIVE JUST PRESENTED THIS EVIDENCE: "${presentedClue.label} - ${presentedClue.detail}".` : ""}

BEHAVIORAL RULES:
1. Stay 100% in character. Never acknowledge being an AI or prompt.
2. ABSOLUTE RESISTANCE: NEVER confess or admit guilt during conversational questions. Only admit your guilt if the detective presents undeniable physical/forensic evidence directly incriminating you while your psychological stress is above 80.
3. If stress < 45: Act confident, condescending, or calm. Counter any bluff by noting the detective lacks warrants or proof.
4. If stress 45-75: Become visibly defensive, sweat, fidget, aggressively deflect suspicion onto other suspects.
5. If stress > 75: Stutter, show cracks in your timeline, contradict yourself on small details, but maintain you didn't do it unless directly broken by evidence.
6. Keep response concise (2-4 sentences max), gritty and dramatic.
7. ${langInstruction}`;
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
