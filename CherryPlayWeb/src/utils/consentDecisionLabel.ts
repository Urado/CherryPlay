export function formatConsentDecisionLabel(decision: string | undefined | null): string {
  if (decision === 'grant') {
    return 'принято';
  }
  if (decision === 'withdraw') {
    return 'отозвано';
  }
  return 'нет записи';
}
