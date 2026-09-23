import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { logger } from "../_core/logger";
import { VAKA_SAMPLE_CASES } from "../../shared/vakaCases";
import type { VakaConfig, VakaGameMode, VakaDetailedCase } from "../../shared/vakaTypes";
import {
  executeVakaLlmChain,
  hasLlmApiKey,
  buildVakaInterrogationPrompt,
  cleanInterrogationText,
  type LlmMessage,
} from "../services/vakaLlmService";
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
      detailedStatements: s.detailedStatements.map((ds) => ({
        id: ds.id,
        text: ds.text,
        textEn: ds.textEn,
        isContradiction: ds.isContradiction,
      })),
      gossip: s.gossip,
      behavioralCues: s.behavioralCues,
      isInitiallyLocked: Boolean(s.isInitiallyLocked),
      unlockCondition: s.unlockCondition,
      alibiDenial: s.alibiDenial,
    })),
    clues: found.clues.map((c) => ({
      id: c.id,
      label: c.label,
      labelEn: c.labelEn,
      detail: c.detail,
      detailEn: c.detailEn,
      category: c.category,
      type: c.type,
      significance: c.significance,
      significanceEn: c.significanceEn,
    })),
  };
}

function semanticFieldMatch(answer: string | undefined, expected: string): boolean {
  // Keep this compatible with the app's ES5 TypeScript target; Turkish letters are
  // preserved because the separator list only contains punctuation/whitespace.
  const tokenize = (value: string) => value
    .toLocaleLowerCase("tr-TR")
    .split(/[ ,.;:!?()[\]{}"'/\\\-_*+=<>|`~@#$%^&\n\r\t]+/)
    .filter(t => t.length >= 3);
  const answerTokens = tokenize(answer || "");
  const expectedTokens = tokenize(expected);
  const answerSet: { [token: string]: boolean } = {};
  answerTokens.forEach(token => { answerSet[token] = true; });
  if (!answerTokens.length || !expectedTokens.length) return false;
  const overlap = expectedTokens.filter(token => answerSet[token]).length;
  return overlap >= 2 || overlap / expectedTokens.length >= 0.28;
}

export const vakaRouter = router({
  config: publicProcedure.query((): VakaConfig => {
    return {
      enabledModes: ["interrogation", "contradiction", "daily"],
      defaultMode: "interrogation",
      hasLlmKeys: hasLlmApiKey(),
    };
  }),

  getConfig: publicProcedure.query((): VakaConfig => {
    return {
      enabledModes: ["interrogation", "contradiction", "daily"],
      defaultMode: "interrogation",
      hasLlmKeys: hasLlmApiKey(),
    };
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
        question: z.string().max(400).optional(),
        presentedClueId: z.string().optional(),
        crossSuspectId: z.string().optional(),
        crossMode: z.enum(["ask_about", "confront"]).optional(),
        crossQuote: z.string().optional(),
        bluffClaim: z.string().optional(),
        isExposedByContradiction: z.boolean().optional(),
        isFinalInterrogation: z.boolean().optional(),
        exposedSentenceId: z.string().optional(),
        exposedClueId: z.string().optional(),
        currentStress: z.number().min(0).max(100).default(10),
        locale: z.enum(["tr", "en"]).default("tr"),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
              actionType: z.string().optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const caseData = VAKA_SAMPLE_CASES.find((c) => c.id === input.caseId) || VAKA_SAMPLE_CASES[0];
      const suspect = caseData.suspects.find((s) => s.id === input.suspectId) || caseData.suspects[0];

      // Dedektifin sözlerini ve geçmişini yapay etiketlerden ([TAKTİKSEL BLÖF] vb.) arındır
      const cleanQuestion = cleanInterrogationText(input.question || "");
      const cleanHistory = (input.history || []).map((h) => ({
        role: h.role,
        content: cleanInterrogationText(h.content),
        actionType: h.actionType,
      }));

      // Çelişki Avı tespiti bilgisi (varsa)
      let exposedInfo: { sentence?: string; clue?: string; explanation?: string } | undefined = undefined;
      if (input.isExposedByContradiction) {
        const st = suspect.detailedStatements.find((s) => s.id === input.exposedSentenceId);
        const cl = caseData.clues.find((c) => c.id === input.exposedClueId);
        exposedInfo = {
          sentence: input.locale === "en" ? (st?.textEn || st?.text) : st?.text,
          clue: input.locale === "en" ? (cl?.labelEn || cl?.label) : cl?.label,
          explanation: input.locale === "en" ? (st?.explanationEn || st?.explanation) : st?.explanation,
        };
      }

      // Çapraz Referans Tespiti (Serbest soruda başka bir şüphelinin adı geçiyorsa veya butonla seçilmişse)
      let crossSuspect = input.crossSuspectId
        ? caseData.suspects.find((s) => s.id === input.crossSuspectId) || null
        : null;
      let crossMode = input.crossMode || (input.actionType === "cross_examine" ? "confront" : undefined);

      if (!crossSuspect && cleanQuestion) {
        const lowerQ = cleanQuestion.toLowerCase();
        const foundOther = caseData.suspects.find(
          (s) => s.id !== suspect.id && lowerQ.includes(s.name.toLowerCase())
        );
        if (foundOther) {
          crossSuspect = foundOther;
          crossMode = "ask_about";
        }
      }

      // Deterministik kural motorunu işlet
      const deterministic = processDeterministicInterrogation(
        caseData,
        suspect.id,
        input.actionType as InterrogationActionType,
        {
          question: cleanQuestion,
          presentedClueId: input.presentedClueId,
          crossSuspectId: crossSuspect ? crossSuspect.id : input.crossSuspectId,
          crossMode,
          crossQuote: input.crossQuote,
          bluffClaim: input.bluffClaim,
          isExposedByContradiction: input.isExposedByContradiction,
          exposedContradictionInfo: exposedInfo,
          history: cleanHistory,
        },
        input.currentStress,
        input.locale
      );

      let replyText = deterministic.text;
      let source: "llm" | "engine" = "engine";
      let llmProviderUsed = "";
      let llmModelUsed = "";

      const hasKeys = hasLlmApiKey();

      // Canlı LLM denemesi: serbest soru, çapraz sorgu veya taktiksel blöf durumlarında çalışır
      if (
        hasKeys &&
        !deterministic.confessed &&
        (input.actionType === "question" || input.actionType === "cross_examine" || input.actionType === "bluff")
      ) {
        const isEn = input.locale === "en";
        const presentedClue = input.presentedClueId
          ? caseData.clues.find((c) => c.id === input.presentedClueId) ?? null
          : null;

        const otherSuspectsInfo = caseData.suspects
          .filter((s) => s.id !== suspect.id)
          .map((s) => `- ${s.name} (${isEn ? (s.roleEn || s.role) : s.role}): ${isEn ? (s.statementEn || s.statement) : s.statement}`)
          .join("\n");

        const systemPrompt = buildVakaInterrogationPrompt({
          suspect,
          newStress: deterministic.newStress,
          otherSuspectsInfo,
          presentedClue,
          actionType: input.actionType as any,
          crossSuspect,
          crossMode,
          isExposedByContradiction: input.isExposedByContradiction,
          exposedContradictionInfo: exposedInfo,
          caseData,
          locale: input.locale,
        });

        let userPrompt = cleanQuestion;
        if (input.actionType === "cross_examine" && crossSuspect) {
          if (crossMode === "ask_about") {
            userPrompt = isEn
              ? `What can you tell me about ${crossSuspect.name}? Did you notice anything suspicious about them that night?`
              : `${crossSuspect.name} hakkında ne biliyorsun? O gece onunla ilgili şüpheli bir şey gördün mü?`;
          } else {
            userPrompt = isEn
              ? `${crossSuspect.name} claims you were lying about your whereabouts and saw you near the scene! How do you explain that?!`
              : `${crossSuspect.name} senin olay anında yalan söylediğini ve suç mahallinin yakınında olduğunu anlattı! Buna ne diyeceksin?!`;
          }
        } else if (input.actionType === "bluff") {
          userPrompt = cleanQuestion || (isEn
            ? "We already have surveillance footage and forensic records proving you were there!"
            : "O saatte orada olduğunu gösteren gizli kamera kayıtları ve adli tıp raporları elimizde!");
        } else if (!userPrompt) {
          userPrompt = isEn ? "Explain yourself!" : "Kendini açıkla!";
        }

        const messages: LlmMessage[] = [
          { role: "system", content: systemPrompt },
          ...cleanHistory.slice(-10).map((h) => ({
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
        } catch (err) {
          logger.warn("vaka", "Vaka LLM fallback triggered", { err: err instanceof Error ? err.message : String(err) });
        }
      }

      let unlockedSuspectId = deterministic.unlockedSuspectId;
      let unlockedSuspectName = deterministic.unlockedSuspectName;

      // LLM veya deterministik çıktıda kilitli şüpheli tetiklendi mi?
      if (!unlockedSuspectId) {
        const lockedSuspects = caseData.suspects.filter((s) => s.isInitiallyLocked);
        const replyLower = replyText.toLowerCase();
        const qCleanLower = cleanQuestion.toLowerCase();
        const crossQuoteLower = (input.crossQuote || "").toLowerCase();

        for (const ls of lockedSuspects) {
          if (!ls.unlockCondition) continue;
          const { keywords, triggerSuspectId } = ls.unlockCondition;
          if (triggerSuspectId && triggerSuspectId !== suspect.id) continue;

          // Şüphelinin cevabında bu şahitten/kişiden bahsedildi mi?
          const mentionedInReply = keywords.some((kw) => replyLower.includes(kw.toLowerCase()));
          // Veya dedektif doğrudan bu kişiyi sordu mu / çapraz sorguladı mı?
          const askedDirectly =
            keywords.some((kw) => qCleanLower.includes(kw.toLowerCase()) || crossQuoteLower.includes(kw.toLowerCase())) ||
            input.crossSuspectId === ls.id;

          if (mentionedInReply || askedDirectly) {
            unlockedSuspectId = ls.id;
            unlockedSuspectName = ls.name;
            break;
          }
        }
      }

      // LLM veya deterministik çıktıda tanık yalanlaması ve resmi ifade delili tetiklendi mi?
      let unlockedClueId = deterministic.unlockedClueId;
      let unlockedClueLabel = deterministic.unlockedClueLabel || "";

      if (suspect.alibiDenial && !unlockedClueId) {
        const cleanKey = suspect.id.replace("suspect-", "");
        const testimonyClue = caseData.clues.find(
          (c) => c.category === "witness" && c.type === "alibi" && c.id.includes(cleanKey)
        ) || caseData.clues.find(
          (c) => c.category === "witness" && c.type === "alibi" && (c.contradictsSuspectId || c.clearsSuspectId)
        );

        if (testimonyClue) {
          const replyLower = replyText.toLowerCase();
          const qLower = cleanQuestion.toLowerCase();
          const triggerSuspect = caseData.suspects.find(
            (s) => s.id === suspect.unlockCondition?.triggerSuspectId
          );
          const triggerNameParts = triggerSuspect
            ? triggerSuspect.name.toLowerCase().split(/\s+/)
            : [];
          const mentionsTriggerSuspect = triggerNameParts.some(
            (part) => part.length > 2 && qLower.includes(part)
          );

          const denialKeywords = [
            "yalan", "lie", "doğru değil", "not true", "birlikte değildik",
            "never", "iftira", "asla", "sahte", "tamamen yalan", "kesinlikle yalan",
            "yanımda değildi", "birlikte oturmadık", "şahitlik"
          ];
          const isDenialPresent =
            denialKeywords.some((k) => replyLower.includes(k)) ||
            (suspect.alibiDenial.tr && replyLower.includes(suspect.alibiDenial.tr.toLowerCase().slice(0, 25))) ||
            (suspect.alibiDenial.en && replyLower.includes(suspect.alibiDenial.en.toLowerCase().slice(0, 25))) ||
            input.actionType === "cross_examine" ||
            mentionsTriggerSuspect ||
            qLower.includes("çay") ||
            qLower.includes("cay") ||
            qLower.includes("akü") ||
            qLower.includes("prova") ||
            qLower.includes("kafe") ||
            qLower.includes("birlikte") ||
            qLower.includes("beraber") ||
            qLower.includes("neredeydin") ||
            qLower.includes("neredeydi") ||
            qLower.includes("saat") ||
            qLower.includes("alibi") ||
            qLower.includes("doğru mu") ||
            qLower.includes("is that true");

          if (isDenialPresent) {
            unlockedClueId = testimonyClue.id;
            unlockedClueLabel = input.locale === "en" ? (testimonyClue.labelEn || testimonyClue.label) : testimonyClue.label;
            if (mentionsTriggerSuspect && !denialKeywords.some((k) => replyLower.includes(k))) {
              replyText = input.locale === "en" ? suspect.alibiDenial.en : suspect.alibiDenial.tr;
            }
          }
        }
      }

      return {
        reply: replyText,
        behavioralCue: deterministic.behavioralCue,
        stress: deterministic.newStress,
        stressDelta: deterministic.stressDelta,
        confessed: deterministic.confessed,
        finalInterrogationAvailable:
          Boolean(input.isExposedByContradiction && suspect.isCulprit && !input.isFinalInterrogation && !deterministic.confessed),
        unlockedClueId,
        unlockedClueLabel: unlockedClueLabel || undefined,
        unlockedSuspectId,
        unlockedSuspectName,
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
      const methodMatch = semanticFieldMatch(input.method, input.locale === "en" ? caseData.correctMethodEn : caseData.correctMethod);
      const motiveMatch = semanticFieldMatch(input.motive, input.locale === "en" ? caseData.correctMotiveEn : caseData.correctMotive);

      const success = isCulprit && isCorrectClue;

      let score = 0;
      let grade: "S" | "A" | "B" | "C" = "C";

      if (success && methodMatch && motiveMatch) {
        score = 320;
        grade = "S";
      } else if (success && (methodMatch || motiveMatch)) {
        score = 300;
        grade = "A";
      } else if (success) {
        score = 280;
        grade = "B";
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
        methodMatch,
        motiveMatch,
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
