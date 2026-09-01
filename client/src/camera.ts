export function isWeChat() {
  return /MicroMessenger/i.test(navigator.userAgent);
}

export function isIOS() {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function canUseLiveCamera() {
  if (isWeChat()) return false;
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

export function canUseLiveVideo() {
  if (!canUseLiveCamera()) return false;
  if (isIOS()) return false;
  return typeof MediaRecorder !== 'undefined';
}

export async function capturePhotoFromVideo(video: HTMLVideoElement) {
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法取景');
  ctx.drawImage(video, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('拍照失败'))),
      'image/jpeg',
      0.86,
    );
  });
  return new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
}
