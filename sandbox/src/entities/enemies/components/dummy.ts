import { type DummyVariant } from '../../../catalog/actors/kaykitActors.ts';

export type Dummy = {
  variant: DummyVariant;
};

export const createDummy = (variant: DummyVariant): Dummy => ({ variant });
