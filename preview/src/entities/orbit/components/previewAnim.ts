export type PreviewAnim = {
  selectedAnimUrl: string | null;
  selectedClipName: string | null;
  availableClipNames: string[];
};

export const createPreviewAnim = (): PreviewAnim => ({
  selectedAnimUrl: null,
  selectedClipName: null,
  availableClipNames: [],
});
