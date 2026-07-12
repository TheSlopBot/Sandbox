export type ConstructLevelPivotKind = 'group' | 'multi';

export type ConstructLevelPivot = {
  pivotKind: ConstructLevelPivotKind;
};

export const createConstructLevelPivot = (pivotKind: ConstructLevelPivotKind): ConstructLevelPivot => ({
  pivotKind,
});

export const LEVEL_GROUP_PIVOT_ID = '__level_group_pivot__';
export const LEVEL_MULTI_PIVOT_ID = '__level_multi_pivot__';
