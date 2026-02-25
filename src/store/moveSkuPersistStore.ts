import { create } from 'zustand';

export type Step = 'sku' | 'source' | 'destination' | 'quantity';

type SkuSnapshot = {
  id: string;
  sku_code: string;
  name: string;
  barcode?: string | null;
} | null;

type MoveSkuPersistState = {
  step: Step;
  sku: SkuSnapshot;
  sourceLocation: string;
  destinationLocation: string;
  availableQty: number;
  quantity: string;
  /** Restore from persisted state (e.g. after returning from Scanner) */
  hydrate: (state: Partial<Omit<MoveSkuPersistState, 'hydrate' | 'clear'>>) => void;
  /** Persist current state */
  save: (state: Omit<MoveSkuPersistState, 'hydrate' | 'save' | 'clear'>) => void;
  clear: () => void;
};

const initial = {
  step: 'sku' as Step,
  sku: null as SkuSnapshot,
  sourceLocation: '',
  destinationLocation: '',
  availableQty: 0,
  quantity: '1',
};

export const useMoveSkuPersistStore = create<MoveSkuPersistState>((set) => ({
  ...initial,
  hydrate(state) {
    set((prev) => ({ ...prev, ...state }));
  },
  save(state) {
    set(state);
  },
  clear() {
    set(initial);
  },
}));
