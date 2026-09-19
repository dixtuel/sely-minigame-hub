import { clamp, indexFor } from "./shared";

export type SuspectId = string;
export type ClueId = string;

export type Suspect = { id: SuspectId; name: string; statement: string };

export type VakaClue = {
  id: ClueId;
  label: string;
  detail: string;
  /** Sunulduğunda bu şüpheliyi suçlar (ifadesiyle çelişir). */
  contradicts?: SuspectId;
  /** Sunulduğunda bu şüpheliyi temizler (ifadesini doğrular). */
  clears?: SuspectId;
  /** contradicts/clears'ı yoksa true olmalı — nötr, yanıltıcı kart. */
  isRedHerring: boolean;
  /** Yalnız contradicts kanıtlarında dolu — çelişkinin türü (mekansal/nesne/sayısal). */
  contradictionType?: VakaContradictionType;
};

export type VakaCase = {
  id: string;
  /** Vakanın açılışında gösterilen olay özeti (mağdur/mekân/zaman) — oyuncu şüpheli kartlarını görmeden önce ne olduğunu bilir. */
  briefing: string;
  briefingEn: string;
  suspects: Suspect[];
  clues: VakaClue[];
  culpritId: SuspectId;
  hint: string;
  clueCost: number;
  /** Kaç kanıt kartı başlangıçta açık gösterilir — kalanı "ipucu iste" ile açılır. */
  revealCount: number;
};

export type VakaVerdict = "correct" | "wrong-suspect" | "no-contradiction";

const VAKA_NAMES = ["K. Demir", "A. Sarı", "M. Ekin", "R. Toprak", "S. Yıldız", "N. Aksoy", "B. Kaya", "E. Çelik"];
const VAKA_INCIDENTS = [
  { tr: "kasadan bir yüzük çalındı", en: "a ring was stolen from the safe" },
  { tr: "arşivdeki imzalı bir belge tahrif edildi", en: "a signed document in the archive was forged" },
  { tr: "vitrin camı kırılıp içindeki saat alındı", en: "the display case was broken and the watch inside was taken" },
  { tr: "kilitli çekmeceden nakit para kayboldu", en: "cash went missing from a locked drawer" },
  { tr: "duvardaki tablo yerinden sökülüp götürüldü", en: "a painting was taken off the wall" },
];
const VAKA_LOCATIONS = ["atölye", "depo", "sahne arkası", "arşiv odası", "bahçe", "kütüphane", "mutfak"];
const VAKA_TIMES = ["18:00", "18:20", "18:40", "19:00", "19:20", "19:40"];
const VAKA_OBJECTS = ["ıslak boya lekesi", "kırık düğme", "toz izi", "özel bir anahtar", "imzalı bir not", "yırtık bir kumaş parçası"];
const VAKA_WITNESS_ROLES = ["Kapıcı", "Komşu dükkân sahibi", "Güvenlik görevlisi", "Bir müşteri", "Temizlikçi"];
const VAKA_MARKS = ["kendine özgü bir mühür izi", "tanınabilir bir el yazısı notu", "ayırt edici bir düğme deseni", "kendine özgü bir parfüm kokusu"];
export type VakaContradictionType = "spatial" | "object" | "numerical";
const VAKA_CONTRADICTION_TYPES: VakaContradictionType[] = ["spatial", "object", "numerical"];

type VakaScene = { location: string; timeslot: string };
type VakaClaim = { location: string; timeslot: string };

function pickN<T>(pool: T[], count: number, seed: number, salt: number) {
  const indices = new Set<number>();
  let attempt = 0;
  while (indices.size < count && attempt < count * 20) {
    indices.add(indexFor(seed, salt + attempt * 31, pool.length));
    attempt += 1;
  }
  // Havuz sayısı yetersizse (mastery çok yüksek/pool küçükse) kalanları sırayla tamamla
  for (let index = 0; indices.size < count && index < pool.length; index += 1) indices.add(index);
  return Array.from(indices).slice(0, count).map(index => pool[index]);
}

function claimFor(scene: VakaScene, seed: number, salt: number): VakaClaim {
  const otherLocations = VAKA_LOCATIONS.filter(location => location !== scene.location);
  const otherTimes = VAKA_TIMES.filter(timeslot => timeslot !== scene.timeslot);
  return {
    location: otherLocations[indexFor(seed, salt, otherLocations.length)],
    timeslot: otherTimes[indexFor(seed, salt + 7, otherTimes.length)],
  };
}

function difficultyFor(mastery: number) {
  const table = [
    { suspectCount: 3, redHerrings: 1, revealCount: 3, clueCost: 25, extraContradictions: 0 },
    { suspectCount: 4, redHerrings: 1, revealCount: 3, clueCost: 25, extraContradictions: 0 },
    { suspectCount: 4, redHerrings: 2, revealCount: 4, clueCost: 30, extraContradictions: 0 },
    { suspectCount: 5, redHerrings: 2, revealCount: 4, clueCost: 45, extraContradictions: 1 },
    { suspectCount: 6, redHerrings: 3, revealCount: 5, clueCost: 45, extraContradictions: 1 },
  ];
  return table[clamp(mastery, 0, table.length - 1)];
}

function contradictionFor(type: VakaContradictionType, seed: number, salt: number, culprit: Suspect, claim: VakaClaim, scene: VakaScene): { label: string; detail: string } {
  if (type === "object") {
    const mark = VAKA_MARKS[indexFor(seed, salt, VAKA_MARKS.length)];
    return {
      label: mark[0].toUpperCase() + mark.slice(1),
      detail: `${scene.location}'da bulunan eşyada ${mark} tespit edildi — bu iz yalnız ${culprit.name}'e ait, oysa kendisi "${claim.location}'daydım" diyor.`,
    };
  }
  if (type === "numerical") {
    const minutesOff = 15 + indexFor(seed, salt + 3, 4) * 10;
    return {
      label: "Giriş-çıkış kaydı",
      detail: `Kayıt defteri, ${culprit.name}'in ${scene.location}'dan ${scene.timeslot}'ten ${minutesOff} dakika SONRA çıktığını gösteriyor — "${claim.timeslot} civarı ayrıldım" ifadesiyle uyuşmuyor.`,
    };
  }
  const object = VAKA_OBJECTS[indexFor(seed, salt, VAKA_OBJECTS.length)];
  return {
    label: object[0].toUpperCase() + object.slice(1),
    detail: `${object[0].toUpperCase()}${object.slice(1)}, ${scene.location}'da ${scene.timeslot} civarında bulundu — bu, ${culprit.name}'in iddia ettiği ${claim.location} ile bağdaşmıyor.`,
  };
}

function buildCandidateCase(localSeed: number, caseIndex: number, diff: ReturnType<typeof difficultyFor>): VakaCase {
  const names = pickN(VAKA_NAMES, diff.suspectCount, localSeed, 3);
  const scene: VakaScene = {
    location: VAKA_LOCATIONS[indexFor(localSeed, 11, VAKA_LOCATIONS.length)],
    timeslot: VAKA_TIMES[indexFor(localSeed, 17, VAKA_TIMES.length)],
  };
  const culpritIndex = indexFor(localSeed, caseIndex * 13 + 7, names.length);

  const claims = names.map((_, i) => claimFor(scene, localSeed, 23 + i * 41));
  const suspects: Suspect[] = names.map((name, i) => ({
    id: `s${i}`,
    name,
    statement: `"O saatte ${claims[i].location}'daydım, ${claims[i].timeslot} civarı."`,
  }));

  const culpritId = suspects[culpritIndex].id;
  const culprit = suspects[culpritIndex];
  const culpritClaim = claims[culpritIndex];
  const incident = VAKA_INCIDENTS[indexFor(localSeed, 5, VAKA_INCIDENTS.length)];
  const briefing = `${scene.location}'da, ${scene.timeslot} civarında ${incident.tr}. O sırada binada ${suspects.length} kişi vardı; her birinin bir ifadesi var, ama yalnız biri yalan söylüyor.`;
  const briefingEn = `At the ${scene.location}, around ${scene.timeslot}, ${incident.en}. ${suspects.length} people were in the building at the time; each gave a statement, but only one of them is lying.`;

  // Ana çelişki kanıtı + (yüksek mastery'de) failin kendi özniteliklerinden türeyen bağımsız
  // ikinci bir çelişki noktası — alibi.holes[] deseni: fail birden fazla bağımsız kanıtla suçlanabilir.
  const contradictionCount = 1 + diff.extraContradictions;
  const usedTypes: VakaContradictionType[] = [];
  const contradictingClues: VakaClue[] = Array.from({ length: contradictionCount }, (_, i) => {
    const type = VAKA_CONTRADICTION_TYPES.filter(candidate => !usedTypes.includes(candidate))[
      indexFor(localSeed, 233 + i * 19, VAKA_CONTRADICTION_TYPES.length - usedTypes.length)
    ] ?? VAKA_CONTRADICTION_TYPES[0];
    usedTypes.push(type);
    const { label, detail } = contradictionFor(type, localSeed, 71 + i * 53, culprit, culpritClaim, scene);
    return { id: `c${i}`, label, detail, contradicts: culpritId, isRedHerring: false, contradictionType: type };
  });

  const clearingClues: VakaClue[] = suspects
    .filter(suspect => suspect.id !== culpritId)
    .map((suspect, i) => {
      const claim = claims[names.findIndex(name => name === suspect.name)];
      const witness = VAKA_WITNESS_ROLES[indexFor(localSeed, 89 + i * 13, VAKA_WITNESS_ROLES.length)];
      return {
        id: `g${i}`,
        label: "Tanık ifadesi",
        detail: `${witness}, ${suspect.name}'i ${claim.location}'da ${claim.timeslot} civarında gördüğünü doğruladı.`,
        clears: suspect.id,
        isRedHerring: false,
      };
    });

  const herrings: VakaClue[] = Array.from({ length: diff.redHerrings }, (_, i) => ({
    id: `h${i}`,
    label: "Olay yeri notu",
    detail: herringDetailFor(localSeed, i, scene),
    isRedHerring: true,
  }));

  // ÖNEMLİ: suçlayıcı (contradicting) kanıt burada diğerleriyle TAM KARIŞTIRILIR — sabit olarak
  // en başa konmaz. Aksi halde revealCount>=1 olduğu için "akıllı kanıt" her zaman oyunun daha
  // ilk anından itibaren açık gösterilirdi ve oyuncunun hiçbir araştırma yapmasına gerek kalmazdı.
  const all = [...contradictingClues, ...clearingClues, ...herrings];
  const shuffledIndices = all.map((_, i) => i).sort((a, b) => indexFor(localSeed, 131 + a, 997) - indexFor(localSeed, 131 + b, 997));
  const clues = shuffledIndices.map(index => all[index]);

  return {
    id: `${localSeed}:${caseIndex}`,
    briefing,
    briefingEn,
    suspects,
    clues,
    culpritId,
    hint: `Ek iz: ${suspects[culpritIndex].name}'in ifadesiyle olay yerindeki kanıtı karşılaştır.`,
    clueCost: diff.clueCost,
    revealCount: clamp(diff.revealCount, 1, clues.length),
  };
}

function herringDetailFor(seed: number, index: number, scene: VakaScene) {
  const filler = [
    `${scene.location} o akşam her zamankinden daha kalabalıktı.`,
    `Kapı kilidinde zorlanma izi yok — anahtarla girilmiş.`,
    `Aynı gece hava yağışlıydı, dış zeminde çamur izleri karışmış.`,
    `Güvenlik kamerası o gece bakımdaydı, görüntü yok.`,
  ];
  return filler[indexFor(seed, 191 + index * 17, filler.length)];
}

/**
 * Bağımsız solver: culpritId'yi BİLMEDEN, yalnız kanıt grafiğinden (contradicts/clears
 * bağlantılarından) failin kim olduğunu türetmeye çalışır — ai-murder-mystery-v2'nin
 * `culprit_score > rival_score` deseninden uyarlandı. Skor = şüpheliyi suçlayan (contradicts)
 * bağımsız kanıt sayısı; fail bu skorda HERKESTEN kesin olarak daha yüksek olmalı (eşitlik de
 * belirsizlik sayılır — "tam 1 kanıt" kuralından daha sağlam, çoklu çelişki kanıtına izin verir).
 * Çözülemezse veya belirsizse null döner.
 */
export function solveVakaCase(vakaCase: Pick<VakaCase, "suspects" | "clues">): SuspectId | null {
  const { suspects, clues } = vakaCase;
  const scoreOf = (suspectId: SuspectId) => clues.filter(clue => clue.contradicts === suspectId).length;
  const ranked = suspects.map(suspect => ({ id: suspect.id, score: scoreOf(suspect.id) }));
  const top = ranked.reduce((best, entry) => (entry.score > best.score ? entry : best), ranked[0]);
  if (!top || top.score === 0) return null;
  if (ranked.some(entry => entry.id !== top.id && entry.score >= top.score)) return null; // tekillik yok

  const others = suspects.filter(suspect => suspect.id !== top.id);
  if (!others.every(suspect => clues.some(clue => clue.clears === suspect.id))) return null; // her masumun doğrulanmış alibisi olmalı
  if (clues.some(clue => clue.clears === top.id)) return null; // fail'in kendisi temizlenmiş olamaz

  return top.id;
}

export function isVakaCaseSolvable(vakaCase: VakaCase): boolean {
  if (!vakaCase.clues.filter(clue => clue.isRedHerring).every(clue => !clue.contradicts && !clue.clears)) return false;
  return solveVakaCase(vakaCase) === vakaCase.culpritId;
}

function fallbackGuaranteedCase(seed: number, caseIndex: number, diff: ReturnType<typeof difficultyFor>): VakaCase {
  // Güvenlik ağı: buildCandidateCase kendi kuruluşu gereği zaten her zaman çözülebilir
  // üretmeli (bkz. levelGenerators.test.ts), bu yalnız beklenmeyen bir regresyona karşı düşer.
  return buildCandidateCase(seed + caseIndex * 9973, caseIndex, diff);
}

export function generateVakaCases(seed: number, mastery: number): VakaCase[] {
  const diff = difficultyFor(mastery);
  return Array.from({ length: 3 + mastery }, (_, caseIndex) => {
    let attempt = 0;
    let built: VakaCase | null = null;
    while (!built && attempt < 12) {
      const localSeed = seed + caseIndex * 97 + attempt * 131;
      const candidate = buildCandidateCase(localSeed, caseIndex, diff);
      if (isVakaCaseSolvable(candidate)) built = candidate;
      attempt += 1;
    }
    return built ?? fallbackGuaranteedCase(seed, caseIndex, diff);
  });
}

export function evaluateVakaAttempt(vakaCase: VakaCase, accusedId: SuspectId, presentedClueId: ClueId): VakaVerdict {
  const clue = vakaCase.clues.find(item => item.id === presentedClueId);
  if (!clue || clue.contradicts !== accusedId) return clue?.clears === accusedId ? "wrong-suspect" : "no-contradiction";
  return accusedId === vakaCase.culpritId ? "correct" : "wrong-suspect";
}
