import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type GuideHit } from '../api';
import { canUseLiveCamera, canUseLiveVideo } from '../camera';
import { CameraSheet } from '../components/CameraSheet';
import { useApp } from '../state';

type LocalMedia = {
  id: string;
  file: File;
  kind: 'photo' | 'video' | 'audio';
  url: string;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function clockLabel(d = new Date()) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function ComposePage() {
  const { session, children, framework } = useApp();
  const navigate = useNavigate();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState<null | 'photo' | 'video'>(null);
  const [childIds, setChildIds] = useState<string[]>([]);
  const [narrative, setNarrative] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [clock, setClock] = useState(clockLabel);
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [recording, setRecording] = useState(false);
  const [listening, setListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainId, setDomainId] = useState(framework[0]?.id || '');
  const [guideHits, setGuideHits] = useState<GuideHit[]>([]);
  const [ageBand, setAgeBand] = useState('4-5岁');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const classChildren = useMemo(
    () => children.filter((c) => c.class_id === session?.classId),
    [children, session],
  );
  const currentDomain = framework.find((d) => d.id === domainId) || framework[0];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const text = narrative.trim();
      if (!text || !session) {
        setGuideHits([]);
        return;
      }
      api
        .matchGuide({
          text,
          classId: session.classId,
          childIds,
          observedAt: isoLocal(),
        })
        .then((r) => {
          setAgeBand(r.ageBand);
          setGuideHits(r.hits);
        })
        .catch(() => {});
    }, 400);
    return () => window.clearTimeout(timer);
  }, [narrative, childIds, session]);

  useEffect(() => {
    const tick = window.setInterval(() => setClock(clockLabel()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    return () => {
      media.forEach((m) => URL.revokeObjectURL(m.url));
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: FileList | null, forceKind?: LocalMedia['kind']) => {
    if (!files?.length) return;
    const next: LocalMedia[] = [];
    Array.from(files).forEach((file) => {
      let kind: LocalMedia['kind'] = forceKind || 'photo';
      if (!forceKind) {
        if (file.type.startsWith('video/')) kind = 'video';
        else if (file.type.startsWith('audio/')) kind = 'audio';
        else kind = 'photo';
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        kind,
        url: URL.createObjectURL(file),
      });
    });
    setMedia((prev) => [...prev, ...next].slice(0, 9));
  };

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((m) => m.id !== id);
    });
  };

  const toggleChild = (id: string) => {
    setChildIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleStage = (id: string) => {
    setStageIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const startVoiceRecord = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        setMedia((prev) => [
          ...prev,
          { id: `audio-${Date.now()}`, file, kind: 'audio', url: URL.createObjectURL(file) },
        ]);
        setRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('无法使用麦克风');
    }
  };

  const toggleSpeechToText = () => {
    const SR =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;
    if (!SR) {
      setError('当前浏览器不支持语音转文字，可先录音再补文字');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = '';
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setVoiceTranscript(text);
      setNarrative(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const openCapture = (mode: 'photo' | 'video') => {
    const live = mode === 'video' ? canUseLiveVideo() : canUseLiveCamera();
    if (live) {
      setCam(mode);
      return;
    }
    (mode === 'photo' ? photoRef : videoRef).current?.click();
  };

  const addOneFile = (file: File, kind?: LocalMedia['kind']) => {
    const dt = new DataTransfer();
    dt.items.add(file);
    addFiles(dt.files, kind);
  };

  const canPost =
    childIds.length > 0 &&
    (narrative.trim() || voiceTranscript.trim() || media.length > 0) &&
    !submitting;

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!session || !canPost) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('teacherId', session.teacherId);
      form.append('classId', session.classId);
      form.append('recordType', 'COA记录');
      form.append('observedAt', isoLocal());
      form.append('narrative', narrative.trim());
      form.append('voiceTranscript', voiceTranscript.trim());
      form.append('childIds', JSON.stringify(childIds));
      form.append('stageIds', JSON.stringify(stageIds));
      media.forEach((m) => form.append('media', m.file, m.file.name));
      await api.createObservation(form);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="compose-page">
      <header className="ios-header solid">
        <div className="ios-nav">
          <button type="button" className="link" onClick={() => navigate(-1)}>
            取消
          </button>
          <div className="center">新观察</div>
          <button type="button" className="link strong" disabled={!canPost} onClick={() => onSubmit()}>
            {submitting ? '发布中' : '发表'}
          </button>
        </div>
      </header>

      <form className="compose-body" onSubmit={onSubmit}>
        <textarea
          className="compose-text"
          placeholder="孩子在做什么、说了什么"
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
        />

        <div className="tool-row five">
          <button type="button" className="tool" onClick={() => openCapture('photo')}>
            拍照
          </button>
          <button type="button" className="tool" onClick={() => openCapture('video')}>
            录像
          </button>
          <button type="button" className="tool" onClick={() => albumRef.current?.click()}>
            相册
          </button>
          <button
            type="button"
            className={`tool ${recording ? 'on' : ''}`}
            onClick={recording ? () => mediaRecorderRef.current?.stop() : startVoiceRecord}
          >
            {recording ? '停止' : '录音'}
          </button>
          <button type="button" className={`tool ${listening ? 'on' : ''}`} onClick={toggleSpeechToText}>
            {listening ? '听写中' : '说话'}
          </button>
        </div>
        {(recording || listening) && (
          <div className="recording">{recording ? '正在录音' : '正在转成文字'}</div>
        )}
        <p className="hint cam-note">
          {canUseLiveCamera()
            ? '拍照用本机镜头。录像在 iPhone 上会打开系统相机。微信里只能走系统相机，调不了小程序拍摄接口。'
            : '当前在微信里或未用 https，拍照录像会打开系统相机，不是小程序接口。'}
        </p>

        <input
          ref={photoRef}
          className="hidden-file"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            addFiles(e.target.files, 'photo');
            e.target.value = '';
          }}
        />
        <input
          ref={videoRef}
          className="hidden-file"
          type="file"
          accept="video/*"
          capture="environment"
          onChange={(e) => {
            addFiles(e.target.files, 'video');
            e.target.value = '';
          }}
        />
        <input
          ref={albumRef}
          className="hidden-file"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {media.length > 0 && (
          <div className="preview-strip">
            {media.map((m) => (
              <div className="preview-item" key={m.id}>
                {m.kind === 'photo' && <img src={m.url} alt="" />}
                {m.kind === 'video' && <video src={m.url} muted />}
                {m.kind === 'audio' && (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#8e8e93' }}>
                    声
                  </div>
                )}
                <button type="button" className="rm" onClick={() => removeMedia(m.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="cell-group">
          <div className="section-label">观察对象</div>
          <div className="kids-wrap" style={{ padding: '0 16px' }}>
            {classChildren.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`kid ${childIds.includes(c.id) ? 'on' : ''}`}
                onClick={() => toggleChild(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="cell-group">
          <div className="section-label">时间</div>
          <div className="group">
            <div className="cell">
              <span className="name">观察时间</span>
              <span className="value">{clock}</span>
            </div>
          </div>
        </div>

        <div className="cell-group">
          <div className="section-label">
            指南自动对应{ageBand ? ` · ${ageBand}` : ''}
          </div>
          {guideHits.length === 0 ? (
            <p className="hint">写实录后，出现相关字词会自动对应《3—6岁儿童学习与发展指南》。</p>
          ) : (
            <div className="group">
              {guideHits.map((g) => (
                <div className="cell" key={g.id}>
                  <div className="left">
                    <span className="name">
                      {g.domain} · {g.goal}
                    </span>
                    <span className="sub">
                      {g.area} · 捕捉：{g.keywords.join('、')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cell-group">
          <div className="section-label">发展状态（可选）</div>
          <div className="kids-wrap" style={{ padding: '0 16px 8px' }}>
            {framework.map((d) => (
              <button
                type="button"
                key={d.id}
                className={`kid ${currentDomain?.id === d.id ? 'on' : ''}`}
                onClick={() => setDomainId(d.id)}
              >
                {d.name.replace('领域', '')}
              </button>
            ))}
          </div>
          {currentDomain?.indicators.map((ind) => (
            <div key={ind.id}>
              <div className="hint">{ind.name}</div>
              <div className="stage-grid">
                {ind.stages.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`stage ${stageIds.includes(s.id) ? 'on' : ''}`}
                    onClick={() => toggleStage(s.id)}
                    title={s.description}
                  >
                    阶段{s.level}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="error-banner">{error}</div>}
      </form>
      {cam && (
        <CameraSheet
          mode={cam}
          onFile={(file) => addOneFile(file, cam === 'video' ? 'video' : 'photo')}
          onClose={() => setCam(null)}
          onFallback={() => {
            const mode = cam;
            setCam(null);
            window.setTimeout(() => (mode === 'photo' ? photoRef : videoRef).current?.click(), 50);
          }}
        />
      )}
    </div>
  );
}
