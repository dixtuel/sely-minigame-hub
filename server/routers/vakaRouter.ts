import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { VAKA_SAMPLE_CASES } from "../../shared/vakaCases";
import type { VakaConfig, VakaGameMode, VakaDetailedCase } from "../../shared/vakaTypes";
import { executeVakaLlmChain, hasLlmApiKey, buildVakaInterrogationPrompt, type LlmMessage } from "../services/vakaLlmService";
import { processDeterministicInterrogation, type InterrogationActionType } from "../services/vakaDeterministicEngine";

/** Public-safe case shape shared by getCaseDetail and getDailyCase — redacts contradiction-explanation spoilers. */
function toPublicCaseDto(found: VakaDetailedCase) {
  return {
    id: found.id,
    title: found.title,
    titleEn: found.titleEn,
    difficulty: found.difficulty,
    briefing: found.briefing,
    briefingEn: found.briefingEn,
    incidentTime: found.incidentTime,
    location: found.location,
    locationEn: found.locationEn,
    victim: found.victim,
    timeline: found.timeline,
    crimeSceneNotes: found.crimeSceneNotes,
    analystSummary: found.analystSummary,
    suspects: found.suspects.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      roleEn: s.roleEn,
      age: s.age,
      temperament: s.temperament,
      temperamentEn: s.temperamentEn,
      relationshipToVictim: s.relationshipToVictim,
      relationshipToVictimEn: s.relationshipToVictimEn,
      statement: s.statement,
      statementEn: s.statementEn,
      alibi: s.alibi,
      alibiEn: s.alibiEn,
      detailedStatements: s.detailedStatements.map((sent) => ({
        id: sent.id,
        text: sent.text,
        textEn: sent.textEn,
        isContradiction: sent.isContradiction,
        contradictionClueId: sent.contradictionClueId,
      })),
    })),
    clues: found.clues,
  };
}

function getVakaConfig(): VakaConfig {
  const envModes = process.env.VAKA_ENABLED_MODES;
  let enabledModes: VakaGameMode[] = ["daily", "interrogation", "contradiction"];
  if (envModes) {
    const parsed = envModes.split(",").map((m) => m.trim().toLowerCase()) as VakaGameMode[];
    const valid = parsed.filter((m) => ["daily", "interrogation", "contradiction"].includes(m));
    if (valid.length > 0) enabledModes = valid;
  }

  let defaultMode: VakaGameMode = "daily";
  const envDefault = process.env.VAKA_DEFAULT_MODE?.trim().toLowerCase() as VakaGameMode;
  if (envDefault && enabledModes.includes(envDefault)) {
    defaultMode = envDefault;
  } else if (!enabledModes.includes("daily")) {
    defaultMode = enabledModes[0];
  }

  const hasLlmKeys = hasLlmApiKey();

  return {
    enabledModes,
    defaultMode,
    hasLlmKeys,
  };
}

export const vakaRouter = router({
  config: publicProcedure.query(() => {
    return getVakaConfig();
  }),

  getCases: publicProcedure.query(() => {
    return VAKA_SAMPLE_CASES.map((c) => ({
      id: c.id,
      title: c.title,
      titleEn: c.titleEn,
      difficulty: c.difficulty,
      briefing: c.briefing,
      briefingEn: c.briefingEn,
      incidentTime: c.incidentTime,
      location: c.location,
      locationEn: c.locationEn,
      victim: c.victim,
      suspectCount: c.suspects.length,
      clueCount: c.clues.length,
    }));
  }),

  getCaseDetail: publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ input }) => {
      const found = VAKA_SAMPLE_CASES.find((c) => c.id === input.caseId) || VAKA_SAMPLE_CASES[0];
      return toPublicCaseDto(found);
    }),

  getDailyCase: publicProcedure.query(() => {
    const today = new Date();
    const dayIndex = (today.getFullYear() * 365 + today.getMonth() * 31 + today.getDate()) % VAKA_SAMPLE_CASES.length;
    const selected = VAKA_SAMPLE_CASES[dayIndex] || VAKA_SAMPLE_CASES[0];

    return {
      date: today.toISOString().split("T")[0],
      caseIndex: dayIndex + 1,
      case: toPublicCaseDto(selected),
    };
  }),

  interrogate: publicProcedure
    .input(
      z.object({
        caseId: z.string(),
        suspectId: z.string(),
        actionType: z.enum(["question", "present_evidence", "cross_examine", "stay_silent", "bluff", "confront"]).default("question"),
        question: z.string().max(300).optional(),
        presentedClueId: z.string().optional(),
        crossSuspectId: z.string().optional(),
        crossQuote: z.string().optional(),
        bluffClaim: z.string().optional(),
        currentStress: z.number().min(0).max(100).default(10),
        locale: z.enum(["tr", "en"]).default("tr"),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const caseData = VAKA_SAMPLE_CASES.find((c) => c.id === input.caseId) || VAKA_SAMPLE_CASES[0];
      const suspect = caseData.suspects.find((s) => s.id === input.suspectId);
      if (!suspect) {
        throw new Error("Suspect not found");
      }

      // Deterministik kural motorunu işlet
      const deterministic = processDeterministicInterrogation(
        caseData,
        input.suspectId,
        input.actionType as InterrogationActionType,
        {
          question: input.question,
          presentedClueId: input.presentedClueId,
          crossSuspectId: input.crossSuspectId,
          crossQuote: input.crossQuote,
          bluffClaim: input.bluffClaim,
        },
        input.currentStress,
        input.locale
      );

      let replyText = deterministic.text;
      let source: "llm" | "engine" = "engine";
      let llmProviderUsed = "";
      let llmModelUsed = "";

      const hasKeys = hasLlmApiKey();

      // Canlı LLM denemesi (Eğer soru serbestse ve henüz itiraf gerçekleşmediyse)
      if (hasKeys && !deterministic.confessed && (input.actionType === "question" || input.actionType === "cross_examine")) {
        const langInstruction = input.locale === "en" ? "Respond in English." : "Türkçe yanıt ver.";
        const presentedClue = input.presentedClueId
          ? caseData.clues.find((c) => c.id === input.presentedClueId) ?? null
          : null;

        const otherSuspectsInfo = caseData.suspects
          .filter((s) => s.id !== suspect.id)
          .map((s) => `- ${s.name} (${s.role}): ${s.statement}`)
          .join("\n");

        const systemPrompt = buildVakaInterrogationPrompt({
          suspect,
          newStress: deterministic.newStress,
          otherSuspectsInfo,
          presentedClue,
          langInstruction,
        });

        const userPrompt = input.actionType === "cross_examine" && input.crossSuspectId
          ? `Detective says: "${caseData.suspects.find(s => s.id === input.crossSuspectId)?.name} told me you were lying about your whereabouts!"`
          : input.question || "Explain yourself!";

        const messages: LlmMessage[] = [
          { role: "system", content: systemPrompt },
          ...(input.history || []).slice(-4).map((h) => ({
            role: h.role === "user" ? ("user" as const) : ("assistant" as const),
            content: h.content,
          })),
          { role: "user", content: userPrompt },
        ];

        try {
          const llmResult = await executeVakaLlmChain(messages);
          if (llmResult && llmResult.text) {
            replyText = llmResult.text;
            source = "llm";
            llmProviderUsed = llmResult.provider;
            llmModelUsed = llmResult.model;
          }
        } catch {
          // LLM başarısız olursa deterministik motor yanıtı korunur
        }
      }

      return {
        reply: replyText,
        behavioralCue: deterministic.behavioralCue,
        stress: deterministic.newStress,
        stressDelta: deterministic.stressDelta,
        confessed: deterministic.confessed,
        unlockedClueId: deterministic.unlockedClueId,
        source,
        provider: llmProviderUsed || undefined,
        model: llmModelUsed || undefined,
      };
    }),

  checkContradiction: publicProcedure
    .input(
      z.object({
        caseId: z.string(),
        suspectId: z.string(),
        sentenceId: z.string(),
        clueId: z.string(),
        locale: z.enum(["tr", "en"]).default("tr"),
      })
    )
    .mutation(({ input }) => {
      const caseData = VAKA_SAMPLE_CASES.find((c) => c.id === input.caseId) || VAKA_SAMPLE_CASES[0];
      const suspect = caseData.suspects.find((s) => s.id === input.suspectId);
      if (!suspect) throw new Error("Suspect not found");

      const sentence = suspect.detailedStatements.find((s) => s.id === input.sentenceId);
      const clue = caseData.clues.find((c) => c.id === input.clueId);

      if (!sentence || !clue) {
        return {
          success: false,
          message: input.locale === "en" ? "Invalid selection." : "Geçersiz seçim.",
          penalty: 0,
        };
      }

      const isMatch = sentence.isContradiction && sentence.contradictionClueId === clue.id;

      if (isMatch) {
        return {
          success: true,
          message:
            input.locale === "en"
              ? sentence.explanationEn || "OBJECTION! The testimony directly contradicts the physical evidence!"
              : sentence.explanation || "İTİRAZ! İfade doğrudan fiziksel kanıtla çelişiyor!",
          penalty: 0,
        };
      }

      return {
        success: false,
        message:
          input.locale === "en"
            ? "OBJECTION OVERRULED! This clue does not disprove this specific statement."
            : "İTİRAZ REDDEDİLDİ! Bu kanıt seçtiğin cümleyi yalanlamıyor.",
        penalty: 15,
      };
    }),

  accuse: publicProcedure
    .input(
      z.object({
        caseId: z.string(),
        accusedId: z.string(),
        method: z.string().optional(),
        motive: z.string().optional(),
        decisiveClueId: z.string(),
        locale: z.enum(["tr", "en"]).default("tr"),
      })
    )
    .mutation(({ input }) => {
      const caseData = VAKA_SAMPLE_CASES.find((c) => c.id === input.caseId) || VAKA_SAMPLE_CASES[0];
      const suspect = caseData.suspects.find((s) => s.id === input.accusedId);
      const isCulprit = caseData.culpritId === input.accusedId;
      const isCorrectClue = caseData.winningContradiction.clueId === input.decisiveClueId;

      const success = isCulprit && isCorrectClue;

      let score = 0;
      let grade: "S" | "A" | "B" | "C" = "C";

      if (success) {
        score = 280;
        grade = "S";
      } else if (isCulprit && !isCorrectClue) {
        score = 140;
        grade = "B";
      }

      return {
        success,
        grade,
        score,
        verdict: success ? ("guilty" as const) : ("not_guilty" as const),
        culpritName: caseData.suspects.find((s) => s.id === caseData.culpritId)?.name || "",
        confession: success
          ? input.locale === "en"
            ? suspect?.confessionEn
            : suspect?.confession
          : undefined,
        message: success
          ? input.locale === "en"
            ? `CASE CLOSED! ${suspect?.name} was formally indicted. The court unanimously accepted the charges.`
            : `VAKA KAPANDI! ${suspect?.name} resmen tutuklandı. Mahkeme sunduğun delilleri eksiksiz kabul etti.`
          : input.locale === "en"
          ? "CHARGES DISMISSED! Insufficient evidence or wrong suspect. The true culprit walked free."
          : "DAVA DÜŞTÜ! Yetersiz delil veya yanlış şüpheli suçlandı. Gerçek fail serbest kaldı.",
      };
    }),
});
