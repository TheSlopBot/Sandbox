export type ConstructAnim = {
  selectedAnimUrl: string | null;
  selectedClipName: string | null;
  availableClipNames: string[];
};

export const createConstructAnim = (): ConstructAnim => ({
  selectedAnimUrl: null,
  selectedClipName: null,
  availableClipNames: [],
});
