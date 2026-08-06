export async function copyTextToClipboard(text: string): Promise<void> {
  const clipboardApi = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (clipboardApi?.writeText) {
    const wrote = await clipboardApi.writeText(text).then(
      () => true,
      () => false,
    );
    if (wrote) {
      return;
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }

  if (!copied) {
    throw new Error('Clipboard is unavailable');
  }
}
