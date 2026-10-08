import { afterEach, describe, expect, it } from 'vitest';

import { ensureQrContrast } from '../components/PartyQrCode/ensureQrContrast';

import { resolvePartyQrImage } from '.';

describe('party QR theme configuration', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('keeps a theme asset in the theme descriptor and prioritizes an uploaded logo', () => {
    expect(resolvePartyQrImage('spring-cross-step')).toBe('/images/spring-cross-step-poster.jpg');
    expect(resolvePartyQrImage('spring-cross-step', { qrLogoUrl: ' https://example.test/logo.png ' }))
      .toBe('https://example.test/logo.png');
    expect(resolvePartyQrImage('basic')).toBeUndefined();
  });

  it('uses a black and white pair when neither corrected foreground can reach 7:1 contrast', () => {
    const colors = ensureQrContrast('#000000', '#777777');

    expect(colors).toEqual({ foreground: '#000000', background: '#ffffff' });
  });

  it('generates SVG QR content with the real styling library', async () => {
    const QRCodeStyling = (await import('qr-code-styling')).default;
    const container = document.createElement('div');
    document.body.append(container);
    const qr = new QRCodeStyling({
      width: 320,
      height: 320,
      margin: 64,
      data: 'https://example.test/party/night-2026',
      qrOptions: { errorCorrectionLevel: 'H' },
      dotsOptions: { color: '#000000' },
      backgroundOptions: { color: '#ffffff' },
    });

    qr.append(container);
    const image = await qr.getRawData('svg');
    const svg = image
      ? await new Promise<string>((resolve, reject: (reason: Error) => void) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => reject(reader.error ?? new Error('Unable to read generated SVG.'));
          reader.readAsText(image);
        })
      : '';

    expect(svg).toContain('<svg');
    expect(svg).toContain('<rect');
    expect(svg).toContain('320');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain('<image');
  });
});
