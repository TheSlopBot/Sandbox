import { COMPONENT_KEYS } from 'viberanium';

export const PREVIEW_KEYS = {
  orbit: `${COMPONENT_KEYS.transform}.previewOrbit`,
  previewAnim: `${COMPONENT_KEYS.transform}.previewAnim`,
  orbitOriginMarker: `${COMPONENT_KEYS.transform}.previewOrbitOriginMarker`,
} as const;

export type PreviewComponentKey = (typeof PREVIEW_KEYS)[keyof typeof PREVIEW_KEYS];
