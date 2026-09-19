import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SiteLocale } from "@/lib/i18n";
import { generateKnotLevel, type Direction } from "@/lib/levelGenerators";
import { playComplete, playFail, playStamp, playThrust } from "@/lib/sfx";
import { useFinishOnce, type GameResult } from "./shared";

type Tile = { r: number; c: number; base: Direction[]; rot: number; locked?: boolean; label?: string };
const directionOrder: Direction[] = ["N", "E", "S", "W"];
const step: Record<Direction, [number, number]> = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const opposite: Record<Direction, Direction> = { N: "S", E: "W", S: "N", W: "E" };
const rotateDirs = (dirs: Direction[], rot: number) => dirs.map(dir => directionOrder[(directionOrder.indexOf(dir) + rot) % 4]);
const tileKey = (r: number, c: number) => `${r}-${c}`;

export default function KnotGame({ locale, seed, mastery, soundOn = true, onFinish }: { locale: SiteLocale; seed: number; mastery: number; soundOn?: boolean; onFinish: (result: GameResult) => void }) {
  const level = useMemo(() => generateKnotLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const knotCriticalIndexes = useMemo(() => new Set([...level.targetPath, ...level.bonusPath]), [level.targetPath, level.bonusPath]);
  const baseTiles = useMemo<Tile[]>(() => level.tileShapes.map((base, index) => ({
    r: Math.floor(index / 4),
    c: index % 4,
    base,
    rot: index === level.sourceIndex || index === level.targetIndex ? 0 : level.rotations[index],
    locked: index === level.sourceIndex || index === level.targetIndex,
    label: index === level.sourceIndex ? "S" : index === level.targetIndex ? (locale === "en" ? "T" : "H") : undefined,
  })), [level, locale]);
  const [tiles, setTiles] = useState(baseTiles);
  const [turns, setTurns] = useState(0);
  const [lastRotated, setLastRotated] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const connected = useMemo(() => {
    const map = new Map(tiles.map(tile => [tileKey(tile.r, tile.c), tile]));
    const visited = new Set([tileKey(0, 0)]); const queue: Tile[] = [map.get("0-0")!];
    while (queue.length) {
      const current = queue.shift()!;
      for (const dir of rotateDirs(current.base, current.rot)) {
        const [dr, dc] = step[dir]; const neighbor = map.get(tileKey(current.r + dr, current.c + dc));
        if (!neighbor || !rotateDirs(neighbor.base, neighbor.rot).includes(opposite[dir])) continue;
        const key = tileKey(neighbor.r, neighbor.c); if (!visited.has(key)) { visited.add(key); queue.push(neighbor); }
      }
    }
    return visited;
  }, [tiles]);

  const prevConnectedSizeRef = useRef(connected.size);
  const targetConnected = connected.has(tileKey(Math.floor(level.targetIndex / 4), level.targetIndex % 4));
  const bonusConnected = level.bonusIndex >= 0 && connected.has(tileKey(Math.floor(level.bonusIndex / 4), level.bonusIndex % 4));
  const prevTargetConnectedRef = useRef(false);

  useEffect(() => {
    if (!prevTargetConnectedRef.current && targetConnected) {
      playStamp(soundOn, 8);
    } else if (connected.size > prevConnectedSizeRef.current) {
      playStamp(soundOn, Math.min(6, connected.size));
    }
    prevConnectedSizeRef.current = connected.size;
    prevTargetConnectedRef.current = targetConnected;
  }, [connected.size, targetConnected, soundOn]);

  const sealFlow = useCallback(() => {
    if (!targetConnected) return;
    playComplete(soundOn);
    finish({
      outcome: "success",
      score: Math.max(180, 860 - turns * 44 + (bonusConnected ? 180 : 0)),
      label: bonusConnected
        ? (locale === "en" ? "Seal & side flow solved" : "Mühür ve yan akış çözüldü")
        : (locale === "en" ? "Flow complete" : "Akış tamamlandı"),
      detail: locale === "en"
        ? `Route reached target in ${turns} turns${bonusConnected ? "; bonus knot energized." : "."}`
        : `${turns} hamlede hedefe ulaşan çizgiyi kurdun${bonusConnected ? "; yan düğüm de beslendi." : "."}`
    });
  }, [bonusConnected, finish, locale, soundOn, targetConnected, turns]);

  const rotate = useCallback((index: number) => {
    if (tiles[index].locked) return;
    playThrust(soundOn);
    const nextTurns = turns + 1;
    setTiles(previous => previous.map((tile, tileIndex) => tileIndex === index ? { ...tile, rot: (tile.rot + 1) % 4 } : tile));
    setTurns(nextTurns);
    setLastRotated(index);
    if (nextTurns > level.heatLimit) {
      playFail(soundOn);
      finish({
        outcome: "failure",
        score: 65,
        label: locale === "en" ? "Circuit overheated" : "Hat fazla ısındı",
        detail: locale === "en"
          ? "Trace the target path in advance instead of spinning random tiles."
          : "Aynı akışı tekrar tekrar çevirmek yerine önce hedef çizgisini gözünle kur."
      });
    }
  }, [finish, level.heatLimit, locale, soundOn, tiles, turns]);

  const undoLast = useCallback(() => {
    if (lastRotated === null) return;
    playThrust(soundOn);
    setTiles(previous => previous.map((tile, tileIndex) => tileIndex === lastRotated ? { ...tile, rot: (tile.rot + 3) % 4 } : tile));
    setTurns(value => Math.max(0, value - 1));
    setLastRotated(null);
  }, [lastRotated, soundOn]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const current = focusedIndex ?? 0;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        setFocusedIndex((current - 4 + 16) % 16);
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        setFocusedIndex((current + 4) % 16);
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        setFocusedIndex(current % 4 === 0 ? current + 3 : current - 1);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        setFocusedIndex((current + 1) % 4 === 0 ? current - 3 : current + 1);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (targetConnected && (current === level.targetIndex || e.key === "Enter")) {
          if (current === level.targetIndex) {
            sealFlow();
            return;
          }
        }
        rotate(current);
      } else if (e.key === "z" || e.key === "Z" || e.key === "Backspace" || e.key === "u" || e.key === "U") {
        e.preventDefault();
        undoLast();
      } else if ((e.key === "m" || e.key === "M") && targetConnected) {
        e.preventDefault();
        sealFlow();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, level.targetIndex, rotate, sealFlow, targetConnected, undoLast]);

  return <div className="knot-game game-surface">
    <div className="game-hud">
      <span>{locale === "en" ? "KNOT" : "DÜĞÜM"} <b>{turns}/{level.heatLimit}</b></span>
      <span>{locale === "en" ? "FLOW" : "AKIŞ"} <b>{connected.size}/16</b></span>
      <span>{targetConnected ? (bonusConnected ? (locale === "en" ? "SEAL READY + BONUS" : "MÜHÜR HAZIR + BONUS") : (locale === "en" ? "SEAL READY" : "MÜHÜR HAZIR")) : (locale === "en" ? "CONNECT TARGET" : "HEDEFİ BAĞLA")}</span>
    </div>
    <div className="knot-board" role="grid" aria-label={locale === "en" ? "Knot circuit board" : "Düğüm bağlantı tahtası"}>
      {tiles.map((tile, index) => {
        const active = connected.has(tileKey(tile.r, tile.c));
        const dirs = rotateDirs(tile.base, tile.rot);
        const bonus = level.bonusIndex === index;
        const critical = knotCriticalIndexes.has(index) && !tile.locked;
        const isSource = index === level.sourceIndex;
        const isTarget = index === level.targetIndex;
        const isFocused = focusedIndex === index;
        return <button
          key={tileKey(tile.r, tile.c)}
          onClick={() => { setFocusedIndex(index); rotate(index); }}
          className={`knot-tile ${active ? "is-active" : ""} ${tile.locked ? "is-locked" : ""} ${bonus ? "is-bonus" : ""} ${critical ? "is-critical" : ""} ${isSource ? "is-source" : ""} ${isTarget ? "is-target" : ""} ${isTarget && active ? "is-target-reached" : ""} ${isFocused ? "is-focused" : ""}`}
          aria-label={locale === "en" ? `Tile ${tile.r + 1}-${tile.c + 1}` : `Bağlantı karosu ${tile.r + 1}-${tile.c + 1}`}
        >
          <span className="knot-core">{tile.label || (bonus ? "✦" : "")}</span>
          {dirs.map(dir => <i key={dir} className={`knot-line line-${dir}`} />)}
        </button>;
      })}
    </div>
    <div className="knot-actions">
      <button type="button" className="quiet-button" onClick={undoLast} disabled={lastRotated === null}>
        {locale === "en" ? "Undo last turn (Z)" : "Son hamleyi geri al (Z)"}
      </button>
      {targetConnected && (
        <button className="ink-button knot-seal-button" onClick={sealFlow}>
          {bonusConnected ? (locale === "en" ? "Seal flow + bonus (M)" : "Akışı mühürle + bonus (M)") : (locale === "en" ? "Seal flow (M)" : "Akışı mühürle (M)")}
        </button>
      )}
    </div>
    <p className="game-tip">{level.lesson}</p>
  </div>;
}
