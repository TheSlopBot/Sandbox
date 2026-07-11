export type ConstructEditorSelection = {
  targetId: string | null;
};

export const createConstructEditorSelection = (): ConstructEditorSelection => ({
  targetId: null,
});
