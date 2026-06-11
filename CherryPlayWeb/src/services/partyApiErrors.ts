import type { PartyLifecycleState } from '../types/api';

export class ThemeNotEntitledError extends Error {
  readonly code = 'theme_not_entitled' as const;
  readonly themeId?: string;
  readonly requiredPackageCodes: string[];

  constructor(message: string, themeId?: string, requiredPackageCodes: string[] = []) {
    super(message);
    this.name = 'ThemeNotEntitledError';
    this.themeId = themeId;
    this.requiredPackageCodes = requiredPackageCodes;
  }
}

export class InvalidPartyLifecycleTransitionError extends Error {
  readonly code = 'invalid_lifecycle_transition' as const;
  readonly currentState: PartyLifecycleState;
  readonly requestedState: PartyLifecycleState;

  constructor(
    message: string,
    currentState: PartyLifecycleState,
    requestedState: PartyLifecycleState,
  ) {
    super(message);
    this.name = 'InvalidPartyLifecycleTransitionError';
    this.currentState = currentState;
    this.requestedState = requestedState;
  }
}
