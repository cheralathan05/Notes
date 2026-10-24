'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, FocusSessionItem, TaskItem } from '@/lib/api';
import { useWorkspace } from '@/context/workspace-context';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  Radio,
  Flame,
  CheckSquare,
  Sparkles,
  Award,
  Clock,
  Brain,
  Sliders,
  History,
  AlertCircle,
  ExternalLink,
  Plus,
  MessageSquare,
  X,
} from 'lucide-react';

export default function FocusPage() {
  const { currentWorkspace } = useWorkspace();
  const [activeSession, setActiveSession] = useState<FocusSessionItem | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [sessionTitle, setSessionTitle] = useState('Deep Work Architecture Sprint');
  const [targetMinutes, setTargetMinutes] = useState<number>(25);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [distractions, setDistractions] = useState<number>(0);
  const [todayFocusMinutes, setTodayFocusMinutes] = useState<number>(0);
  const [todayCompletedCount, setTodayCompletedCount] = useState<number>(0);
  const [weekFocusHours, setWeekFocusHours] = useState<number>(0);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySessions, setHistorySessions] = useState<FocusSessionItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Distraction modal state
  const [showDistractionModal, setShowDistractionModal] = useState(false);
  const [distractionReason, setDistractionReason] = useState('');

  // Cancel confirmation modal
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Completion summary modal
  const [completedSummary, setCompletedSummary] = useState<{
    title: string;
    actualMinutes: number;
    distractions: number;
    notes?: string | null;
  } | null>(null);

  // Web Audio Synth State
  const [soundscape, setSoundscape] = useState<'off' | 'binaural' | 'whitenoise' | 'drone'>('off');
  const [audioVolume, setAudioVolume] = useState<number>(0.2);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeNodesRef = useRef<any[]>([]);

  // Wall-Clock Timing References (Eliminates Background-Tab Throttle Drift)
  const resumeTimestampRef = useRef<number>(Date.now());
  const baseElapsedSecondsRef = useRef<number>(0);

  // Load active session, tasks, and totals
  const loadWorkstationData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [activeRes, tasksRes, totalsRes] = await Promise.all([
        api.getActiveFocusSession().catch(() => null),
        api.getTasks().catch(() => null),
        api.getFocusTotals().catch(() => null),
      ]);

      if (activeRes?.success && activeRes?.data?.session) {
        const sess = activeRes.data.session;
        setActiveSession(sess);
        setSessionTitle(sess.title);
        if (sess.taskId) setSelectedTaskId(sess.taskId);
        if (sess.notes) setSessionNotes(sess.notes);
        setDistractions(sess.distractions || 0);
        setTargetMinutes(sess.targetMinutes);

        const targetSecs = sess.targetMinutes * 60;
        if (sess.status === 'RUNNING') {
          setIsRunning(true);
          const currentElapsed = sess.currentElapsedSeconds !== undefined
            ? sess.currentElapsedSeconds
            : sess.actualSeconds + Math.max(0, Math.floor((Date.now() - new Date(sess.startedAt).getTime()) / 1000));
          
          baseElapsedSecondsRef.current = sess.actualSeconds;
          resumeTimestampRef.current = new Date(sess.startedAt).getTime();
          setSecondsRemaining(Math.max(0, targetSecs - currentElapsed));
        } else if (sess.status === 'PAUSED') {
          setIsRunning(false);
          baseElapsedSecondsRef.current = sess.actualSeconds;
          setSecondsRemaining(Math.max(0, targetSecs - sess.actualSeconds));
        }
      } else {
        setActiveSession(null);
        setIsRunning(false);
      }

      if (tasksRes?.success && tasksRes?.data?.tasks) {
        setTasks(tasksRes.data.tasks);
      }

      if (totalsRes?.success && totalsRes?.data) {
        setTodayFocusMinutes(totalsRes.data.todayMinutes || 0);
        setTodayCompletedCount(totalsRes.data.completedCountToday || 0);
        setWeekFocusHours(totalsRes.data.weekHours || 0);
      }
    } catch (err: any) {
      console.error('Failed to load focus workstation data:', err);
      setErrorMessage('Failed to connect to focus service. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkstationData();
  }, [currentWorkspace?.id]);

  // Wall-Clock Accurate Timer Tick (Immune to sleep/background throttling)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRunning && secondsRemaining > 0) {
      timer = setInterval(() => {
        const now = Date.now();
        const elapsedSinceResume = Math.floor((now - resumeTimestampRef.current) / 1000);
        const totalElapsed = baseElapsedSecondsRef.current + Math.max(0, elapsedSinceResume);
        const totalTargetSeconds = targetMinutes * 60;
        const remaining = Math.max(0, totalTargetSeconds - totalElapsed);

        setSecondsRemaining(remaining);

        if (remaining <= 0) {
          setIsRunning(false);
          handleAutoFinish();
        }
      }, 500); // 500ms sampling for snappy responsiveness
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, targetMinutes]);

  // Web Audio Synthesizer Engine
  const stopAudio = () => {
    activeNodesRef.current.forEach((n) => {
      try {
        if (n.stop) n.stop();
        if (n.disconnect) n.disconnect();
      } catch (e) {}
    });
    activeNodesRef.current = [];
  };

  const startSoundscape = (type: 'binaural' | 'whitenoise' | 'drone') => {
    stopAudio();
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isAudioMuted ? 0 : audioVolume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;
      activeNodesRef.current.push(masterGain);

      if (type === 'binaural') {
        // True 40Hz Gamma Binaural Beat (Left 200Hz, Right 240Hz -> 40Hz cortical entrainment)
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        const merger = ctx.createChannelMerger(2);

        oscL.frequency.setValueAtTime(200, ctx.currentTime);
        oscR.frequency.setValueAtTime(240, ctx.currentTime);
        oscL.type = 'sine';
        oscR.type = 'sine';

        oscL.connect(merger, 0, 0);
        oscR.connect(merger, 0, 1);
        merger.connect(masterGain);

        oscL.start();
        oscR.start();
        activeNodesRef.current.push(oscL, oscR);
      } else if (type === 'whitenoise') {
        // Paul Kellet's Filtered Pink Noise Buffer (Gentle 1/f falloff)
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(masterGain);
        whiteNoise.start();
        activeNodesRef.current.push(whiteNoise);
      } else if (type === 'drone') {
        // Deep Ambient Cyberpunk Pad (A2 110Hz, E3 164.81Hz, A3 220Hz Warm Sub-Harmonics)
        [110, 164.81, 220].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start();
          activeNodesRef.current.push(osc);
        });
      }
      setSoundscape(type);
    } catch (e) {
      console.error('Audio synthesizer error:', e);
    }
  };

  const handleToggleSoundscape = (type: 'binaural' | 'whitenoise' | 'drone') => {
    if (soundscape === type) {
      stopAudio();
      setSoundscape('off');
    } else {
      startSoundscape(type);
    }
  };

  const handleToggleMute = () => {
    if (!masterGainRef.current) return;
    if (isAudioMuted) {
      masterGainRef.current.gain.value = audioVolume;
      setIsAudioMuted(false);
    } else {
      masterGainRef.current.gain.value = 0;
      setIsAudioMuted(true);
    }
  };

  const handleVolumeChange = (v: number) => {
    setAudioVolume(v);
    if (masterGainRef.current && !isAudioMuted) {
      masterGainRef.current.gain.value = v;
    }
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // Timer Session Actions
  const handleStartSession = async () => {
    setErrorMessage(null);
    try {
      const res = await api.startFocusSession({
        taskId: selectedTaskId || undefined,
        title: sessionTitle || 'Deep Work Session',
        targetMinutes,
        notes: sessionNotes || undefined,
      });

      if (res.success && res.data?.session) {
        const sess = res.data.session;
        setActiveSession(sess);
        baseElapsedSecondsRef.current = 0;
        resumeTimestampRef.current = Date.now();
        setSecondsRemaining(targetMinutes * 60);
        setIsRunning(true);
        setDistractions(0);
      } else {
        throw new Error(res.error?.message || 'Failed to start session');
      }
    } catch (err: any) {
      console.error('Failed to start session:', err);
      setErrorMessage(err.message || 'Failed to start focus session.');
    }
  };

  const handlePauseSession = async () => {
    setIsRunning(false);
    if (activeSession?.id) {
      try {
        const res = await api.pauseFocusSession(activeSession.id);
        if (res.success && res.data?.session) {
          setActiveSession(res.data.session);
          baseElapsedSecondsRef.current = res.data.session.actualSeconds;
        }
      } catch (e) {
        console.error('Failed to pause session on backend:', e);
      }
    }
  };

  const handleResumeSession = async () => {
    if (activeSession?.id) {
      try {
        const res = await api.resumeFocusSession(activeSession.id);
        if (res.success && res.data?.session) {
          setActiveSession(res.data.session);
          baseElapsedSecondsRef.current = res.data.session.actualSeconds;
          resumeTimestampRef.current = Date.now();
          setIsRunning(true);
        }
      } catch (e) {
        console.error('Failed to resume session on backend:', e);
      }
    } else {
      handleStartSession();
    }
  };

  const handleCompleteSession = async () => {
    setIsRunning(false);
    stopAudio();
    setSoundscape('off');

    const totalTargetSecs = targetMinutes * 60;
    const computedElapsed = Math.max(1, totalTargetSecs - secondsRemaining);
    const elapsedMins = Math.max(1, Math.round(computedElapsed / 60));

    if (activeSession?.id) {
      try {
        const res = await api.completeFocusSession(activeSession.id, sessionNotes, distractions);
        if (res.success) {
          setCompletedSummary({
            title: activeSession.title,
            actualMinutes: elapsedMins,
            distractions,
            notes: sessionNotes,
          });
        }
      } catch (e) {
        console.error('Complete session error:', e);
      }
    } else {
      setCompletedSummary({
        title: sessionTitle,
        actualMinutes: elapsedMins,
        distractions,
        notes: sessionNotes,
      });
    }

    // Refresh totals from database to prevent drift or double-counting
    try {
      const totalsRes = await api.getFocusTotals();
      if (totalsRes?.success && totalsRes?.data) {
        setTodayFocusMinutes(totalsRes.data.todayMinutes || 0);
        setTodayCompletedCount(totalsRes.data.completedCountToday || 0);
        setWeekFocusHours(totalsRes.data.weekHours || 0);
      }
    } catch (e) {}

    setActiveSession(null);
    setSecondsRemaining(targetMinutes * 60);
    setDistractions(0);
    setSessionNotes('');
  };

  const handleCancelSession = async () => {
    setShowCancelModal(false);
    setIsRunning(false);
    stopAudio();
    setSoundscape('off');

    if (activeSession?.id) {
      try {
        await api.cancelFocusSession(activeSession.id);
      } catch (e) {
        console.error('Cancel session error:', e);
      }
    }

    setActiveSession(null);
    setSecondsRemaining(targetMinutes * 60);
    setDistractions(0);
    setSessionNotes('');
  };

  const handleResetIdle = () => {
    if (isRunning) return;
    setSecondsRemaining(targetMinutes * 60);
    baseElapsedSecondsRef.current = 0;
  };

  const handleAutoFinish = () => {
    handleCompleteSession();
  };

  const handleSelectPreset = (mins: number) => {
    if (isRunning) return;
    setTargetMinutes(mins);
    setSecondsRemaining(mins * 60);
    baseElapsedSecondsRef.current = 0;
  };

  // Record Distraction
  const handleLogDistraction = async () => {
    const newCount = distractions + 1;
    setDistractions(newCount);
    setShowDistractionModal(false);

    if (activeSession?.id) {
      try {
        await api.recordDistraction(activeSession.id, distractionReason || undefined);
      } catch (e) {
        console.error('Record distraction error:', e);
      }
    }
    setDistractionReason('');
  };

  // Fetch Session History
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setIsLoadingHistory(true);
    try {
      const res = await api.getFocusSessionHistory({ limit: 30 });
      if (res?.success && res.data?.sessions) {
        setHistorySessions(res.data.sessions);
      }
    } catch (e) {
      console.error('Failed to load focus history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Format time
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalSecs = targetMinutes * 60;
  const progressRatio = totalSecs > 0 ? (totalSecs - secondsRemaining) / totalSecs : 0;
  const strokeDashoffset = 754 - 754 * progressRatio;

  const linkedTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#080808] text-zinc-100 font-sans p-6 sm:p-8 space-y-8 max-w-5xl mx-auto flex flex-col justify-between">
        {/* ─── Top Header & Metrics ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Brain className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold font-mono tracking-tight text-zinc-100">
                Deep Work & Focus Workstation
              </h1>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-1">
              Synchronize brainwaves, eliminate distractions, and ship mission-critical code.
            </p>
          </div>

          {/* Productivity Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-xl font-mono text-xs">
              <Flame className="h-4 w-4 text-amber-400" />
              <span className="text-zinc-400">Today Focused:</span>
              <span className="font-bold text-amber-400">{todayFocusMinutes} mins</span>
            </div>

            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-xl font-mono text-xs">
              <Award className="h-4 w-4 text-emerald-400" />
              <span className="text-zinc-400">Completed:</span>
              <span className="font-bold text-zinc-200">{todayCompletedCount}</span>
            </div>

            <button
              onClick={handleOpenHistory}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-xl font-mono text-xs transition-colors"
              title="View Focus Session History"
            >
              <History className="h-3.5 w-3.5 text-zinc-400" />
              <span>History</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs font-mono text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-zinc-400 hover:text-zinc-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ─── Central Circular Timer Workstation ─── */}
        <div className="flex flex-col items-center justify-center py-4 space-y-7">
          {/* Circular SVG Timer */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="160"
                cy="160"
                r="120"
                className="text-zinc-900 stroke-current"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="160"
                cy="160"
                r="120"
                className="text-emerald-500 stroke-current transition-all duration-500 ease-linear"
                strokeWidth="7"
                strokeDasharray="754"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Inner Timer Content */}
            <div className="absolute flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-zinc-100">
                {timeDisplay}
              </span>
              <span className="text-xs font-mono uppercase tracking-widest pt-1">
                {isRunning ? (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    Focusing
                  </span>
                ) : activeSession ? (
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Session Paused
                  </span>
                ) : (
                  <span className="text-zinc-500">Ready to Focus</span>
                )}
              </span>

              {/* Distraction count chip */}
              <button
                onClick={() => setShowDistractionModal(true)}
                className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-amber-300 transition-colors"
                title="Log distraction for this session"
              >
                <span>Distractions:</span>
                <span className="font-semibold text-amber-400">{distractions}</span>
                <span className="text-zinc-500 hover:text-zinc-300 pl-0.5">(+ Log)</span>
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { label: '25m Pomodoro', mins: 25 },
              { label: '50m Deep Flow', mins: 50 },
              { label: '90m Sprint', mins: 90 },
            ].map((p) => (
              <button
                key={p.mins}
                disabled={isRunning}
                onClick={() => handleSelectPreset(p.mins)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  targetMinutes === p.mins
                    ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800 disabled:opacity-50'
                }`}
              >
                {p.label}
              </button>
            ))}

            {!isRunning && !activeSession && (
              <div className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-400">
                <span>Custom:</span>
                <input
                  type="number"
                  min="1"
                  max="240"
                  value={targetMinutes}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setTargetMinutes(val);
                    setSecondsRemaining(val * 60);
                  }}
                  className="w-12 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-center text-xs text-zinc-200 focus:outline-none"
                />
                <span>m</span>
              </div>
            )}
          </div>

          {/* Primary Controls */}
          <div className="flex items-center gap-3">
            {!isRunning ? (
              <button
                onClick={activeSession ? handleResumeSession : handleStartSession}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold transition-all shadow-lg shadow-emerald-950/50"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>{activeSession ? 'Resume Focus' : 'Start Focus Session'}</span>
              </button>
            ) : (
              <button
                onClick={handlePauseSession}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-mono text-xs font-semibold transition-all border border-zinc-700 shadow-sm"
              >
                <Pause className="h-4 w-4 fill-current" />
                <span>Pause</span>
              </button>
            )}

            <button
              onClick={handleCompleteSession}
              disabled={!activeSession && secondsRemaining === targetMinutes * 60}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-200 font-mono text-xs transition-colors border border-zinc-800 disabled:opacity-40"
              title="Complete & Log Session"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Complete</span>
            </button>

            {activeSession && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-950 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 font-mono text-xs transition-colors border border-zinc-800 hover:border-red-900/50"
                title="Cancel Session"
              >
                <XCircle className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            )}

            {!activeSession && !isRunning && secondsRemaining < targetMinutes * 60 && (
              <button
                onClick={handleResetIdle}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-mono text-xs transition-colors border border-zinc-800"
                title="Reset Timer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── Bottom Workstation Settings ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-zinc-800/80">
          {/* Linked Task & Session Notes */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-300">
                <CheckSquare className="h-4 w-4 text-emerald-400" />
                <span>Linked Task & Intention</span>
              </div>
              {linkedTask && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {linkedTask.priority} · {linkedTask.status}
                </span>
              )}
            </div>

            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              disabled={isRunning}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 disabled:opacity-60"
            >
              <option value="">No task linked (Freeform Sprint)</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.status}] {t.title}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Session focus intention (e.g. Implement schema migration)..."
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              disabled={isRunning}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-700 disabled:opacity-60"
            />

            <textarea
              placeholder="Session notes, links, or scratchpad thoughts..."
              rows={2}
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-700 resize-none"
            />
          </div>

          {/* Ambient Audio Synthesizer */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-300">
                <Radio className="h-4 w-4 text-emerald-400" />
                <span>Ambient Soundscape (Web Audio)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">
                  {soundscape === 'off' ? 'Stopped' : isAudioMuted ? 'Muted' : soundscape}
                </span>
                {soundscape !== 'off' && (
                  <button
                    onClick={handleToggleMute}
                    className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                    title={isAudioMuted ? 'Unmute' : 'Mute'}
                  >
                    {isAudioMuted ? <VolumeX className="h-3.5 w-3.5 text-amber-400" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'binaural', label: 'Gamma 40Hz', desc: 'Binaural Beat' },
                { id: 'whitenoise', label: 'Pink Noise', desc: '1/f Calm' },
                { id: 'drone', label: 'Cyber Pad', desc: 'Sub-Harmonic' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleToggleSoundscape(s.id as any)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    soundscape === s.id
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-xs font-mono font-medium">{s.label}</div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>

            {soundscape === 'binaural' && (
              <p className="text-[10px] font-mono text-emerald-500/80">
                * Stereo headphones required for true 40Hz binaural hemispheric synchronization.
              </p>
            )}

            {soundscape !== 'off' && (
              <div className="flex items-center gap-2 pt-1 text-xs font-mono text-zinc-400">
                <Volume2 className="h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={audioVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* ─── Distraction Logger Modal ─── */}
        {showDistractionModal && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-mono font-bold text-zinc-100 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-400" />
                  Log Distraction
                </h3>
                <button
                  onClick={() => setShowDistractionModal(false)}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs font-mono text-zinc-400">
                Acknowledge the impulse and return quickly to flow. What pulled your attention?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Slack / Chat', 'Email', 'Meeting / Call', 'Web Browsing', 'Colleague question'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setDistractionReason(tag)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                      distractionReason === tag
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Or custom reason (optional)..."
                value={distractionReason}
                onChange={(e) => setDistractionReason(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowDistractionModal(false)}
                  className="px-3 py-1.5 rounded-lg font-mono text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleLogDistraction}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 font-mono text-xs font-semibold text-white"
                >
                  Record & Refocus
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Cancel Session Confirmation Modal ─── */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full space-y-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-5 w-5" />
                <h3 className="text-sm font-mono font-bold text-zinc-100">Cancel Focus Session?</h3>
              </div>
              <p className="text-xs font-mono text-zinc-400">
                This will abort the active session. Elapsed time will not count toward completed focus minutes.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="px-3 py-1.5 rounded-lg font-mono text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Keep Focusing
                </button>
                <button
                  onClick={handleCancelSession}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 font-mono text-xs font-semibold text-white"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Completed Summary Modal ─── */}
        {completedSummary && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-emerald-500/40 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-mono font-bold text-zinc-100">Session Completed!</h3>
                <p className="text-xs font-mono text-zinc-400 mt-1">{completedSummary.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800 font-mono text-xs">
                <div>
                  <span className="text-zinc-500 block text-[10px]">Focused Time</span>
                  <span className="font-bold text-emerald-400">{completedSummary.actualMinutes} mins</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Distractions</span>
                  <span className="font-bold text-amber-400">{completedSummary.distractions}</span>
                </div>
              </div>
              {completedSummary.notes && (
                <div className="text-left bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 text-[11px] font-mono text-zinc-300">
                  <span className="text-[10px] text-zinc-500 block">Notes:</span>
                  {completedSummary.notes}
                </div>
              )}
              <button
                onClick={() => setCompletedSummary(null)}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold"
              >
                Continue Flow
              </button>
            </div>
          </div>
        )}

        {/* ─── Session History Modal ─── */}
        {showHistoryModal && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-2xl w-full space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-mono font-bold text-zinc-100">Focus Session History</h3>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
                {isLoadingHistory ? (
                  <div className="py-12 text-center text-xs font-mono text-zinc-500">
                    Loading persisted focus history...
                  </div>
                ) : historySessions.length === 0 ? (
                  <div className="py-12 text-center text-xs font-mono text-zinc-500">
                    No focus sessions recorded yet. Start your first sprint!
                  </div>
                ) : (
                  historySessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-semibold text-zinc-200">{s.title}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border ${
                            s.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400">
                        <span>
                          Duration: <strong className="text-zinc-200">{Math.round(s.actualSeconds / 60)}m</strong> / {s.targetMinutes}m
                        </span>
                        <span>
                          Distractions: <strong className="text-amber-400">{s.distractions || 0}</strong>
                        </span>
                        {s.task && (
                          <span className="text-emerald-400/90 truncate max-w-xs">
                            Task: {s.task.title}
                          </span>
                        )}
                        <span className="text-zinc-500 ml-auto text-[10px]">
                          {new Date(s.startedAt).toLocaleString()}
                        </span>
                      </div>
                      {s.notes && (
                        <p className="text-[11px] font-mono text-zinc-400 bg-zinc-900/60 p-2 rounded border border-zinc-850">
                          {s.notes}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
