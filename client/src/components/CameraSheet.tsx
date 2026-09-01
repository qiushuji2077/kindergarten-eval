import { useEffect, useRef, useState } from 'react';
import { canUseLiveCamera, capturePhotoFromVideo } from '../camera';

type Mode = 'photo' | 'video';

type Props = {
  mode: Mode;
  onFile: (file: File) => void;
  onClose: () => void;
  onFallback: () => void;
};

export function CameraSheet({ mode, onFile, onClose, onFallback }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const onFallbackRef = useRef(onFallback);
  onFallbackRef.current = onFallback;

  useEffect(() => {
    if (!canUseLiveCamera()) {
      onFallbackRef.current();
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        audio: mode === 'video',
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
        setReady(true);
      })
      .catch(() => {
        setError('打不开镜头，改用系统相机');
        window.setTimeout(() => onFallbackRef.current(), 400);
      });
    return () => {
      cancelled = true;
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  const stopStream = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const file = await capturePhotoFromVideo(video);
      stopStream();
      onFile(file);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '拍照失败');
    }
  };

  const toggleRecord = () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : '';
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `video-${Date.now()}.${ext}`, { type });
      stopStream();
      onFile(file);
      onClose();
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  return (
    <div className="cam-mask">
      <video ref={videoRef} className="cam-video" playsInline muted autoPlay />
      <div className="cam-top">
        <button type="button" className="cam-text" onClick={() => { stopStream(); onClose(); }}>
          取消
        </button>
        <span className="cam-title">{mode === 'video' ? '录像' : '拍照'}</span>
        <button type="button" className="cam-text" onClick={() => { stopStream(); onFallback(); }}>
          系统相机
        </button>
      </div>
      {error && <div className="cam-error">{error}</div>}
      <div className="cam-bottom">
        {mode === 'photo' ? (
          <button type="button" className="cam-shutter" disabled={!ready} onClick={takePhoto} aria-label="拍照" />
        ) : (
          <button
            type="button"
            className={`cam-shutter rec ${recording ? 'on' : ''}`}
            disabled={!ready}
            onClick={toggleRecord}
            aria-label={recording ? '停止' : '开始录像'}
          />
        )}
        <p className="cam-hint">{mode === 'video' ? (recording ? '再点一下结束' : '点红点开始录像') : '点圆点拍照'}</p>
      </div>
    </div>
  );
}
