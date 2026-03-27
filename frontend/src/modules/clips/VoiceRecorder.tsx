import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Save, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUploadClip } from '@/hooks/useClips';

interface VoiceRecorderProps {
  workspaceId: string;
  onClose: () => void;
  onSaved: () => void;
}

type RecorderState = 'idle' | 'recording' | 'preview' | 'uploading';

export function VoiceRecorder({ workspaceId, onClose, onSaved }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [amplitude, setAmplitude] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>();

  const uploadMutation = useUploadClip();

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Set up analyser for amplitude visualization
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateAmplitude = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        setAmplitude(avg / 255);
        animFrameRef.current = requestAnimationFrame(updateAmplitude);
      };
      updateAmplitude();

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setRecordedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setState('preview');
        stream.getTracks().forEach((t) => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setAmplitude(0);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      // User denied microphone
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const discard = () => {
    cleanup();
    setRecordedBlob(null);
    setPreviewUrl(null);
    setElapsed(0);
    setState('idle');
    setTitle('');
  };

  const save = () => {
    if (!recordedBlob) return;
    setState('uploading');
    const fd = new FormData();
    const ext = recordedBlob.type.includes('webm') ? '.webm' : '.ogg';
    fd.append('file', recordedBlob, `voice-clip${ext}`);
    fd.append('metadata', JSON.stringify({
      title: title || `Voice Clip ${new Date().toLocaleString()}`,
      type: 'VOICE_CLIP',
      duration: elapsed,
      workspaceId,
    }));

    uploadMutation.mutate(fd, {
      onSuccess: () => {
        discard();
        onSaved();
      },
      onError: () => setState('preview'),
    });
  };

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timerStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md mx-4 bg-bg-primary rounded-xl border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-medium text-text-primary">Voice Clip</h2>
            {state === 'recording' && (
              <span className="flex items-center gap-1.5 ml-2 text-red-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {timerStr}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded-lg transition-colors">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {state === 'idle' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Mic className="w-16 h-16 text-text-tertiary" />
              <p className="text-sm text-text-secondary">Click below to start recording audio</p>
              <button
                onClick={startRecording}
                className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Start Recording
              </button>
            </div>
          )}

          {state === 'recording' && (
            <div className="flex flex-col items-center gap-4 py-6">
              {/* Amplitude indicator */}
              <div
                className="w-24 h-24 rounded-full border-4 border-purple-500/30 flex items-center justify-center transition-transform"
                style={{ transform: `scale(${1 + amplitude * 0.3})` }}
              >
                <div
                  className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center"
                  style={{ transform: `scale(${1 + amplitude * 0.5})` }}
                >
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                </div>
              </div>
              <p className="text-sm text-text-secondary">Listening...</p>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Square className="w-4 h-4" fill="currentColor" />
                Stop
              </button>
            </div>
          )}

          {(state === 'preview' || state === 'uploading') && previewUrl && (
            <div className="flex flex-col gap-4">
              <audio src={previewUrl} controls className="w-full" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this voice clip..."
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-purple-400"
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={discard}
                  disabled={state === 'uploading'}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={save}
                  disabled={state === 'uploading'}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors',
                    state === 'uploading' && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {state === 'uploading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
