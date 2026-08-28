import { useCallback, useState } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  RecordingPresets,
} from 'expo-audio';

/**
 * Real microphone recording built on `expo-audio` (native iOS/Android AND web via
 * MediaRecorder). Previously the prototype simulated a recording with a timer —
 * this produces an actual audio file whose local URI is ready for upload.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [permission, setPermission] = useState<string>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [readyUri, setReadyUri] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      setError(null);
      const perm = await requestRecordingPermissionsAsync();
      setPermission(perm.status);
      if (!perm.granted) {
        setError('Microphone permission is required to record a voice note.');
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setError('Could not start the recording.');
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    try {
      if (state.isRecording) {
        await recorder.stop();
      }
      setReadyUri(recorder.uri ?? state.url ?? null);
    } catch {
      setError('Could not finish the recording.');
    }
  }, [recorder, state.isRecording, state.url]);

  const cancel = useCallback(async () => {
    try {
      if (state.isRecording) {
        await recorder.stop();
      }
    } catch {
      // Best-effort: the recording is being discarded anyway.
    }
    setReadyUri(null);
    setError(null);
  }, [recorder, state.isRecording]);

  const clearRecording = useCallback(() => setReadyUri(null), []);

  return {
    isRecording: state.isRecording,
    durationMs: state.durationMillis,
    uri: readyUri,
    error,
    permission,
    start,
    stop,
    cancel,
    clearRecording,
  };
}