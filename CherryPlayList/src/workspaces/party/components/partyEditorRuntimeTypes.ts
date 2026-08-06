import { type PartyThemeId } from '@cherryplay/components';

import type { PartyDesignLockedThemeInfo } from './PartyDesignSettingsBlock';

export interface PartyEditorFieldValues {
  partyName: string;
  partyTitle: string;
  partySubtitle: string;
  eventDateTime: string;
  eventEndDateTime: string;
  description: string;
  place: string;
  city: string;
  schedule: string;
  timeZone: string;
  shortDescription: string;
  externalLinkUrl: string;
  externalLinkText: string;
  danceTags: string[];
}

export interface PartyEditorFieldHandlers {
  onPartyNameChange: (name: string) => void;
  onPartyTitleChange: (title: string) => void;
  onPartySubtitleChange: (subtitle: string) => void;
  onEventDateTimeChange: (dateTime: string) => void;
  onEventEndDateTimeChange: (dateTime: string) => void;
  onDescriptionChange: (description: string) => void;
  onPlaceChange: (place: string) => void;
  onCityChange: (city: string) => void;
  onScheduleChange: (schedule: string) => void;
  onShortDescriptionChange: (value: string) => void;
  onExternalLinkUrlChange: (value: string) => void;
  onExternalLinkTextChange: (value: string) => void;
  onDanceTagsChange: (tags: string[]) => void;
  onTimeZoneChange: (timeZone: string) => void;
}

export interface PartyEditorDesignState {
  themeId: PartyThemeId;
  customizationSettings: Record<string, unknown>;
  lockedThemes: PartyDesignLockedThemeInfo[];
  isThemeAccessLoading: boolean;
  visibleThemeIds: PartyThemeId[] | null;
  themeAccessErrorMessage: string | null;
  onThemeIdChange: (themeId: PartyThemeId) => void;
  onCustomizationSettingsChange: (settings: Record<string, unknown>) => void;
}

export interface PartyEditorConnectionState {
  linkedParty?: { id: string; shortCode: string; url?: string } | null;
  serverError: string | null;
  isCheckingParty: boolean;
  onRetry?: () => void;
}
