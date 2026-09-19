export type VakaGameMode = "interrogation" | "contradiction" | "daily";

export type VakaContradictionType =
  | "spatial"
  | "object"
  | "numerical"
  | "alibi"
  | "forensic"
  | "digital"
  | "psychological";

export type VakaSuspectSentence = {
  id: string;
  text: string;
  textEn: string;
  isContradiction: boolean;
  contradictionClueId?: string;
  explanation?: string;
  explanationEn?: string;
};

export type VakaSuspect = {
  id: string;
  name: string;
  role: string;
  roleEn: string;
  age: number;
  temperament: string; // "Kibirli", "Telaşlı", "Soğukkanlı", "Manipülatif"
  temperamentEn: string;
  relationshipToVictim: string;
  relationshipToVictimEn: string;
  statement: string;
  statementEn: string;
  detailedStatements: VakaSuspectSentence[];
  isCulprit: boolean;
  alibi: string;
  alibiEn: string;
  motive: string;
  motiveEn: string;
  minorSecret: string; // Küçük sır (zimmet, kumar borcu, gizli ilişki)
  minorSecretEn: string;
  breakThreshold: number; // 60 - 85 arası kırılma eşiği
  gossip: Record<string, { tr: string; en: string }>; // Diğer şüpheliler hakkında dedikoduları
  behavioralCues: {
    calm: { tr: string; en: string };
    nervous: { tr: string; en: string };
    breaking: { tr: string; en: string };
  };
  lies: {
    level1: string; // Stres < 35
    level2: string; // Stres 35-70
    level3: string; // Stres > 70
  };
  confession: string;
  confessionEn: string;
};

export type VakaClue = {
  id: string;
  label: string;
  labelEn: string;
  detail: string;
  detailEn: string;
  category: "forensic" | "document" | "object" | "digital" | "witness";
  type: VakaContradictionType;
  contradictsSuspectId?: string;
  clearsSuspectId?: string;
  significance: string; // Kanıtın davadaki önemi
  significanceEn: string;
};

export type VakaTimelineEvent = {
  time: string;
  event: string;
  eventEn: string;
  verified: boolean;
};

export type VakaDetailedCase = {
  id: string;
  title: string;
  titleEn: string;
  difficulty: "normal" | "hard" | "expert";
  briefing: string;
  briefingEn: string;
  incidentTime: string;
  location: string;
  locationEn: string;
  victim: {
    name: string;
    occupation: string;
    occupationEn: string;
    causeOfDeath: string;
    causeOfDeathEn: string;
  };
  timeline: VakaTimelineEvent[];
  crimeSceneNotes: {
    tr: string[];
    en: string[];
  };
  suspects: VakaSuspect[];
  clues: VakaClue[];
  culpritId: string;
  correctMethod: string;
  correctMethodEn: string;
  correctMotive: string;
  correctMotiveEn: string;
  winningContradiction: {
    suspectId: string;
    sentenceId: string;
    clueId: string;
  };
  analystSummary: {
    tr: string;
    en: string;
  };
};

export type VakaInterrogationActionType =
  | "question"
  | "present_evidence"
  | "cross_examine"
  | "stay_silent"
  | "bluff"
  | "confront";

export type VakaInterrogationMessage = {
  id: string;
  sender: "detective" | "suspect" | "analyst" | "system";
  text: string;
  actionType?: VakaInterrogationActionType;
  actionBadge?: string; // e.g. "BLÖF", "ÇAPRAZ SORGU", "SESSİZLİK", "DELİL"
  crossSuspectId?: string;
  crossMode?: "ask_about" | "confront";
  behavioralCue?: string;
  stressChange?: number;
  currentStress?: number;
  evidencePresented?: string;
  timestamp: number;
};

export type VakaConfig = {
  enabledModes: VakaGameMode[];
  defaultMode: VakaGameMode;
  hasLlmKeys: boolean;
};
