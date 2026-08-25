/**
 * Sely Yankı — Yansıma Arşivi 3D Babylon.js Alpha Motoru
 * Koyu bazalt zemin, reveal dalga fiziği, dinamik 3/4 takip kamerası,
 * mobil sanal joystick ve dokunmatik HUD.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Expand, HelpCircle, Maximize2, Minimize2, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { assets } from "@/game/assets";
import { createGameScene } from "@/game/scene";
import { createInitialSnapshot, type GameHandle, type GameSnapshot } from "@/game/types";
import type { SiteLocale } from "@/lib/i18n";
import "@/echo-room.css";

export type GameResult = { score: number; label: string; detail: string; outcome: "success" | "failure" };

type ViewMode = "cinema" | "window";

type EchoRoom3DProps = {
  locale?: SiteLocale;
  seed?: number;
  mastery?: number;
  onFinish?: (result: GameResult) => void;
};

const local = (locale: SiteLocale | undefined, tr: string, en: string) => (locale === "en" ? en : tr);

export default function EchoRoom3D({ locale = "tr", seed, mastery = 0, onFinish }: EchoRoom3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  const [snapshot, setSnapshot] = useState<GameSnapshot>(createInitialSnapshot);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(local(locale, "Yankıyı izle — rota burada açılıyor.", "Watch the echo — the path reveals here."));
  const [viewMode, setViewMode] = useState<ViewMode>("cinema");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    finishedRef.current = false;

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const hardwareScale = coarsePointer
      ? Math.max(1.25, Math.min(1.55, devicePixelRatio * 0.62))
      : Math.max(1, Math.min(1.2, devicePixelRatio * 0.82));

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      adaptToDeviceRatio: false,
      powerPreference: "high-performance",
    });
    engine.setHardwareScalingLevel(hardwareScale);

    const demo = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");
    let disposed = false;

    createGameScene(
      engine,
      canvas,
      (event) => {
        if (event.type === "state") {
          setSnapshot(event.snapshot);
          if (event.snapshot.phase === "won" && !finishedRef.current) {
            finishedRef.current = true;
            const score = Math.max(50, Math.round(150 + event.snapshot.echoes * 20 - event.snapshot.noise * 2 + (mastery || 0) * 25));
            onFinish?.({
              score,
              label: local(locale, "Arşiv Açıldı", "Archive Opened"),
              detail: local(locale, "Yankın başarıyla geri döndü.", "Your echo returned successfully."),
              outcome: "success",
            });
          } else if (event.snapshot.phase === "failed" && !finishedRef.current) {
            finishedRef.current = true;
            const score = Math.max(10, Math.round(event.snapshot.marks * 25));
            onFinish?.({
              score,
              label: local(locale, "Rota Kesildi", "Route Interrupted"),
              detail: event.snapshot.message || local(locale, "Dinleyici kaydı aldı.", "The listener recorded you."),
              outcome: "failure",
            });
          }
        }
        if (event.type === "toast") setToast(event.message);
        if (event.type === "ready") setReady(true);
      },
      demo,
    )
      .then((handle) => {
        if (disposed) {
          handle.dispose();
          return;
        }
        handleRef.current = handle;
        setReady(true);
        engine.runRenderLoop(() => handle.scene.render());
      })
      .catch((error: unknown) => {
        console.error("[YANKI] Game scene failed to initialize", error);
        if (!disposed) setToast(local(locale, "Arşiv yüklenemedi. Yeniden başlatmayı dene.", "Archive failed to load. Try restarting."));
      });

    const onResize = () => engine.resize();
    const onVisibilityChange = () => {
      if (!document.hidden) engine.resize();
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      handleRef.current?.dispose();
      handleRef.current = null;
      engine.dispose();
      startedRef.current = false;
    };
  }, [locale, mastery, onFinish]);

  useEffect(() => {
    const update = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const moveEnd = () => {
    handleRef.current?.setVirtualMove(0, 0);
  };

  const updateJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pad = event.currentTarget;
    const bounds = pad.getBoundingClientRect();
    const radius = bounds.width * 0.38;
    let x = (event.clientX - (bounds.left + bounds.width / 2)) / radius;
    let z = (event.clientY - (bounds.top + bounds.height / 2)) / radius;
    const magnitude = Math.hypot(x, z);
    if (magnitude > 1) {
      x /= magnitude;
      z /= magnitude;
    }
    pad.style.setProperty("--joy-x", `${x * bounds.width * 0.24}px`);
    pad.style.setProperty("--joy-z", `${z * bounds.height * 0.24}px`);
    handleRef.current?.setVirtualMove(x, z);
  };

  const joystickStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateJoystick(event);
  };

  const joystickEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--joy-x", "0px");
    event.currentTarget.style.setProperty("--joy-z", "0px");
    moveEnd();
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await rootRef.current?.requestFullscreen?.();
  };

  const restart = () => {
    finishedRef.current = false;
    handleRef.current?.restart();
    setToast(local(locale, "Yeni rota kayda geçti. İlk işareti bul.", "New route recorded. Find the first mark."));
  };

  return (
    <div ref={rootRef} className={`game-shell echo-room-3d is-${viewMode} ${isFullscreen ? "is-fullscreen" : ""}`}>
      <canvas ref={canvasRef} className="game-canvas" aria-label={local(locale, "Yankı oyun alanı", "Echo play area")} />
      <div className="game-vignette" aria-hidden="true" />

      <header className="game-header">
        <div className="brand-lockup">
          <img src={assets.logo} alt="Yankı işareti" />
          <span>
            <b>SELY</b>
            <em>YANKI</em>
          </span>
        </div>
        <div className="header-center">
          <span>01 / {local(locale, "YANSIMA ARŞİVİ", "REFLECTION ARCHIVE")}</span>
          <strong>{snapshot.objective}</strong>
        </div>
        <div className="header-actions">
          <button className="mode-action" aria-pressed={viewMode === "window"} onClick={() => setViewMode("window")}>
            {local(locale, "Pencere", "Window")}
          </button>
          <button className="mode-action" aria-pressed={viewMode === "cinema"} onClick={() => setViewMode("cinema")}>
            {local(locale, "Sinema", "Cinema")}
          </button>
          <button
            className="icon-action"
            onClick={() => setSoundOn((value) => !value)}
            aria-label={soundOn ? local(locale, "Sesi kapat", "Mute sound") : local(locale, "Sesi aç", "Unmute sound")}
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            className="icon-action"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? local(locale, "Tam ekrandan çık", "Exit fullscreen") : local(locale, "Tam ekrana al", "Fullscreen")}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>

      <section className="status-rail" aria-label={local(locale, "Tur durumu", "Round status")}>
        <div>
          <span>{local(locale, "YANKI", "ECHO")}</span>
          <b>{String(snapshot.echoes).padStart(2, "0")}</b>
        </div>
        <div>
          <span>{local(locale, "SESSİZLİK", "SILENCE")}</span>
          <b>{Math.max(0, 32 - snapshot.noise).toString().padStart(2, "0")}</b>
        </div>
        <div>
          <span>{local(locale, "İŞARET", "MARKS")}</span>
          <b>{snapshot.marks}/3</b>
        </div>
        <div className={snapshot.doorOpen ? "status-open" : ""}>
          <span>{local(locale, "MÜHÜR", "SEAL")}</span>
          <b>{snapshot.doorOpen ? local(locale, "AÇIK", "OPEN") : local(locale, "KAPALI", "CLOSED")}</b>
        </div>
      </section>

      <div className="wayfinding-index" aria-label={local(locale, "Yakındaki hedef bilgisi", "Nearby objective info")}>
        <span>AKUSTİK İZ / 01</span>
        <div>
          <i aria-hidden="true">↗</i>
          <b>
            {snapshot.doorOpen
              ? local(locale, "Açılan mühre yönel", "Head to the opened seal")
              : local(locale, "Kuzey ölçeği işaretini izle", "Follow the north mark")}
          </b>
        </div>
      </div>

      <aside className="objective-card">
        <span>{local(locale, "AKUSTİK NOT", "ACOUSTIC NOTE")}</span>
        <p>{snapshot.message}</p>
        <button onClick={() => setHelpOpen((value) => !value)} aria-expanded={helpOpen}>
          <HelpCircle size={15} /> {helpOpen ? local(locale, "Notu kapat", "Close note") : local(locale, "Rota kılavuzu", "Route guide")}
        </button>
      </aside>

      {helpOpen && (
        <aside className="help-card">
          <span>{local(locale, "ROTAYI OKU", "READ THE ROUTE")}</span>
          <p>
            {local(
              locale,
              "Turkuaz halkalar gizli yol döşemelerini kısa süre açar. Her kaide yaklaştığında kayda geçer; üçü tamamlanınca bakır mühür ışık verir.",
              "Turquoise rings briefly reveal hidden path tiles. Approaching pedestals activates them; completing all three opens the copper seal.",
            )}
          </p>
          <div>
            <kbd>WASD</kbd>
            <kbd>↑↓←→</kbd>
            <kbd>SPACE</kbd>
          </div>
        </aside>
      )}

      <div className="desktop-actions">
        <button
          className="pulse-button"
          onClick={() => handleRef.current?.pulse()}
          disabled={snapshot.echoes === 0 || snapshot.phase !== "explore"}
        >
          <span>{local(locale, "Yankı gönder", "Send echo")}</span>
          <b>SPACE</b>
          <i aria-hidden="true">◌</i>
        </button>
        <button className="expand-action" onClick={toggleFullscreen}>
          <Expand size={16} /> {isFullscreen ? local(locale, "Pencereden çık", "Exit window") : local(locale, "Alanı büyüt", "Expand area")}
        </button>
      </div>

      <div className="mobile-controls" aria-label={local(locale, "Dokunmatik oyun kontrolleri", "Touch game controls")}>
        <div
          ref={joystickRef}
          className="movement-pad"
          role="group"
          aria-label={local(locale, "Hareket joystick'i", "Movement joystick")}
          onPointerDown={joystickStart}
          onPointerMove={updateJoystick}
          onPointerUp={joystickEnd}
          onPointerCancel={joystickEnd}
          onLostPointerCapture={joystickEnd}
        >
          <span className="joystick-knob" aria-hidden="true" />
        </div>
        <button
          className="mobile-pulse"
          onClick={() => handleRef.current?.pulse()}
          disabled={snapshot.echoes === 0 || snapshot.phase !== "explore"}
        >
          <span>{local(locale, "YANKI", "ECHO")}</span>
          <b>{snapshot.echoes}</b>
        </button>
      </div>

      <p className="toast-line" aria-live="polite">
        {toast}
      </p>

      {!ready && (
        <div className="boot-panel">
          <img src={assets.visualTarget} alt="" />
          <div>
            <span>{local(locale, "YANSIMA ARŞİVİ", "REFLECTION ARCHIVE")}</span>
            <b>{local(locale, "Oda dinleniyor…", "Listening to room…")}</b>
          </div>
        </div>
      )}

      {snapshot.phase !== "explore" && (
        <section className="result-overlay" role="dialog" aria-modal="true" aria-label={local(locale, "Tur sonucu", "Round result")}>
          <div className={snapshot.phase === "won" ? "result-card result-won" : "result-card"}>
            <span>{snapshot.phase === "won" ? local(locale, "ARŞİV AÇILDI", "ARCHIVE OPENED") : local(locale, "ROTA KESİLDİ", "ROUTE CUT")}</span>
            <h1>{snapshot.phase === "won" ? local(locale, "Yankın geri döndü.", "Your echo returned.") : local(locale, "Dinleyici kaydı aldı.", "The listener recorded you.")}</h1>
            <p>{snapshot.message}</p>
            <div className="result-meta">
              <b>{snapshot.marks}/3</b>
              <span>{local(locale, "işaret", "marks")}</span>
              <b>{snapshot.echoes}</b>
              <span>{local(locale, "yankı kaldı", "echoes left")}</span>
            </div>
            <button onClick={restart}>
              <RotateCcw size={16} /> {local(locale, "Yeni rota başlat", "Start new route")}
            </button>
          </div>
        </section>
      )}

      <div className="portrait-lock">
        <img src={assets.logo} alt="" />
        <div>
          <span>{local(locale, "YANKI YATAY OYNANIR", "ECHO IS PLAYED IN LANDSCAPE")}</span>
          <b>{local(locale, "Rotayı görmek için cihazını çevir.", "Rotate your device to see the route.")}</b>
        </div>
      </div>
    </div>
  );
}
