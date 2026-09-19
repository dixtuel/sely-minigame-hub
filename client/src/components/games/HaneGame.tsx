import { useCallback, useEffect, useMemo, useState } from "react";
import { local, type SiteLocale } from "@/lib/i18n";
import {
  generateHaneLevel,
  generateHaneWordLevel,
  compareHaneNumberGuess,
  compareHaneWordGuess,
  isHaneGuessValid,
  isHaneWordGuessValid,
} from "@/lib/levelGenerators";
import { useFinishOnce, type GameResult } from "./shared";

export default function HaneGame({ locale, seed, mastery, onFinish }: { locale: SiteLocale; seed: number; mastery: number; onFinish: (result: GameResult) => void }) {
  const numberLevel = useMemo(() => generateHaneLevel(seed, mastery), [seed, mastery]);
  const wordLevel = useMemo(() => generateHaneWordLevel(seed, mastery, locale), [seed, mastery, locale]);
  const finish = useFinishOnce(onFinish);
  const [mode, setMode] = useState<"number" | "word">("word");
  const [guess, setGuess] = useState("");
  const [numberRows, setNumberRows] = useState<Array<{ guess: string; marks: Array<"exact" | "present" | "absent"> }>>([]);
  const [wordRows, setWordRows] = useState<Array<{ guess: string; marks: Array<"exact" | "present" | "absent"> }>>([]);
  const [notice, setNotice] = useState("");
  const inputId = `hane-entry-${seed}`;
  const isWord = mode === "word";
  const activeLength = isWord ? wordLevel.length : numberLevel.digits;
  const activeRows = isWord ? wordRows : numberRows;
  const activeMaxGuesses = isWord ? wordLevel.maxGuesses : numberLevel.maxGuesses;
  const chooseMode = (next: "number" | "word") => { setMode(next); setGuess(""); setNotice(""); };
  const append = (value: string) => {
    setNotice("");
    setGuess(current => Array.from(current).length < activeLength ? `${current}${value}` : current);
  };
  const [checkingWord, setCheckingWord] = useState(false);
  const submit = useCallback(() => {
    if (!isWord) {
      if (!isHaneGuessValid(guess, numberLevel)) { setNotice(local(locale, `${numberLevel.digits} haneli ve sıfırla başlamayan bir kayıt gir.`, `Enter a ${numberLevel.digits}-digit record that does not start with zero.`)); return; }
      const feedback = compareHaneNumberGuess(numberLevel.target, guess);
      const nextRows = [...numberRows, { guess, marks: feedback.marks }];
      setNumberRows(nextRows); setGuess(""); setNotice("");
      if (feedback.exact === numberLevel.digits) { finish({ outcome: "success", score: 1_100 - nextRows.length * 105 + mastery * 65, label: local(locale, "Kayıt hizalandı", "Record aligned"), answer: numberLevel.target, detail: local(locale, `${nextRows.length}. fişte kayıt numarasını çözdün.`, `You resolved the record number on receipt ${nextRows.length}.`) }); return; }
      if (nextRows.length >= numberLevel.maxGuesses) {
        setNotice(local(locale, `Aranan gizli kayıt: ${numberLevel.target}`, `The secret record was: ${numberLevel.target}`));
        finish({ outcome: "failure", score: Math.max(60, 180 + nextRows.reduce((total, row) => total + row.marks.filter(mark => mark !== "absent").length * 26, 0)), label: local(locale, "Kayıt kapanmadı", "Record remained open"), answer: numberLevel.target, detail: local(locale, `Aranan gizli kayıt "${numberLevel.target}" idi. ${numberLevel.lesson}`, `The secret record was "${numberLevel.target}". ${numberLevel.lesson}`) });
        return;
      }
      return;
    }
    setCheckingWord(true);
    isHaneWordGuessValid(guess, wordLevel, locale).then(valid => {
      setCheckingWord(false);
      if (!valid) { setNotice(local(locale, `${wordLevel.length} harfli, geçerli bir Türkçe sözcük gir.`, `Enter a valid ${wordLevel.length}-letter English word.`)); return; }
      const normalizedGuess = locale === "en"
        ? guess.trim().toUpperCase()
        : Array.from(guess.toLocaleUpperCase("tr-TR")).join("");
      const feedback = compareHaneWordGuess(wordLevel.target, normalizedGuess, locale);
      const nextRows = [...wordRows, { guess: normalizedGuess, marks: feedback.marks }];
      setWordRows(nextRows); setGuess(""); setNotice("");
      if (feedback.exact === wordLevel.length) { finish({ outcome: "success", score: 1_160 - nextRows.length * 105 + mastery * 65, label: local(locale, "Sözcük kayda geçti", "Word entered the record"), answer: wordLevel.target, detail: local(locale, `${nextRows.length}. fişte gizli sözcüğü çözdün.`, `You resolved the hidden word on receipt ${nextRows.length}.`) }); return; }
      if (nextRows.length >= wordLevel.maxGuesses) {
        setNotice(local(locale, `Aranan sözcük: "${wordLevel.target}"`, `The hidden word was: "${wordLevel.target}"`));
        finish({ outcome: "failure", score: Math.max(60, 180 + nextRows.reduce((total, row) => total + row.marks.filter(mark => mark !== "absent").length * 26, 0)), label: local(locale, "Sözcük açık kaldı", "Word record stayed open"), answer: wordLevel.target, detail: local(locale, `Aranan gizli sözcük "${wordLevel.target}" idi. ${wordLevel.lesson}`, `The secret word was "${wordLevel.target}". ${wordLevel.lesson}`) });
      }
    });
  }, [finish, guess, isWord, locale, mastery, numberLevel, numberRows, wordLevel, wordRows]);
  useEffect(() => {
    if (!isWord) return;
    const keydown = (event: KeyboardEvent) => {
      if (document.activeElement?.id === inputId) return;
      if (event.key === "Enter") { event.preventDefault(); submit(); return; }
      if (event.key === "Backspace") { event.preventDefault(); setGuess(current => Array.from(current).slice(0, -1).join("")); return; }
      const letter = locale === "en" ? event.key.toUpperCase() : event.key.toLocaleUpperCase("tr-TR");
      const pattern = locale === "en" ? /^[A-Z]$/ : /^[A-ZÇĞİÖŞÜ]$/;
      if (pattern.test(letter)) { event.preventDefault(); append(letter); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [inputId, isWord, locale, submit]);
  const wordKeyboard = locale === "en"
    ? ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
    : ["QWERTYUIOPĞÜ", "ASDFGHJKLŞİ", "ZXCVBNMÖÇ"];
  const bestMarkPerKey = (rows: Array<{ guess: string; marks: Array<"exact" | "present" | "absent"> }>) => {
    const rank: Record<"exact" | "present" | "absent", number> = { exact: 3, present: 2, absent: 1 };
    const marks: Record<string, "exact" | "present" | "absent"> = {};
    for (const row of rows) {
      Array.from(row.guess).forEach((key, index) => {
        const mark = row.marks[index];
        if (!marks[key] || rank[mark] > rank[marks[key]]) marks[key] = mark;
      });
    }
    return marks;
  };
  const keyboardMarks = useMemo(() => bestMarkPerKey(wordRows), [wordRows]);
  const numberKeyboardMarks = useMemo(() => bestMarkPerKey(numberRows), [numberRows]);
  return <div className="hane-game game-surface">
    <div className="game-hud"><span>{local(locale, "FİŞ", "RECEIPT")} <b>{activeRows.length}/{activeMaxGuesses}</b></span><span>{local(locale, "KAYIT", "RECORD")} <b>{isWord ? local(locale, "SÖZCÜK", "WORD") : local(locale, "SAYI", "NUMBER")}</b></span><span>{isWord ? local(locale, "KONU", "TOPIC") : local(locale, "KURAL", "RULE")} <b>{isWord ? (locale === "en" ? wordLevel.categoryEn : wordLevel.category) : (numberLevel.allowsRepeats ? local(locale, "TEKRAR AÇIK", "REPEATS ON") : local(locale, "TEKRAR YOK", "NO REPEATS"))}</b></span></div>
    <section className="hane-desk" aria-label={local(locale, "Hane kayıt masası", "Hane record desk")}>
      <div className="hane-head"><span>SELY / KAYIT MASASI</span><b>{isWord ? local(locale, "SÖZCÜK İZİ", "WORD TRACE") : local(locale, "SAYI İZİ", "NUMBER TRACE")}</b></div>
      <div className="hane-mode-tabs" role="tablist" aria-label={local(locale, "Hane kayıt türü", "Hane record type")}><button type="button" role="tab" aria-selected={!isWord} className={!isWord ? "is-active" : ""} onClick={() => chooseMode("number")}>{local(locale, "Sayı kaydı", "Number record")}</button><button type="button" role="tab" aria-selected={isWord} className={isWord ? "is-active" : ""} onClick={() => chooseMode("word")}>{local(locale, "Sözcük kaydı", "Word record")}</button></div>
      <div className="hane-key"><div><b>▣ {local(locale, "YERİNDE", "EXACT")}</b><span>{isWord ? local(locale, "doğru harf · doğru yer", "right letter · right place") : local(locale, "doğru hane · doğru yer", "right digit · right place")}</span></div><div><b>◌ {local(locale, "İZDE", "TRACED")}</b><span>{isWord ? local(locale, "doğru harf · başka yer", "right letter · other place") : local(locale, "doğru hane · başka yer", "right digit · other place")}</span></div></div>
      <ol className="hane-word-rows" aria-live="polite" style={{ "--word-length": activeLength } as React.CSSProperties}>{Array.from({ length: activeMaxGuesses }, (_, index) => { const row = activeRows[index]; return <li key={index}>{Array.from({ length: activeLength }, (_, cellIndex) => <span key={cellIndex} className={row ? `is-${row.marks[cellIndex]}` : ""}>{row?.guess[cellIndex] || ""}</span>)}</li>; })}</ol>
      <form className="hane-entry" onSubmit={event => { event.preventDefault(); submit(); }}><label htmlFor={inputId}>{isWord ? local(locale, "SÖZCÜK YAZ", "ENTER WORD") : local(locale, "KAYIT GİR", "ENTER RECORD")}</label><input id={inputId} value={guess} onChange={event => { setNotice(""); const next = isWord ? (locale === "en" ? Array.from(event.target.value.toUpperCase()).filter(letter => /^[A-Z]$/.test(letter)).slice(0, wordLevel.length).join("") : Array.from(event.target.value.toLocaleUpperCase("tr-TR")).filter(letter => /^[A-ZÇĞİÖŞÜ]$/.test(letter)).slice(0, wordLevel.length).join("")) : event.target.value.replace(/\D/g, "").slice(0, numberLevel.digits); setGuess(next); }} inputMode={isWord ? "text" : "numeric"} autoComplete="off" pattern={isWord ? (locale === "en" ? "[A-Za-z]+" : "[A-Za-zÇĞİÖŞÜçğıöşü]+") : "[0-9]*"} aria-describedby={`${inputId}-note`} placeholder={isWord ? "—".repeat(wordLevel.length) : "0".repeat(numberLevel.digits)} /><button className="ink-button" type="submit" disabled={checkingWord}>{checkingWord ? local(locale, "Kontrol ediliyor…", "Checking…") : local(locale, "Baskıya ver", "Stamp entry")}</button></form>
      {!isWord ? <div className="hane-word-keypad hane-number-keypad" aria-label={local(locale, "Sayı tuşları", "Number keypad")}><div>{[1,2,3,4,5,6,7,8,9,0].map(value => <button type="button" key={value} className={numberKeyboardMarks[String(value)] ? `is-${numberKeyboardMarks[String(value)]}` : ""} onClick={() => append(String(value))}>{value}</button>)}</div><button className="hane-backspace" type="button" onClick={() => setGuess(current => current.slice(0, -1))}>⌫</button></div> : <div className="hane-word-keypad" aria-label={local(locale, "Harf tuşları", "Letter keys")}>{wordKeyboard.map((line, index) => <div key={index}>{Array.from(line).map(letter => <button type="button" key={letter} className={keyboardMarks[letter] ? `is-${keyboardMarks[letter]}` : ""} onClick={() => append(letter)}>{letter}</button>)}</div>)}<button className="hane-backspace" type="button" onClick={() => setGuess(current => Array.from(current).slice(0, -1).join(""))}>⌫</button></div>}
      <p id={`${inputId}-note`} className={notice ? "hane-note is-alert" : "hane-note"}>{notice || (isWord ? (locale === "en" ? `Today’s topic: ${wordLevel.categoryEn}. ${wordLevel.lesson}` : `Bugünün konusu: ${wordLevel.category}. ${wordLevel.lesson}`) : numberLevel.lesson)}</p>
    </section>
  </div>;
}
