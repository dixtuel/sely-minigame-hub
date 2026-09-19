import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft as ArrowLeftIcon, ArrowRight, ArrowUp } from "lucide-react";
import { local, type SiteLocale } from "@/lib/i18n";
import { generateShadowLevel, type Point } from "@/lib/levelGenerators";
import { playComplete, playHit, playThrust } from "@/lib/sfx";
import { useFinishOnce, type GameResult, type Position } from "./shared";

export function DirectionPad({ locale = "tr", onMove }: { locale?: SiteLocale; onMove: (dr: number, dc: number) => void }) {
  return <div className="direction-pad" aria-label={local(locale, "Yön kontrolleri", "Direction controls")}><span /><button onClick={() => onMove(-1, 0)} aria-label={local(locale, "Yukarı", "Up")}><ArrowUp size={18} /></button><span /><button onClick={() => onMove(0, -1)} aria-label={local(locale, "Sol", "Left")}><ArrowLeftIcon size={18} /></button><button onClick={() => onMove(1, 0)} aria-label={local(locale, "Aşağı", "Down")}><ArrowDown size={18} /></button><button onClick={() => onMove(0, 1)} aria-label={local(locale, "Sağ", "Right")}><ArrowRight size={18} /></button></div>;
}

export default function ShadowGame({
  locale,
  seed,
  mastery,
  soundOn,
  onFinish,
}: {
  locale: SiteLocale;
  seed: number;
  mastery: number;
  soundOn: boolean;
  onFinish: (result: GameResult) => void;
}) {
  const level = useMemo(() => generateShadowLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);

  type GameState = {
    player: Position;
    shadow: Position;
    history: Array<[number, number]>;
    open: boolean;
    moves: number;
    inverted: boolean;
  };

  const initial = useMemo<GameState>(
    () => ({
      player: { r: 0, c: 0 },
      shadow: { r: 0, c: 0 },
      history: [],
      open: false,
      moves: 0,
      inverted: false,
    }),
    [level]
  );

  const [state, setState] = useState<GameState>(initial);
  const [undoStack, setUndoStack] = useState<GameState[]>([]);

  // Seviye veya seed değişirse durumu sıfırla
  useEffect(() => {
    setState(initial);
    setUndoStack([]);
  }, [initial]);

  const at = (position: Position, point: Point) => position.c === point.x && position.r === point.y;
  const isInverse = (position: Position) => level.inverseTiles.some((point) => at(position, point));
  const onPad = (position: Position) => level.pads.some((point) => at(position, point));

  // Gölgenin önümüzdeki adımda nereye varacağını gösteren hayalet nokta
  const nextShadowPos = useMemo<Position | null>(() => {
    if (state.history.length < level.lag) return null;
    const [lagDr, lagDc] = state.history[0];
    const factor = isInverse(state.shadow) ? -1 : 1;
    const r = Math.max(0, Math.min(level.size - 1, state.shadow.r + lagDr * factor));
    const c = Math.max(0, Math.min(level.size - 1, state.shadow.c + lagDc * factor));
    return { r, c };
  }, [state.history, state.shadow, level]);

  const move = useCallback(
    (dr: number, dc: number) => {
      setState((previous) => {
        const player = {
          r: Math.max(0, Math.min(level.size - 1, previous.player.r + dr)),
          c: Math.max(0, Math.min(level.size - 1, previous.player.c + dc)),
        };

        // Eğer duvara çarpıp yerinde kaldıysa hamleyi yutma
        if (player.r === previous.player.r && player.c === previous.player.c) return previous;

        // Undo stack'e önceki geçerli durumu kaydet
        setUndoStack((prev) => [...prev.slice(-29), previous]);

        let shadow = previous.shadow;
        let inverted = previous.inverted;

        if (previous.history.length >= level.lag) {
          const [lagDr, lagDc] = previous.history[0];
          const factor = isInverse(previous.shadow) ? -1 : 1;
          shadow = {
            r: Math.max(0, Math.min(level.size - 1, previous.shadow.r + lagDr * factor)),
            c: Math.max(0, Math.min(level.size - 1, previous.shadow.c + lagDc * factor)),
          };
          inverted = isInverse(shadow);
        }

        // Kuyruk lag boyu kadar korunur
        const history = [...previous.history, [dr, dc] as [number, number]].slice(-level.lag);

        // İki farklı ped üzerinde biri oyuncu biri gölge mi?
        const justUnlocked =
          !previous.open &&
          onPad(player) &&
          onPad(shadow) &&
          (player.r !== shadow.r || player.c !== shadow.c);
        const open = previous.open || justUnlocked;

        if (justUnlocked) {
          playComplete(soundOn);
        } else {
          playThrust(soundOn);
        }

        const next = {
          player,
          shadow,
          history,
          open,
          moves: previous.moves + 1,
          inverted,
        };

        if (open && at(player, level.exit)) {
          playComplete(soundOn);
          finish({
            outcome: "success",
            score: Math.max(220, 980 - next.moves * 24 + (inverted ? 110 : 0)),
            label: local(locale, "Zaman hizalandı", "Time Aligned"),
            detail: inverted
              ? local(
                  locale,
                  "Işık plağından geçen gölgenin ters ritmini de çözdün.",
                  "You decoded the inverted rhythm through the light prism."
                )
              : local(
                  locale,
                  "Gölgenin geçmiş rotası çıkışı senin için açtı.",
                  "Your shadow's delayed steps unlocked the exit gate."
                ),
          });
        }

        return next;
      });
    },
    [finish, level, soundOn, locale]
  );

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setState(last);
      playThrust(soundOn);
      return prev.slice(0, -1);
    });
  }, [soundOn]);

  const restart = useCallback(() => {
    setState(initial);
    setUndoStack([]);
    playHit(soundOn);
  }, [initial, soundOn]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      // WASD, Arrow keys, Z (Undo), R (Restart)
      const map: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        KeyW: [-1, 0],
        w: [-1, 0],
        W: [-1, 0],
        ArrowDown: [1, 0],
        KeyS: [1, 0],
        s: [1, 0],
        S: [1, 0],
        ArrowLeft: [0, -1],
        KeyA: [0, -1],
        a: [0, -1],
        A: [0, -1],
        ArrowRight: [0, 1],
        KeyD: [0, 1],
        d: [0, 1],
        D: [0, 1],
      };

      if (event.key === "z" || event.key === "Z" || event.code === "KeyZ") {
        event.preventDefault();
        undo();
        return;
      }
      if (event.key === "r" || event.key === "R" || event.code === "KeyR") {
        event.preventDefault();
        restart();
        return;
      }

      const direction = map[event.code] || map[event.key];
      if (direction) {
        event.preventDefault();
        move(...direction);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [move, undo, restart]);

  const isPlayerOnAnyPad = onPad(state.player);
  const isShadowOnAnyPad = onPad(state.shadow);

  return (
    <div className="shadow-game game-surface">
      {/* Oyun Durum Başlığı (HUD) */}
      <div className="game-hud">
        <span>
          {local(locale, "GECİKME", "LAG")} <b>{level.lag}</b>
        </span>
        <span>
          {local(locale, "ADIM", "MOVES")} <b>{state.moves}</b>
        </span>
        <span className={state.open ? "is-hud-open" : ""}>
          {state.open
            ? `🚪 ${local(locale, "ÇIKIŞ AÇILDI!", "EXIT UNLOCKED!")}`
            : isPlayerOnAnyPad || isShadowOnAnyPad
            ? `⚖️ ${local(locale, "DİĞER PEDE ADIMLA", "STEP TO OTHER PAD")}`
            : `⚖️ ${local(locale, "İKİ PEDİ EŞLE", "ALIGN BOTH PADS")}`}
        </span>
      </div>

      {/* 5x5 veya 6x6 Gölge Tahtası */}
      <div
        className="shadow-board"
        style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)` }}
        role="grid"
        aria-label={local(locale, "Gölge Payı Bulmaca Tahtası", "Shadow Share Puzzle Grid")}
      >
        {Array.from({ length: level.size * level.size }, (_, index) => {
          const r = Math.floor(index / level.size);
          const c = index % level.size;
          const position = { r, c };
          const pad = onPad(position);
          const exit = at(position, level.exit);
          const inverse = isInverse(position);

          const playerHere = state.player.r === r && state.player.c === c;
          const shadowHere = state.shadow.r === r && state.shadow.c === c;
          const isGhostTrail =
            Boolean(nextShadowPos && nextShadowPos.r === r && nextShadowPos.c === c) &&
            !shadowHere &&
            !state.open;

          return (
            <div
              key={`${r}-${c}`}
              className={`shadow-cell ${pad ? "is-pad" : ""} ${exit ? "is-exit" : ""} ${
                state.open ? "is-open" : ""
              } ${inverse ? "is-inverse" : ""} ${pad && playerHere ? "is-pad-player" : ""} ${
                pad && shadowHere ? "is-pad-shadow" : ""
              }`}
            >
              {/* Çıkış Kapısı */}
              {exit && (
                <span className="shadow-exit-glyph" title={state.open ? "Çıkış Açık" : "Kilitli"}>
                  {state.open ? "🚪" : "🔒"}
                </span>
              )}

              {/* Baskı Pedi İşareti */}
              {pad && !exit && (
                <span className={`shadow-pad-glyph ${playerHere || shadowHere ? "is-pressed" : ""}`}>
                  ◆
                </span>
              )}

              {/* Işık Prizması */}
              {inverse && <i>↺</i>}

              {/* Gölgenin Sıradaki Adım İzi */}
              {isGhostTrail && (
                <span
                  className="ghost-trail-dot"
                  title={local(locale, "Gölgenin sıradaki adımı", "Shadow's next step")}
                />
              )}

              {/* Oyuncu Karakteri */}
              {playerHere && (
                <span className="solid-figure" title={local(locale, "Sen (Işık)", "You (Light)")} />
              )}

              {/* Gölge Karakteri */}
              {shadowHere && (
                <span
                  className="ghost-figure"
                  title={local(locale, "Gölgen (Gecikmeli)", "Your Shadow (Delayed)")}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Kontrol Çubuğu & Taktiksel Butonlar */}
      <div className="shadow-controls-cluster">
        <DirectionPad locale={locale} onMove={move} />

        <div className="shadow-action-btns">
          <button
            type="button"
            className="shadow-tool-btn shadow-undo-btn"
            disabled={undoStack.length === 0}
            onClick={undo}
            title={local(locale, "Geri Al (Z)", "Undo (Z)")}
          >
            ↺ {local(locale, "Geri Al", "Undo")}
          </button>
          <button
            type="button"
            className="shadow-tool-btn shadow-restart-btn"
            onClick={restart}
            title={local(locale, "Baştan Başla (R)", "Restart (R)")}
          >
            ⟲ {local(locale, "Yeniden", "Reset")}
          </button>
        </div>
      </div>

      {/* İpucu ve Seviye Dersi */}
      <p className="game-tip">{locale === "en" ? level.lessonEn || level.lesson : level.lesson}</p>
    </div>
  );
}
