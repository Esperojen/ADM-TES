/**
 * Utility to process scanned signatures, stamps, and logos to remove white/light background
 * and output high quality transparent PNG.
 */

export interface TransparencyOptions {
  threshold?: number; // 150 - 250 (default 205)
  tolerance?: number; // 10 - 50 (default 35)
  boostInk?: boolean; // Slightly enhance contrast of ink/stamp
}

export async function removeWhiteBackground(
  dataUrl: string,
  options: TransparencyOptions = {}
): Promise<string> {
  const { threshold = 210, tolerance = 35, boostInk = true } = options;

  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        const lowThresh = Math.max(0, threshold - tolerance);
        const highThresh = Math.min(255, threshold + 15);

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a === 0) continue;

          // Calculate luminance
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const minChannel = Math.min(r, g, b);

          // Paper detection: all channels are relatively high and luminance is high
          if (minChannel > lowThresh && lum > lowThresh) {
            if (lum >= highThresh) {
              data[i + 3] = 0; // 100% transparent
            } else {
              // Smooth gradient alpha falloff for anti-aliasing
              const alphaFactor = 1 - (lum - lowThresh) / (highThresh - lowThresh);
              data[i + 3] = Math.max(0, Math.min(255, Math.round(a * alphaFactor)));
            }
          } else if (boostInk && data[i + 3] > 100) {
            // Enhance ink clarity (deepen ink slightly without color distortion)
            data[i] = Math.max(0, Math.round(r * 0.95));
            data[i + 1] = Math.max(0, Math.round(g * 0.95));
            data[i + 2] = Math.max(0, Math.round(b * 0.95));
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Error processing transparency:', err);
        resolve(dataUrl);
      }
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
