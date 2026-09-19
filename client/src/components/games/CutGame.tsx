import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SiteLocale } from "@/lib/i18n";
import { generateCutLevel, type Point } from "@/lib/levelGenerators";
import { playComplete, playFail, playHit, playSlice, playStamp } from "@/lib/sfx";
import { segmentDistance } from "@/lib/geometry";
import { useFinishOnce, type GameResult } from "./shared";

type CutShape = ReturnType<typeof generateCutLevel>["shapes"][number] & { cut: boolean };

export default function CutGame({ locale, seed, mastery, demo = false, soundOn = true, onFinish }: { locale: SiteLocale; seed: number; mastery: number; demo?: boolean; soundOn?: boolean; onFinish: (result: GameResult) => void }) {
  const level = useMemo(() => generateCutLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const [cutsLeft, setCutsLeft] = useState(level.cuts);
  const [stains, setStains] = useState(0);
  const [line, setLine] = useState<{ a: Point; b: Point } | null>(null);
  const [score, setScore] = useState(0);
  const [shapes, setShapes] = useState<CutShape[]>(() => level.shapes.map(shape => ({ ...shape, cut: false })));
  const svgRef = useRef<SVGSVGElement>(null);
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 56 };
  };

  const targetIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    let idx = 0;
    for (const shape of shapes) {
      if (shape.target && !shape.cut) {
        map.set(shape.id, idx++);
      }
    }
    return map;
  }, [shapes]);

  const resolveCut = useCallback((cutLine: { a: Point; b: Point } | null) => {
    if (!cutLine || cutsLeft <= 0) return;
    const hit = shapes.filter(shape => !shape.cut && segmentDistance({ x: shape.x, y: shape.y }, cutLine.a, cutLine.b) < shape.size / 2 + 2);
    const targets = hit.filter(shape => shape.target);
    const decoys = hit.filter(shape => !shape.target);
    const nextStains = stains + decoys.length;
    const nextCuts = cutsLeft - 1;
    const chain = targets.filter(shape => shape.linked).length;
    const nextScore = score + targets.length * targets.length * 70 + chain * 95 - decoys.length * 55;

    if (hit.length > 0) playSlice(soundOn);
    if (targets.length > 0) playStamp(soundOn, Math.min(8, targets.length * 2));
    if (decoys.length > 0) playHit(soundOn);

    setShapes(previous => previous.map(shape => hit.some(hitShape => hitShape.id === shape.id) ? { ...shape, cut: true } : shape));
    setScore(nextScore);
    setCutsLeft(nextCuts);
    setStains(nextStains);
    setLine(null);

    const allTargetsCut = shapes.filter(shape => shape.target && !shape.cut && !targets.some(target => target.id === shape.id)).length === 0;

    if (nextStains > level.stainLimit) {
      playFail(soundOn);
      finish({
        outcome: "failure",
        score: Math.max(35, nextScore),
        label: locale === "en" ? "Canvas stained" : "Sayfa lekelendi",
        detail: locale === "en"
          ? "Decoys blocked the cutting line; observe the clean angles before cutting."
          : "Hedef olmayan şekiller kesim alanını kapattı; önce çizginin hangi taraftan geçtiğini oku."
      });
    } else if (allTargetsCut || nextCuts === 0) {
      if (allTargetsCut) playComplete(soundOn);
      else playFail(soundOn);
      finish({
        outcome: allTargetsCut ? "success" : "failure",
        score: Math.max(60, nextScore),
        label: allTargetsCut
          ? (locale === "en" ? "Plates cleanly separated" : "Plaka temiz ayrıldı")
          : (locale === "en" ? "Out of cuts" : "Kesim serisi bitti"),
        detail: allTargetsCut
          ? (locale === "en" ? `Cleanly isolated all targets.` : `${targets.length} hedefi son hamlede doğru plakaya ayırdın.`)
          : (locale === "en" ? "Try gathering linked targets in a single cut next time." : "Bir sonraki turda bağlı şekilleri aynı çizgide toplamayı dene.")
      });
    }
  }, [cutsLeft, finish, level.stainLimit, locale, score, shapes, soundOn, stains]);

  const resolveCutRef = useRef(resolveCut);
  useEffect(() => { resolveCutRef.current = resolveCut; }, [resolveCut]);

  useEffect(() => {
    if (!demo) return;
    const decoys = level.shapes.filter(shape => !shape.target).slice(0, level.stainLimit + 1);
    const timers = decoys.map((shape, index) => window.setTimeout(() => {
      resolveCutRef.current({ a: { x: shape.x - shape.size, y: shape.y }, b: { x: shape.x + shape.size, y: shape.y } });
    }, 160 + index * 420));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [demo, level.shapes, level.stainLimit]);

  const release = () => resolveCut(line);

  const keyboardCut = useCallback((index: number) => {
    const active = shapes.filter(shape => shape.target && !shape.cut);
    const target = active[index];
    if (!target) return;
    const partner = active[(index + 1) % active.length] ?? target;
    playSlice(soundOn);
    resolveCut({ a: { x: target.x - target.size, y: target.y }, b: { x: partner.x + partner.size, y: partner.y } });
  }, [resolveCut, shapes, soundOn]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        const active = shapes.filter(s => s.target && !s.cut);
        const targetIdx = num - 1;
        if (targetIdx < active.length) {
          e.preventDefault();
          keyboardCut(targetIdx);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyboardCut, shapes]);

  return <div className="cut-game game-surface">
    <div className="game-hud">
      <span>{locale === "en" ? "CUTS" : "KESİM"} <b>{cutsLeft}</b></span>
      <span>{locale === "en" ? "STAINS" : "LEKE"} <b>{stains}/{level.stainLimit}</b></span>
      <span>{locale === "en" ? "ISOLATE TARGETS" : "HEDEFLERİ AYIR"}</span>
    </div>
    <svg
      ref={svgRef}
      viewBox="0 0 100 56"
      className="cut-canvas"
      role="application"
      aria-label={locale === "en" ? "Cutout canvas. Drag to cut shapes." : "Kırpık tuvali. Şekilleri kesmek için sürükle."}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const current = point(event);
        playSlice(soundOn);
        setLine({ a: current, b: current });
      }}
      onPointerMove={event => line && setLine(previous => previous ? { ...previous, b: point(event) } : null)}
      onPointerUp={release}
      onPointerCancel={() => setLine(null)}
    >
      <rect width="100" height="56" rx="2" fill="#654169" />
      {shapes.map(shape => {
        const isTarget = shape.target;
        const targetNum = targetIndexMap.get(shape.id);
        return (
          <g
            key={shape.id}
            className={shape.cut ? "cut-shape is-cut" : "cut-shape"}
            transform={`translate(${shape.x} ${shape.y}) rotate(${shape.id * 19})`}
          >
            {isTarget ? (
              <>
                <rect
                  x={-shape.size}
                  y={-shape.size / 2}
                  width={shape.size * 2}
                  height={shape.size}
                  rx="1.2"
                  fill={shape.color}
                  stroke="#ffffff"
                  strokeWidth="0.7"
                />
                <circle cx="0" cy="0" r={shape.size * 0.38} fill="none" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="1.2 0.8" />
                <circle cx="0" cy="0" r="0.7" fill="#ffffff" />
                {shape.linked && (
                  <g transform={`translate(${-shape.size * 0.65}, 0) rotate(${-shape.id * 19})`}>
                    <text textAnchor="middle" dominantBaseline="central" fontSize="2.8" fill="#ffd700" fontWeight="bold">✦</text>
                  </g>
                )}
                {!shape.cut && targetNum !== undefined && (
                  <g transform={`translate(${shape.size * 0.75}, ${-shape.size * 0.35}) rotate(${-shape.id * 19})`}>
                    <circle r="2.2" fill="#e9563f" stroke="#ffffff" strokeWidth="0.5" />
                    <text textAnchor="middle" dominantBaseline="central" fontSize="2.6" fontWeight="bold" fill="#ffffff" fontFamily="var(--font-mono)" className="cut-badge-text">
                      {targetNum + 1}
                    </text>
                  </g>
                )}
              </>
            ) : (
              <>
                <rect
                  x={-shape.size}
                  y={-shape.size / 2}
                  width={shape.size * 2}
                  height={shape.size}
                  rx="1.2"
                  fill={shape.color}
                  stroke="rgba(27,26,27,0.45)"
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1"
                  opacity="0.82"
                />
                <line x1={-shape.size * 0.35} y1={-shape.size * 0.22} x2={shape.size * 0.35} y2={shape.size * 0.22} stroke="rgba(27,26,27,0.55)" strokeWidth="0.6" />
                <line x1={-shape.size * 0.35} y1={shape.size * 0.22} x2={shape.size * 0.35} y2={-shape.size * 0.22} stroke="rgba(27,26,27,0.55)" strokeWidth="0.6" />
              </>
            )}
          </g>
        );
      })}
      {line && (
        <>
          <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} className="cut-line-glow" />
          <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} className="cut-line-core" />
          <circle cx={line.a.x} cy={line.a.y} r="1.3" className="cut-node" />
          <circle cx={line.b.x} cy={line.b.y} r="1.3" className="cut-node" />
        </>
      )}
    </svg>
    <div className="cut-keyboard" aria-label={locale === "en" ? "Keyboard cut options" : "Klavye kesim seçenekleri"}>
      <span>{locale === "en" ? "KEYBOARD CUT (1-9)" : "KLAVYE KESİMİ (1-9)"}</span>
      {shapes.filter(shape => shape.target && !shape.cut).map((shape, index) => (
        <button key={shape.id} onClick={() => keyboardCut(index)} aria-label={locale === "en" ? `Cut target ${index + 1}` : `Hedef ${index + 1} kesimi`}>
          {index + 1}
        </button>
      ))}
    </div>
    <p className="game-tip">{level.lesson}</p>
  </div>;
}
