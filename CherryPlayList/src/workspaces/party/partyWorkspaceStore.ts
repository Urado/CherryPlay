import { getDefaultCustomizationSettings, type PartyThemeId } from '@cherryplay/components';
import { createWithEqualityFn } from 'zustand/traditional';

import { ThemeAccessDto, type PartyLifecycleState } from '@shared/services/partyService';

export interface ThemeEntitlementModalState {
  message: string;
  safeContactUrl: string | null;
}

export interface PartyWorkspaceState {
  partyName: string;
  partyTitle: string;
  partySubtitle: string;
  themeId: PartyThemeId;
  customizationSettings: Record<string, unknown>;
  eventDateTime: string;
  eventEndDateTime: string;
  hasInitialEventEndDateTime: boolean;
  eventEndDateTimeTouched: boolean;
  description: string;
  place: string;
  city: string;
  schedule: string;
  timeZone: string;
  shortDescription: string;
  externalLinkUrl: string;
  externalLinkText: string;
  danceTags: string[];
  isCreating: boolean;
  isPublishing: boolean;
  partyLifecycleState: PartyLifecycleState | null;
  isTransitioningLifecycle: boolean;
  isCheckingParty: boolean;
  serverError: string | null;
  partyVerified: boolean;
  serverUnreachable: boolean;
  isReconnecting: boolean;
  lastManualCheckFailed: boolean;
  themeAccess: ThemeAccessDto | null;
  isThemeAccessLoading: boolean;
  themeAccessErrorMessage: string | null;
  themeEntitlementModal: ThemeEntitlementModalState | null;

  setPartyName: (value: string) => void;
  setPartyTitle: (value: string) => void;
  setPartySubtitle: (value: string) => void;
  setThemeId: (value: PartyThemeId) => void;
  setCustomizationSettings: (value: Record<string, unknown>) => void;
  setEventDateTime: (value: string) => void;
  setEventEndDateTime: (value: string) => void;
  setHasInitialEventEndDateTime: (value: boolean) => void;
  setEventEndDateTimeTouched: (value: boolean) => void;
  setDescription: (value: string) => void;
  setPlace: (value: string) => void;
  setCity: (value: string) => void;
  setSchedule: (value: string) => void;
  setTimeZone: (value: string) => void;
  setShortDescription: (value: string) => void;
  setExternalLinkUrl: (value: string) => void;
  setExternalLinkText: (value: string) => void;
  setDanceTags: (value: string[]) => void;
  setIsCreating: (value: boolean) => void;
  setIsPublishing: (value: boolean) => void;
  setPartyLifecycleState: (value: PartyLifecycleState | null) => void;
  setIsTransitioningLifecycle: (value: boolean) => void;
  setIsCheckingParty: (value: boolean) => void;
  setServerError: (value: string | null) => void;
  setPartyVerified: (value: boolean) => void;
  setServerUnreachable: (value: boolean) => void;
  setIsReconnecting: (value: boolean) => void;
  setLastManualCheckFailed: (value: boolean) => void;
  setThemeAccess: (value: ThemeAccessDto | null) => void;
  setIsThemeAccessLoading: (value: boolean) => void;
  setThemeAccessErrorMessage: (value: string | null) => void;
  setThemeEntitlementModal: (value: ThemeEntitlementModalState | null) => void;
  resetPartyWorkspaceState: () => void;
  resetPartyLinkState: () => void;
}

const defaultCustomizationSettings = getDefaultCustomizationSettings('cyberpunk') as Record<
  string,
  unknown
>;

const initialPartyWorkspaceState = {
  partyName: '',
  partyTitle: '',
  partySubtitle: '',
  themeId: 'cyberpunk' as PartyThemeId,
  customizationSettings: defaultCustomizationSettings,
  eventDateTime: '',
  eventEndDateTime: '',
  hasInitialEventEndDateTime: false,
  eventEndDateTimeTouched: false,
  description: '',
  place: '',
  city: '',
  schedule: '',
  timeZone: '',
  shortDescription: '',
  externalLinkUrl: '',
  externalLinkText: '',
  danceTags: [] as string[],
  isCreating: false,
  isPublishing: false,
  partyLifecycleState: null as PartyLifecycleState | null,
  isTransitioningLifecycle: false,
  isCheckingParty: false,
  serverError: null as string | null,
  partyVerified: false,
  serverUnreachable: false,
  isReconnecting: false,
  lastManualCheckFailed: false,
  themeAccess: null as ThemeAccessDto | null,
  isThemeAccessLoading: false,
  themeAccessErrorMessage: null as string | null,
  themeEntitlementModal: null as ThemeEntitlementModalState | null,
};

export const usePartyWorkspaceStore = createWithEqualityFn<PartyWorkspaceState>((set) => ({
  ...initialPartyWorkspaceState,

  setPartyName: (partyName) => set({ partyName }),
  setPartyTitle: (partyTitle) => set({ partyTitle }),
  setPartySubtitle: (partySubtitle) => set({ partySubtitle }),
  setThemeId: (themeId) => set({ themeId }),
  setCustomizationSettings: (customizationSettings) => set({ customizationSettings }),
  setEventDateTime: (eventDateTime) => set({ eventDateTime }),
  setEventEndDateTime: (eventEndDateTime) => set({ eventEndDateTime }),
  setHasInitialEventEndDateTime: (hasInitialEventEndDateTime) =>
    set({ hasInitialEventEndDateTime }),
  setEventEndDateTimeTouched: (eventEndDateTimeTouched) => set({ eventEndDateTimeTouched }),
  setDescription: (description) => set({ description }),
  setPlace: (place) => set({ place }),
  setCity: (city) => set({ city }),
  setSchedule: (schedule) => set({ schedule }),
  setTimeZone: (timeZone) => set({ timeZone }),
  setShortDescription: (shortDescription) => set({ shortDescription }),
  setExternalLinkUrl: (externalLinkUrl) => set({ externalLinkUrl }),
  setExternalLinkText: (externalLinkText) => set({ externalLinkText }),
  setDanceTags: (danceTags) => set({ danceTags }),
  setIsCreating: (isCreating) => set({ isCreating }),
  setIsPublishing: (isPublishing) => set({ isPublishing }),
  setPartyLifecycleState: (partyLifecycleState) => set({ partyLifecycleState }),
  setIsTransitioningLifecycle: (isTransitioningLifecycle) => set({ isTransitioningLifecycle }),
  setIsCheckingParty: (isCheckingParty) => set({ isCheckingParty }),
  setServerError: (serverError) => set({ serverError }),
  setPartyVerified: (partyVerified) => set({ partyVerified }),
  setServerUnreachable: (serverUnreachable) => set({ serverUnreachable }),
  setIsReconnecting: (isReconnecting) => set({ isReconnecting }),
  setLastManualCheckFailed: (lastManualCheckFailed) => set({ lastManualCheckFailed }),
  setThemeAccess: (themeAccess) => set({ themeAccess }),
  setIsThemeAccessLoading: (isThemeAccessLoading) => set({ isThemeAccessLoading }),
  setThemeAccessErrorMessage: (themeAccessErrorMessage) => set({ themeAccessErrorMessage }),
  setThemeEntitlementModal: (themeEntitlementModal) => set({ themeEntitlementModal }),
  resetPartyWorkspaceState: () =>
    set({
      ...initialPartyWorkspaceState,
      customizationSettings: { ...defaultCustomizationSettings },
      danceTags: [],
    }),
  resetPartyLinkState: () =>
    set({
      serverError: null,
      partyVerified: false,
      partyLifecycleState: null,
      serverUnreachable: false,
      isReconnecting: false,
      isCheckingParty: false,
      lastManualCheckFailed: false,
    }),
}));

export function resetPartyWorkspaceState(): void {
  usePartyWorkspaceStore.getState().resetPartyWorkspaceState();
}

export function resetPartyLinkState(): void {
  usePartyWorkspaceStore.getState().resetPartyLinkState();
}
