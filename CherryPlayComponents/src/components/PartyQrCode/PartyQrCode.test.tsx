/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolvePartyQrStyle } from '../../themes';

import { ensureQrContrast } from './ensureQrContrast';
import { PartyQrCode } from './PartyQrCode';

const qrMocks = vi.hoisted(() => ({
  instances: [] as Array<{ options: Record<string, unknown> }>,
  containers: [] as HTMLElement[],
  getRawData: vi.fn<() => Promise<Blob | null>>(),
  download: vi.fn<(options: { name: string; extension: string }) => Promise<void>>(),
}));

vi.mock('qr-code-styling', () => ({
  default: class MockQRCodeStyling {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      qrMocks.instances.push(this);
    }

    append(container: HTMLElement) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      container.append(svg);
      qrMocks.containers.push(container);
    }

    getRawData() {
      return qrMocks.getRawData();
    }

    download(options: { name: string; extension: string }) {
      return qrMocks.download(options);
    }
  },
}));

const baseStyle = {
  foreground: '#263143',
  background: '#fff8fc',
  accent: '#c2006c',
  frame: 'simple',
};

const customBasicSettings = {
  paletteId: 'custom',
  customPalette: {
    accentPrimary: '#c2006c',
    textPrimary: '#610036',
    backgroundPrimary: '#fae8f2',
    trackAreaBackground: '#fff7fb',
    trackBackground: '#fff1f7',
  },
};

const installImage = (loads: boolean) => {
  vi.stubGlobal(
    'Image',
    class MockImage {
      naturalWidth = 180;
      naturalHeight = 120;
      crossOrigin: string | null = null;
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => {
          if (loads) this.onload?.(new Event('load'));
          else this.onerror?.(new Event('error'));
        });
      }
    },
  );
};

const installCanvas = (available = true, failsOnExport = false) => {
  const context = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => (available ? context : null)),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: vi.fn(() => {
      if (failsOnExport) throw new Error('Image export failed.');
      return 'data:image/png;base64,rounded-image';
    }),
  });
  return context;
};

const imageFromOptions = (options: Record<string, unknown>) => {
  const image = String(options.image);
  return decodeURIComponent(image.slice('data:image/svg+xml,'.length));
};

const colorLuminance = (hex: string) => {
  const values = hex.match(/[\da-f]{2}/gi)!.map((channel) => Number.parseInt(channel, 16) / 255);
  const adjusted = values.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return adjusted[0] * 0.2126 + adjusted[1] * 0.7152 + adjusted[2] * 0.0722;
};

const contrastRatio = (first: string, second: string) => {
  const firstLuminance = colorLuminance(first);
  const secondLuminance = colorLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
};

describe('PartyQrCode', () => {
  beforeEach(() => {
    qrMocks.instances.length = 0;
    qrMocks.containers.length = 0;
    qrMocks.getRawData.mockReset().mockResolvedValue(new Blob(['png']));
    qrMocks.download.mockReset().mockResolvedValue(undefined);
    installImage(true);
    installCanvas();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the custom Basic palette and keeps QR foreground and functional markers at high contrast', () => {
    const style = resolvePartyQrStyle('basic', customBasicSettings);
    const colors = ensureQrContrast(style.foreground, style.background);
    const functionalAccent = ensureQrContrast(style.accent, colors.background).foreground;

    expect(style).toMatchObject({
      foreground: '#610036',
      background: '#fae8f2',
      accent: '#c2006c',
    });
    expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(functionalAccent, colors.background)).toBeGreaterThanOrEqual(7);
  });

  it('shows the title status, blocks download until ready and downloads the QR PNG', async () => {
    let resolveRawData: (value: Blob | null) => void = () => undefined;
    qrMocks.getRawData.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRawData = resolve;
      }),
    );

    render(<PartyQrCode value="https://example.test/party/night" title="Spring Night" style={baseStyle} />);
    const qr = screen.getByRole('img', { name: 'QR-код: Spring Night' });
    const button = screen.getByRole('button', { name: 'Скачать PNG' });

    expect(screen.getByRole('status').textContent).toBe('Готовим QR-код для «Spring Night»…');
    expect(qr.getAttribute('aria-busy')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(qrMocks.instances[0].options).toMatchObject({
      data: 'https://example.test/party/night',
      margin: 64,
      qrOptions: { errorCorrectionLevel: 'H' },
      imageOptions: { hideBackgroundDots: true, imageSize: 0.2 },
    });
    expect(imageFromOptions(qrMocks.instances[0].options)).toContain('fill="#fff8fc"');

    act(() => {
      resolveRawData(new Blob(['png']));
    });

    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(qr.getAttribute('aria-busy')).toBe('false');
    fireEvent.click(button);
    await waitFor(() => expect(qrMocks.download).toHaveBeenCalledWith({
      name: 'party-qr-Spring-Night',
      extension: 'png',
    }));
  });

  it('uses rounded Spring dots and the library image mask for the Spring icon', async () => {
    const canvas = installCanvas();
    render(
      <PartyQrCode
        value="https://example.test/party/spring"
        title="Spring Party"
        style={{ ...baseStyle, frame: 'spring' }}
        logoSrc="/images/spring-cross-step-poster.jpg"
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Скачать PNG' }).disabled).toBe(
        false,
      ),
    );

    expect(qrMocks.instances[0].options).toMatchObject({
      dotsOptions: { type: 'extra-rounded' },
      imageOptions: { hideBackgroundDots: true, imageSize: 0.2 },
      image: 'data:image/png;base64,rounded-image',
    });
    expect(canvas.drawImage).toHaveBeenCalled();
  });

  it('falls back to the QR background center when a logo cannot be loaded or processed', async () => {
    installImage(false);
    render(
      <PartyQrCode
        value="https://example.test/party/logo"
        title="Logo Party"
        style={baseStyle}
        logoSrc="https://example.test/logo.png"
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Скачать PNG' }).disabled).toBe(
        false,
      ),
    );

    expect(qrMocks.instances).toHaveLength(1);
    expect(imageFromOptions(qrMocks.instances[0].options)).toContain('fill="#fff8fc"');
  });

  it('falls back to the QR background center when logo processing fails', async () => {
    installCanvas(false);
    render(
      <PartyQrCode
        value="https://example.test/party/logo"
        title="Logo Party"
        style={baseStyle}
        logoSrc="https://example.test/logo.png"
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Скачать PNG' }).disabled).toBe(
        false,
      ),
    );

    expect(qrMocks.instances).toHaveLength(1);
    expect(imageFromOptions(qrMocks.instances[0].options)).toContain('fill="#fff8fc"');
  });

  it('retries QR rendering with a plain background center after a logo render error', async () => {
    qrMocks.getRawData.mockRejectedValueOnce(new Error('Logo render failed.'));
    qrMocks.getRawData.mockResolvedValueOnce(new Blob(['png']));

    render(
      <PartyQrCode
        value="https://example.test/party/logo"
        title="Logo Party"
        style={baseStyle}
        logoSrc="https://example.test/logo.png"
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Скачать PNG' }).disabled).toBe(
        false,
      ),
    );

    expect(qrMocks.instances).toHaveLength(2);
    expect(imageFromOptions(qrMocks.instances[1].options)).toContain('fill="#fff8fc"');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cleans up the generated QR and ignores completion after unmount', async () => {
    let resolveRawData: (value: Blob | null) => void = () => undefined;
    qrMocks.getRawData.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRawData = resolve;
      }),
    );
    const view = render(<PartyQrCode value="https://example.test/party/night" title="Night" style={baseStyle} />);

    await waitFor(() => expect(qrMocks.instances).toHaveLength(1));
    const qrContainer = qrMocks.containers[0];
    view.unmount();
    expect(qrContainer.childElementCount).toBe(0);

    act(() => {
      resolveRawData(new Blob(['png']));
    });

    expect(qrContainer.childElementCount).toBe(0);
  });
});
