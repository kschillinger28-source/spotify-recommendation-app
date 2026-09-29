import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { FLOW_INJECTION_POLL_MS } from "../lib/config";

export function useFlowInjection() {
  const [pending, setPending] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const cancelTokenRef = useRef(0);

  const cancel = useCallback((message = "") => {
    cancelTokenRef.current += 1;
    setPending(null);
    setStatusMessage(message);
  }, []);

  const arm = useCallback(async ({ sourceTrackUri, targetTrackUri, targetTrackName, positionMs, deviceId, bpmMatchPercent }) => {
    await api.queueTrack({ trackUri: targetTrackUri, deviceId });

    const myToken = ++cancelTokenRef.current;
    setPending({ sourceTrackUri, targetTrackUri, targetTrackName, positionMs, deviceId });
    setStatusMessage(`Flow boost · ${Math.round(bpmMatchPercent)}% BPM match`);

    const poll = async () => {
      if (cancelTokenRef.current !== myToken) {
        return;
      }
      try {
        const snapshot = await api.getCurrentPlayback();
        const currentUri = snapshot?.playback?.item?.uri;
        if (currentUri === targetTrackUri) {
          setPending(null);
          setStatusMessage(`Now playing "${targetTrackName ?? "the next track"}" — flow transition complete.`);
          return;
        }
        if (currentUri && currentUri !== sourceTrackUri) {
          cancel("Flow injection canceled — playback moved to a different track.");
          return;
        }
      } catch {
        // Keep polling; a single failed check shouldn't cancel the watcher.
      }
      setTimeout(poll, FLOW_INJECTION_POLL_MS);
    };

    setTimeout(poll, FLOW_INJECTION_POLL_MS);
  }, [cancel]);

  useEffect(() => () => {
    cancelTokenRef.current += 1;
  }, []);

  return { pending, statusMessage, arm, cancel };
}
