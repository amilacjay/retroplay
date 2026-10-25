import { useEffect, useRef, useState } from 'react';

export type SleepSetting = { kind: 'minutes'; endsAt: number } | { kind: 'track'; trackUri: string } | null;

/** Pauses playback after a number of minutes, or when the current track ends (the track URI changes). */
export function useSleepTimer(currentTrackUri: string | undefined, pause: () => void) {
  const [setting, setSetting] = useState<SleepSetting>(null);
  const [now, setNow] = useState(() => Date.now());
  const pauseRef = useRef(pause);
  pauseRef.current = pause;

  useEffect(() => {
    if (setting?.kind !== 'minutes') return;
    let timer = 0;
    const tick = () => {
      const time = Date.now(); setNow(time);
      // Stop ticking immediately so a tick before the re-render can't pause twice.
      if (time >= setting.endsAt) { window.clearInterval(timer); pauseRef.current(); setSetting(null); }
    };
    timer = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(timer);
  }, [setting]);

  useEffect(() => {
    if (setting?.kind === 'track' && currentTrackUri && currentTrackUri !== setting.trackUri) { pauseRef.current(); setSetting(null); }
  }, [currentTrackUri, setting]);

  const remainingMs = setting?.kind === 'minutes' ? Math.max(0, setting.endsAt - now) : null;
  return {
    setting, remainingMs,
    startMinutes: (minutes: number) => setSetting({ kind: 'minutes', endsAt: Date.now() + minutes * 60_000 }),
    endOfTrack: () => { if (currentTrackUri) setSetting({ kind: 'track', trackUri: currentTrackUri }); },
    cancel: () => setSetting(null),
  };
}
