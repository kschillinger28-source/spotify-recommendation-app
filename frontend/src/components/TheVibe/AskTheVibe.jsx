import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowUp } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOOD_IDS = {
  focus: "focus",
  hype: "hype",
  chill: "chill",
  melancholy: "melancholy",
  euphoric: "euphoric",
  "late night": "late-night",
};

export default function AskTheVibe({ orb }) {
  const [moment, setMoment] = useState("");
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("idle"); // idle | streaming | error
  const replyRef = useRef("");
  const moodSeen = useRef(false);
  const clearTimer = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    const text = moment.trim();
    if (!text || status === "streaming") return;
    setStatus("streaming");
    setReply("");
    replyRef.current = "";
    moodSeen.current = false;
    let failed = false;
    try {
      const res = await fetch(`${API}/ai/ask-the-vibe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moment: text, hour: new Date().getHours() }),
      });
      if (!res.ok || !res.body) throw new Error("bad response");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (!raw.startsWith("data:")) continue;
          const payload = raw.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.error) {
              failed = true;
              setStatus("error");
              continue;
            }
            if (evt.t) {
              replyRef.current += evt.t;
              if (!moodSeen.current) {
                const m = replyRef.current.match(
                  /MOOD:\s*(Focus|Hype|Chill|Melancholy|Euphoric|Late Night)/i
                );
                if (m) {
                  moodSeen.current = true;
                  orb.jumpToMood(MOOD_IDS[m[1].toLowerCase()]);
                }
              }
              setReply(
                replyRef.current.replace(
                  /^[\s\S]*?MOOD:\s*[^\n]*\n*/i,
                  ""
                )
              );
            }
          } catch (err) {
            /* partial JSON chunk — keep streaming */
          }
        }
      }
      if (failed) {
        setStatus("error");
      } else {
        setStatus("idle");
        setMoment("");
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setReply(""), 15000);
      }
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <div className="absolute z-30 top-24 md:top-7 left-1/2 -translate-x-1/2 w-[min(92%,540px)]">
      <form
        data-testid="ask-vibe-form"
        onSubmit={submit}
        className="flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-xl pl-4 pr-1.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] focus-within:border-white/35 transition-colors"
      >
        <Sparkles size={14} className="text-[#FBBF24] shrink-0" />
        <input
          data-testid="ask-vibe-input"
          value={moment}
          onChange={(e) => setMoment(e.target.value)}
          placeholder="Describe your moment — the algorithm will place the orb"
          aria-label="Describe your moment and the algorithm will place the orb"
          maxLength={200}
          className="flex-1 min-w-0 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
        />
        <button
          data-testid="ask-vibe-submit"
          type="submit"
          disabled={status === "streaming" || !moment.trim()}
          aria-label="Ask the algorithm"
          className="shrink-0 grid place-items-center h-8 w-8 rounded-full bg-white text-[#0B0B10] disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform"
        >
          <ArrowUp size={15} />
        </button>
      </form>

      <AnimatePresence>
        {(status === "error" || reply.length > 0) && (
          <motion.div
            data-testid="ai-reply"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 mx-auto w-fit max-w-full rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl px-4 py-3 text-center"
          >
            <p className="font-mono text-[9px] tracking-[0.35em] text-white/50 uppercase">
              {status === "error" ? "Signal lost" : "The algorithm says"}
            </p>
            <p className="mt-1 text-[13px] text-white/85 leading-relaxed">
              {status === "error"
                ? "The algorithm is busy — try again in a moment."
                : reply}
              {status === "streaming" && (
                <span className="animate-pulse">▍</span>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
