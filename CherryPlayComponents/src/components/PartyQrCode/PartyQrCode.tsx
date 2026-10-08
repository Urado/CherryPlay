import QRCodeStyling, { type DotType } from 'qr-code-styling';
import { useEffect, useRef, useState } from 'react';

import type { PartyQrStyle } from '../../themes';

import { ensureQrContrast } from './ensureQrContrast';

const createEmptyCenterImage = (background: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${background}"/></svg>`,
  )}`;

const createRoundedImage = (source: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('Logo image has no dimensions.'));
        return;
      }

      const size = 256;
      const radius = size * 0.18;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('Canvas is unavailable.'));
        return;
      }

      try {
        context.beginPath();
        context.moveTo(radius, 0);
        context.arcTo(size, 0, size, size, radius);
        context.arcTo(size, size, 0, size, radius);
        context.arcTo(0, size, 0, 0, radius);
        context.arcTo(0, 0, size, 0, radius);
        context.closePath();
        context.clip();

        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - sourceSize) / 2;
        const sourceY = (image.naturalHeight - sourceSize) / 2;
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        reject(new Error('Logo image could not be processed.'));
      }
    };
    image.onerror = () => reject(new Error('Logo image could not be loaded.'));
    image.src = source;
  });

const DOT_TYPE_BY_FRAME: Record<string, DotType> = {
  neon: 'classy-rounded',
  petal: 'dots',
  deco: 'classy',
  simple: 'rounded',
  spring: 'extra-rounded',
};

export interface PartyQrCodeProps {
  value: string;
  title: string;
  style: PartyQrStyle;
  logoSrc?: string;
}

export const PartyQrCode = ({ value, title, style, logoSrc }: PartyQrCodeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrCodeRef = useRef<QRCodeStyling | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colors = ensureQrContrast(style.foreground, style.background);
  const functionalAccent = ensureQrContrast(style.accent, colors.background).foreground;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setReady(false);
    setError(null);
    container.replaceChildren();

    let qrCode: QRCodeStyling | null = null;
    const renderQr = async (image: string) => {
      if (cancelled) return false;
      container.replaceChildren();
      const instance = new QRCodeStyling({
        width: 640,
        height: 640,
        margin: 64,
        data: value,
        image,
        qrOptions: { errorCorrectionLevel: 'H' },
        imageOptions: {
          hideBackgroundDots: true,
          imageSize: 0.2,
          crossOrigin: 'anonymous',
        },
        dotsOptions: {
          type: DOT_TYPE_BY_FRAME[style.frame] ?? 'rounded',
          color: colors.foreground,
        },
        cornersSquareOptions: { type: 'extra-rounded', color: functionalAccent },
        cornersDotOptions: { type: 'dot', color: functionalAccent },
        backgroundOptions: { color: colors.background },
      });

      qrCode = instance;
      qrCodeRef.current = instance;
      instance.append(container);
      if (cancelled) return false;
      if (!(await instance.getRawData('png'))) throw new Error('QR image is empty.');
      if (cancelled) return false;
      return true;
    };

    const createQrCode = async () => {
      let image = createEmptyCenterImage(colors.background);

      try {
        image = logoSrc ? await createRoundedImage(logoSrc) : image;
        if (cancelled) return;
        if (await renderQr(image) && !cancelled) setReady(true);
      } catch {
        if (cancelled) return;

        try {
          if (await renderQr(createEmptyCenterImage(colors.background)) && !cancelled) setReady(true);
          else if (!cancelled) setError('Не удалось создать QR-код.');
        } catch {
          if (!cancelled) setError('Не удалось создать QR-код.');
        }
      }
    };

    void createQrCode();

    return () => {
      cancelled = true;
      container.replaceChildren();
      if (qrCodeRef.current === qrCode) qrCodeRef.current = null;
    };
  }, [value, logoSrc, style.frame, style.accent, functionalAccent, colors.foreground, colors.background]);

  const handleDownload = async () => {
    const qrCode = qrCodeRef.current;
    if (!qrCode || !ready) return;

    try {
      await qrCode.download({ name: getFileName(title), extension: 'png' });
    } catch {
      setError('Не удалось скачать QR-код.');
    }
  };

  return (
    <div className="party-qr-code" data-qr-frame={style.frame}>
      <div
        className="party-qr-code-card"
        style={{ backgroundColor: colors.background, borderColor: style.accent }}
      >
        <h1 className="party-qr-code-title" style={{ color: colors.foreground }}>
          {title}
        </h1>
        <div className="party-qr-code-preview" style={{ backgroundColor: colors.background }}>
          <div
            ref={containerRef}
            className="party-qr-code-canvas"
            aria-label={`QR-код: ${title}`}
            aria-busy={!ready && !error}
            role="img"
          />
          {!ready && !error && (
            <div className="party-qr-code-loading" role="status">
              <span className="party-qr-code-spinner" aria-hidden="true" />
              <span>Готовим QR-код для «{title}»…</span>
            </div>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
      <button
        type="button"
        className="party-qr-code-download"
        onClick={() => void handleDownload()}
        disabled={!ready}
        style={{ backgroundColor: style.accent, color: ensureQrContrast(colors.foreground, style.accent).foreground }}
      >
        Скачать PNG
      </button>
    </div>
  );
};

const getFileName = (title: string) =>
  `party-qr-${title.trim().replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '').slice(0, 48) || 'code'}`;
