import { MonitorSmartphone, Play, QrCode } from "lucide-react";
import { useState, type FormEvent } from "react";

interface QrPinJoinModalProps {
  initialRoomId: string;
  initialPin: string;
  errorMessage: string | null;
  onJoinRoom: (roomId: string, pin: string) => void;
  onStartDemo: () => void;
}

export function QrPinJoinModal({
  initialRoomId,
  initialPin,
  errorMessage,
  onJoinRoom,
  onStartDemo,
}: QrPinJoinModalProps) {
  const [roomId, setRoomId] = useState(initialRoomId);
  const [pin, setPin] = useState(initialPin);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !pin.trim()) return;
    onJoinRoom(roomId.trim().toUpperCase(), pin.trim());
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-indigo-400">
            <QrCode className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Exile Companion HUD</h1>
            <p className="text-sm text-neutral-400">Pair with your PC Control Center via Room ID & PIN</p>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">Room Code</span>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="e.g. EXILE9"
              className="w-full rounded-lg bg-black border border-neutral-800 px-3.5 py-2.5 text-base font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">4-Digit PIN</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="1234"
              className="w-full rounded-lg bg-black border border-neutral-800 px-3.5 py-2.5 text-base font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold py-3 text-base transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <MonitorSmartphone className="h-5 w-5" />
            Connect to PC Host
          </button>
        </form>

        <div className="pt-4 border-t border-neutral-800">
          <button
            type="button"
            onClick={onStartDemo}
            className="w-full rounded-lg border border-neutral-700 hover:border-neutral-600 bg-neutral-900/70 text-neutral-200 py-2.5 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="h-4 w-4 text-emerald-400" />
            Preview Interactive Demo HUD
          </button>
        </div>
      </div>
    </div>
  );
}
