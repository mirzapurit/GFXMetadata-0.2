/**
 * Video Handler Service for GFX Metadata
 * Extracts keyframes, thumbnails, duration, resolution, and metadata from video files
 * locally in the browser with zero backend dependencies.
 */

export const isVideoFile = (file) => {
  if (!file) return false;
  if (file.type && file.type.startsWith('video/')) return true;
  const ext = (file.name || '').split('.').pop().toLowerCase();
  return ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv', 'wmv', 'flv'].includes(ext);
};

export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const s = Math.round(seconds);
  const mins = Math.floor(s / 60);
  const remSecs = s % 60;
  return `${mins}:${remSecs < 10 ? '0' : ''}${remSecs}`;
};

export const getResolutionLabel = (width, height) => {
  if (!width || !height) return '';
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);
  if (maxDim >= 3800 || minDim >= 2100) return '4K UHD';
  if (maxDim >= 2500 || minDim >= 1400) return '2K QHD';
  if (maxDim >= 1900 || minDim >= 1080) return '1080p FHD';
  if (maxDim >= 1200 || minDim >= 720) return '720p HD';
  return `${width}x${height}`;
};

export const extractVideoMetadataAndFrame = (file) => {
  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Video processing timed out'));
    }, 15000);

    video.onloadedmetadata = () => {
      const duration = video.duration || 0;

      // Pick seek point: around 25% of the video or 1.0 second, avoiding 0.0s (which is often black)
      let seekTime = 1.0;
      if (isFinite(duration) && duration > 0) {
        seekTime = Math.min(Math.max(duration * 0.25, 0.5), Math.max(0.1, duration - 0.2));
      }

      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      cleanup();
      try {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 360;

        const canvas = document.createElement('canvas');
        // Scale down if massive for fast vision processing (max 1280px wide)
        const maxDimension = 1280;
        let targetWidth = width;
        let targetHeight = height;
        if (targetWidth > maxDimension || targetHeight > maxDimension) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
            targetWidth = maxDimension;
          } else {
            targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
            targetHeight = maxDimension;
          }
        }

        canvas.width = targetWidth || 640;
        canvas.height = targetHeight || 360;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const previewDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        resolve({
          success: true,
          previewUrl: previewDataUrl,
          previewDataUrl: previewDataUrl,
          videoUrl: videoUrl,
          duration: video.duration,
          formattedDuration: formatDuration(video.duration),
          width: width,
          height: height,
          resolutionLabel: getResolutionLabel(width, height),
          aspectRatio: width && height ? (width / height).toFixed(2) : '1.78'
        });
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to decode video file in browser'));
    };

    video.src = videoUrl;
  });
};
