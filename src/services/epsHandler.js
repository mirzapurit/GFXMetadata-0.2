import UTIF from 'utif';

/**
 * Checks if a file is an EPS file by extension or MIME type.
 * @param {File} file 
 * @returns {boolean}
 */
export function isEpsFile(file) {
  if (!file) return false;
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return (
    name.endsWith('.eps') ||
    type === 'application/postscript' ||
    type === 'image/x-eps' ||
    type === 'image/eps' ||
    type === 'application/eps'
  );
}

/**
 * Helper to get clean base name without extension
 * @param {string} filename 
 * @returns {string}
 */
export function getBaseFileName(filename) {
  if (!filename) return '';
  return filename.substring(0, filename.lastIndexOf('.')) || filename;
}

/**
 * Normalizes a base file name by stripping artboard export suffixes (e.g. -01, _01, 01, -1, @2x)
 * so that 'Tiny and Mighty.eps' matches 'Tiny and Mighty-01.png' or 'Tiny and Mighty.jpg'
 * @param {string} filename 
 * @returns {string}
 */
export function normalizeBaseFileName(filename) {
  if (!filename) return '';
  const base = filename.substring(0, filename.lastIndexOf('.')) || filename;
  return base
    .toLowerCase()
    .replace(/(@\d+x|[-_ ]0*[1-9]\d*)$/i, '')
    .trim();
}

/**
 * Helper to test if a slice of bytes is a valid JPEG
 * @param {Uint8Array} bytes 
 * @returns {Promise<string|null>} DataURL or null
 */
async function validateJpegBytes(bytes) {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } else {
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Decodes a TIFF preview buffer from EPS, correctly handling Adobe Illustrator's
 * Palette Color + Alpha format (SamplesPerPixel = 2) with auto-contrast background.
 */
function decodeTiffPreview(tiffBuffer, ifd) {
  const width = ifd.width || (ifd.t256 && ifd.t256[0]);
  const height = ifd.height || (ifd.t257 && ifd.t257[0]);
  if (!width || !height || width <= 0 || height <= 0) return null;

  const intp = ifd['t262'] ? ifd['t262'][0] : 2; // 3 = Palette color
  const spp = ifd['t277'] ? ifd['t277'][0] : 1;
  const cmpr = ifd['t259'] ? ifd['t259'][0] : 1;
  const map = ifd['t320'];
  const stripOffsets = ifd['t273'] || ifd['t324'];
  const stripByteCounts = ifd['t279'] || ifd['t325'];

  // Case 1: Palette color with uncompressed strips (Standard Adobe Illustrator EPS preview format)
  // Illustrator uses spp = 2 (byte 0: palette index, byte 1: alpha channel)
  if (intp === 3 && cmpr === 1 && map && stripOffsets && stripOffsets.length > 0) {
    const offset = stripOffsets[0];
    const byteCount = stripByteCounts ? stripByteCounts[0] : (width * height * spp);
    const raw = new Uint8Array(tiffBuffer, offset, Math.min(byteCount, tiffBuffer.byteLength - offset));

    // First pass: analyze average luminance of non-transparent foreground pixels
    let totalLum = 0;
    let fgCount = 0;
    const numPixels = width * height;

    for (let i = 0; i < numPixels && (i * spp) < raw.length; i++) {
      const alpha = spp > 1 ? raw[i * spp + 1] : 255;
      if (alpha > 20) {
        const mi = raw[i * spp];
        const r = map[mi] >> 8;
        const g = map[256 + mi] >> 8;
        const b = map[512 + mi] >> 8;
        totalLum += (0.299 * r + 0.587 * g + 0.114 * b);
        fgCount++;
      }
    }

    // Dynamic contrast background:
    // If foreground artwork is light (pink, white, yellow text), use dark background (#18181b)
    // If foreground artwork is dark (black text), use light background (#ffffff)
    const avgLum = fgCount > 0 ? (totalLum / fgCount) : 128;
    const bgR = avgLum > 128 ? 24 : 255;
    const bgG = avgLum > 128 ? 24 : 255;
    const bgB = avgLum > 128 ? 27 : 255;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    const rgba = imgData.data;

    for (let i = 0; i < numPixels && (i * spp) < raw.length; i++) {
      const mi = raw[i * spp];
      const alpha = spp > 1 ? raw[i * spp + 1] : 255;
      const qi = i * 4;

      if (alpha === 0) {
        rgba[qi] = bgR;
        rgba[qi + 1] = bgG;
        rgba[qi + 2] = bgB;
        rgba[qi + 3] = 255;
      } else if (alpha === 255) {
        rgba[qi] = map[mi] >> 8;
        rgba[qi + 1] = map[256 + mi] >> 8;
        rgba[qi + 2] = map[512 + mi] >> 8;
        rgba[qi + 3] = 255;
      } else {
        const fgR = map[mi] >> 8;
        const fgG = map[256 + mi] >> 8;
        const fgB = map[512 + mi] >> 8;
        const a = alpha / 255;
        rgba[qi] = Math.round(fgR * a + bgR * (1 - a));
        rgba[qi + 1] = Math.round(fgG * a + bgG * (1 - a));
        rgba[qi + 2] = Math.round(fgB * a + bgB * (1 - a));
        rgba[qi + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  }

  // Case 2: Standard TIFF fallback using UTIF
  try {
    UTIF.decodeImage(tiffBuffer, ifd);
    const rgba = UTIF.toRGBA8(ifd);
    if (rgba && rgba.length > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.createImageData(width, height);
      imgData.data.set(rgba);
      ctx.putImageData(imgData, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.95);
    }
  } catch (err) {
    console.warn('UTIF.decodeImage fallback failed:', err);
  }

  return null;
}

/**
 * Extract preview from an EPS file (Binary DOS EPS header with TIFF, or embedded JPEG/raster)
 * @param {File|Blob} file 
 * @returns {Promise<{ success: boolean, dataUrl?: string, error?: string }>}
 */
export async function extractEpsPreview(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const dataView = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);

    // 1. Check for DOS EPS Binary Header: Magic 0xC5D0D3C6 or 0xC5D2D3C6
    // Bytes 0-3: 0xC5, 0xD0 (or 0xD2), 0xD3, 0xC6
    if (bytes.length >= 30 && bytes[0] === 0xC5 && (bytes[1] === 0xD0 || bytes[1] === 0xD2) && bytes[2] === 0xD3 && bytes[3] === 0xC6) {
      const tiffOffset = dataView.getUint32(20, true);
      const tiffLength = dataView.getUint32(24, true);

      if (tiffOffset > 0 && tiffLength > 0 && tiffOffset + tiffLength <= arrayBuffer.byteLength) {
        const previewSlice = bytes.subarray(tiffOffset, tiffOffset + tiffLength);

        // Check if the preview section is directly JPEG
        if (previewSlice.length > 4 && previewSlice[0] === 0xFF && previewSlice[1] === 0xD8) {
          const jpegDataUrl = await validateJpegBytes(previewSlice);
          if (jpegDataUrl) {
            return { success: true, dataUrl: jpegDataUrl };
          }
        }

        // Decode as TIFF
        try {
          const tiffBuffer = previewSlice.buffer.slice(
            previewSlice.byteOffset,
            previewSlice.byteOffset + previewSlice.byteLength
          );
          const ifds = UTIF.decode(tiffBuffer);
          if (ifds && ifds.length > 0) {
            const dataUrl = decodeTiffPreview(tiffBuffer, ifds[0]);
            if (dataUrl) {
              return { success: true, dataUrl };
            }
          }
        } catch (tiffErr) {
          console.warn('TIFF decode from EPS header failed, falling back to embedded scan:', tiffErr);
        }
      }
    }

    // 2. Scan entire buffer for embedded JPEG (0xFF, 0xD8, 0xFF)
    for (let i = 0; i < bytes.length - 4; i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
        let eoiIndex = -1;
        for (let j = i + 3; j < Math.min(bytes.length - 1, i + 5000000); j++) {
          if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
            eoiIndex = j + 2;
            break;
          }
        }

        if (eoiIndex > i + 100) {
          const candidateSlice = bytes.subarray(i, eoiIndex);
          const jpegDataUrl = await validateJpegBytes(candidateSlice);
          if (jpegDataUrl) {
            return { success: true, dataUrl: jpegDataUrl };
          }
          i = eoiIndex;
        }
      }
    }

    // 3. Scan for PostScript ASCII preview: %BeginPreview: width height depth lines
    const textPreview = await extractAsciiPreview(bytes);
    if (textPreview) {
      return { success: true, dataUrl: textPreview };
    }

    return {
      success: false,
      error: 'NO_PREVIEW',
      message: 'No embedded preview found in this EPS file.'
    };
  } catch (err) {
    console.error('Failed to parse EPS file:', err);
    return {
      success: false,
      error: err.message || 'Failed to process EPS file.'
    };
  }
}

/**
 * Fallback parser for PostScript %BeginPreview: ascii hex lines
 */
async function extractAsciiPreview(bytes) {
  try {
    const headerSlice = bytes.subarray(0, Math.min(bytes.length, 65536));
    const headerText = new TextDecoder('latin1').decode(headerSlice);
    const match = headerText.match(/%BeginPreview:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
    if (!match) return null;

    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    const depth = parseInt(match[3], 10);

    if (width <= 0 || height <= 0) return null;

    const previewIndex = headerText.indexOf(match[0]);
    if (previewIndex === -1) return null;

    const dataStart = previewIndex + match[0].length;
    const endMatch = headerText.substring(dataStart).match(/%EndPreview/i);
    if (!endMatch) return null;

    const hexContent = headerText
      .substring(dataStart, dataStart + endMatch.index)
      .replace(/[^0-9a-fA-F]/g, '');

    if (hexContent.length === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);

    if (depth === 1) {
      let hexIdx = 0;
      let pixelIdx = 0;
      const bytesPerLine = Math.ceil(width / 8);
      for (let y = 0; y < height && hexIdx < hexContent.length; y++) {
        for (let b = 0; b < bytesPerLine && hexIdx + 1 < hexContent.length; b++) {
          const byteVal = parseInt(hexContent.substr(hexIdx, 2), 16);
          hexIdx += 2;
          for (let bit = 7; bit >= 0; bit--) {
            const x = b * 8 + (7 - bit);
            if (x < width) {
              const isWhite = (byteVal & (1 << bit)) === 0;
              const color = isWhite ? 255 : 0;
              imgData.data[pixelIdx] = color;
              imgData.data[pixelIdx + 1] = color;
              imgData.data[pixelIdx + 2] = color;
              imgData.data[pixelIdx + 3] = 255;
              pixelIdx += 4;
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.95);
    } else if (depth === 8) {
      let hexIdx = 0;
      let pixelIdx = 0;
      for (let i = 0; i < width * height && hexIdx + 1 < hexContent.length; i++) {
        const val = 255 - parseInt(hexContent.substr(hexIdx, 2), 16);
        hexIdx += 2;
        imgData.data[pixelIdx] = val;
        imgData.data[pixelIdx + 1] = val;
        imgData.data[pixelIdx + 2] = val;
        imgData.data[pixelIdx + 3] = 255;
        pixelIdx += 4;
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.95);
    }
    return null;
  } catch {
    return null;
  }
}
