"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CSRF_HEADER = "x-csrf-token";
const MAX_DURATION_SECONDS = 4 * 60 * 60; // 4 Stunden

const MODES = {
  SHORT: { learn: 25 * 60, pause: 5 * 60, label: "25 Min / 5 Min" },
  LONG: { learn: 50 * 60, pause: 10 * 60, label: "50 Min / 10 Min" },
};

type TimerState = {
  id: string;
  mode: "SHORT" | "LONG";
  startTime: string;
  currentPhase: "LEARN" | "PAUSE";
  phaseStartTime: string;
  totalElapsedSeconds: number;
  learnSeconds: number;
} | null;

type Stats = {
  level: number;
  progress: number;
  progressNeeded: number;
  progressToNext: number;
  lCoins: number;
};

function readCsrf(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("finanzapp_csrf="));
  if (!match) return null;
  return decodeURIComponent(match.split("=")[1]);
}

export default function LearningView() {
  const router = useRouter();
  const [timer, setTimer] = useState<TimerState>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<"SHORT" | "LONG">("SHORT");
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionData, setCompletionData] = useState<{
    totalTime: string;
    lCoinsEarned: number;
    progressEarned: number;
    levelUp: boolean;
    newLevel: number;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTimer();
    loadStats();
  }, []);

  useEffect(() => {
    if (timer) {
      startTimerInterval();
    } else {
      stopTimerInterval();
    }
    return () => stopTimerInterval();
  }, [timer]);

  const loadTimer = async () => {
    try {
      const res = await fetch("/api/learning/timer");
      if (res.ok) {
        const data = await res.json();
        if (data.timer) {
          // Prüfe ob Timer noch aktiv
          const now = new Date();
          const startTime = new Date(data.timer.startTime);
          const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          
          if (elapsed >= MAX_DURATION_SECONDS) {
            // Timer ist abgelaufen
            setTimer(null);
          } else {
            setTimer(data.timer);
          }
        } else {
          setTimer(null);
        }
      }
    } catch {
      setTimer(null);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch("/api/learning/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Ignorieren
    }
  };

  const startTimer = async () => {
    const csrf = readCsrf();
    if (!csrf) {
      alert("Sicherheits-Token fehlt. Bitte Seite neu laden.");
      return;
    }

    try {
      const res = await fetch("/api/learning/timer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER]: csrf,
        } as Record<string, string>,
        body: JSON.stringify({ mode: selectedMode }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Timer konnte nicht gestartet werden.");
        return;
      }

      await loadTimer();
    } catch {
      alert("Netzwerkfehler beim Starten des Timers.");
    }
  };

  const stopTimer = async () => {
    if (!timer) return;
    
    const csrf = readCsrf();
    if (!csrf) return;

    // Wenn in LEARN-Phase, speichere aktuelle Lernzeit zuerst
    if (timer.currentPhase === "LEARN") {
      const now = new Date();
      const phaseStartTime = new Date(timer.phaseStartTime);
      const phaseElapsed = Math.floor((now.getTime() - phaseStartTime.getTime()) / 1000);
      
      try {
        await fetch("/api/learning/timer", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            [CSRF_HEADER]: csrf,
          } as Record<string, string>,
          body: JSON.stringify({
            phase: timer.currentPhase,
            totalElapsedSeconds: getTotalElapsed(),
            learnSeconds: timer.learnSeconds + phaseElapsed,
          }),
        });
      } catch {
        // Ignorieren
      }
    }

    try {
      const res = await fetch("/api/learning/timer", {
        method: "DELETE",
        headers: {
          [CSRF_HEADER]: csrf,
        } as Record<string, string>,
      });

      if (res.ok) {
        setTimer(null);
      }
    } catch {
      // Ignorieren
    }
  };

  const completeTimer = async () => {
    if (!timer) return;

    const csrf = readCsrf();
    if (!csrf) return;

    // Update Timer zuerst, um aktuelle Lernzeit zu speichern
    const now = new Date();
    const phaseStartTime = new Date(timer.phaseStartTime);
    const phaseElapsed = Math.floor((now.getTime() - phaseStartTime.getTime()) / 1000);
    
    if (timer.currentPhase === "LEARN") {
      // Aktualisiere Lernzeit wenn in LEARN-Phase
      try {
        await fetch("/api/learning/timer", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            [CSRF_HEADER]: csrf,
          } as Record<string, string>,
          body: JSON.stringify({
            phase: timer.currentPhase,
            totalElapsedSeconds: getTotalElapsed(),
            learnSeconds: timer.learnSeconds + phaseElapsed,
          }),
        });
      } catch {
        // Ignorieren
      }
    }

    // Berechne Gesamtzeit
    const startTime = new Date(timer.startTime);
    const totalSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    try {
      const res = await fetch("/api/learning/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER]: csrf,
        } as Record<string, string>,
        body: JSON.stringify({ totalSeconds }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Fehler beim Abschließen.");
        return;
      }

      const data = await res.json();
      setCompletionData({
        totalTime: data.totalTime,
        lCoinsEarned: data.lCoinsEarned,
        progressEarned: data.progressEarned || data.learnMinutes || 0,
        levelUp: data.levelUp,
        newLevel: data.newLevel,
      });
      setShowCompletion(true);
      setTimer(null);
      await loadStats();
    } catch {
      alert("Netzwerkfehler beim Abschließen.");
    }
  };

  const startTimerInterval = () => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(async () => {
      // Aktualisiere aktuelle Zeit für UI-Updates
      setCurrentTime(new Date());
      
      if (!timer) {
        stopTimerInterval();
        return;
      }

      const now = new Date();
      const startTime = new Date(timer.startTime);
      const phaseStartTime = new Date(timer.phaseStartTime);
      const elapsedSinceStart = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const elapsedSincePhase = Math.floor((now.getTime() - phaseStartTime.getTime()) / 1000);

      // Prüfe 4h Grenze
      if (elapsedSinceStart >= MAX_DURATION_SECONDS) {
        await completeTimer();
        return;
      }

      const modeConfig = MODES[timer.mode];
      const phaseDuration = timer.currentPhase === "LEARN" ? modeConfig.learn : modeConfig.pause;

      // Phase-Wechsel?
      if (elapsedSincePhase >= phaseDuration) {
        const newPhase = timer.currentPhase === "LEARN" ? "PAUSE" : "LEARN";
        const csrf = readCsrf();
        if (csrf) {
          try {
            // Berechne aktuelle Lernzeit
            let newLearnSeconds = timer.learnSeconds;
            if (timer.currentPhase === "LEARN") {
              // Wenn von LEARN zu PAUSE: addiere abgeschlossene Lernzeit
              newLearnSeconds = timer.learnSeconds + phaseDuration;
            }
            
            await fetch("/api/learning/timer", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                [CSRF_HEADER]: csrf,
              } as Record<string, string>,
              body: JSON.stringify({
                phase: newPhase,
                totalElapsedSeconds: elapsedSinceStart,
                learnSeconds: newLearnSeconds,
              }),
            });
            await loadTimer();
          } catch {
            // Ignorieren
          }
        }
      }
    }, 1000);
  };

  const stopTimerInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const getRemainingTime = (): number => {
    if (!timer) return 0;

    const phaseStartTime = new Date(timer.phaseStartTime);
    const elapsedSincePhase = Math.floor((currentTime.getTime() - phaseStartTime.getTime()) / 1000);
    const modeConfig = MODES[timer.mode];
    const phaseDuration = timer.currentPhase === "LEARN" ? modeConfig.learn : modeConfig.pause;
    const remaining = Math.max(0, phaseDuration - elapsedSincePhase);

    return remaining;
  };

  const getTotalElapsed = (): number => {
    if (!timer) return 0;
    const startTime = new Date(timer.startTime);
    return Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTotalTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}:${mins.toString().padStart(2, "0")} h`;
  };

  const remainingTime = getRemainingTime();
  const totalElapsed = getTotalElapsed();
  const progressPercent = timer
    ? ((MODES[timer.mode][timer.currentPhase === "LEARN" ? "learn" : "pause"] - remainingTime) /
        MODES[timer.mode][timer.currentPhase === "LEARN" ? "learn" : "pause"]) *
      100
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="tech-label text-[#8EB69B]/70">
            FINANZAPP // LERNEN
          </span>
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-[0.24em] text-[#DAF1DE] sm:text-3xl">
              POMODORO TIMER
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden rounded-xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[#8EB69B] hover:border-[#8EB69B]/80 hover:text-[#DAF1DE] sm:block"
          >
            HAUPTMENÜ
          </Link>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-4 py-3">
            <span className="tech-label text-[0.68rem] text-[#8EB69B]">LEVEL</span>
            <p className="mt-1 text-xl font-semibold text-[#DAF1DE]">{stats.level}</p>
          </div>
          <div className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-4 py-3">
            <span className="tech-label text-[0.68rem] text-[#8EB69B]">FORTSCHRITT</span>
            <p className="mt-1 text-sm text-[#DAF1DE]">
              {stats.progress} / {stats.progressNeeded} (bis Level {stats.level + 1})
            </p>
          </div>
          <div className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-4 py-3">
            <span className="tech-label text-[0.68rem] text-[#8EB69B]">L-COINS</span>
            <p className="mt-1 text-xl font-semibold text-[#DAF1DE]">
              {stats.lCoins.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Timer */}
      <div className="glass-panel flex flex-col gap-5 p-5 sm:p-7">
        {loading ? (
          <p className="text-center text-[#8EB69B]">Lade …</p>
        ) : timer ? (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="text-center">
                <span className="tech-label text-[#8EB69B]">
                  {timer.currentPhase === "LEARN" ? "LERNEN" : "PAUSE"}
                </span>
                <p className="mt-2 text-6xl font-bold text-[#DAF1DE]">
                  {formatTime(remainingTime)}
                </p>
                <p className="mt-2 text-sm text-[#8EB69B]">
                  Modus: {MODES[timer.mode].label}
                </p>
                <p className="mt-1 text-xs text-[#8EB69B]/70">
                  Gesamt: {formatTotalTime(totalElapsed)}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md">
                <div className="h-3 w-full overflow-hidden rounded-full bg-[#051F20]/80">
                  <motion.div
                    className={`h-full ${
                      timer.currentPhase === "LEARN" ? "bg-[#8EB69B]" : "bg-[#DAF1DE]"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={stopTimer}
                  className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#235347]/80"
                >
                  STOPPEN
                </button>
                <button
                  onClick={completeTimer}
                  className="rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30"
                >
                  ABSCHLIESSEN
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <span className="tech-label text-[#8EB69B]">TIMER STARTEN</span>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedMode("SHORT")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm uppercase tracking-[0.18em] ${
                    selectedMode === "SHORT"
                      ? "border-[#8EB69B]/80 bg-[#8EB69B]/20 text-[#DAF1DE]"
                      : "border-[#235347]/80 bg-[#163832]/80 text-[#DAF1DE]"
                  }`}
                >
                  {MODES.SHORT.label}
                </button>
                <button
                  onClick={() => setSelectedMode("LONG")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm uppercase tracking-[0.18em] ${
                    selectedMode === "LONG"
                      ? "border-[#8EB69B]/80 bg-[#8EB69B]/20 text-[#DAF1DE]"
                      : "border-[#235347]/80 bg-[#163832]/80 text-[#DAF1DE]"
                  }`}
                >
                  {MODES.LONG.label}
                </button>
              </div>
              <button
                onClick={startTimer}
                className="mt-2 rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30"
              >
                TIMER STARTEN
              </button>
            </div>
          </>
        )}
      </div>

      {/* Completion Popup */}
      <AnimatePresence>
        {showCompletion && completionData && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#051F20]/90 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-panel flex w-full max-w-md flex-col gap-4 p-5 sm:p-6"
              initial={{ y: 40, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 40, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="tech-label text-[#8EB69B]">ZUSAMMENFASSUNG</span>
                <button
                  onClick={() => {
                    setShowCompletion(false);
                    setCompletionData(null);
                  }}
                  className="rounded-full border border-[#235347]/80 bg-[#163832]/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#8EB69B] hover:border-[#8EB69B]/80 hover:text-[#DAF1DE]"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-4 py-3">
                  <p className="text-sm text-[#DAF1DE]">
                    Du hast <span className="text-[#8EB69B] font-semibold">{completionData.totalTime}</span> gelernt
                  </p>
                </div>
                <div className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-4 py-3">
                  <p className="text-sm text-[#DAF1DE]">
                    Dadurch hast du{" "}
                    <span className="text-[#8EB69B] font-semibold">
                      {completionData.lCoinsEarned.toFixed(2)} L-Coins
                    </span>{" "}
                    verdient und{" "}
                    <span className="text-[#8EB69B] font-semibold">
                      {completionData.progressEarned} Lernfortschritt
                    </span>{" "}
                    gesammelt.
                  </p>
                </div>
                {completionData.levelUp && (
                  <div className="rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/10 px-4 py-3">
                    <p className="text-sm font-semibold text-[#DAF1DE]">
                      🎉 Level Up! Du bist jetzt Level {completionData.newLevel}!
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setShowCompletion(false);
                  setCompletionData(null);
                  loadStats();
                }}
                className="mt-2 rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30"
              >
                SCHLIESSEN
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
