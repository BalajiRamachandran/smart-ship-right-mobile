export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Orders: undefined;
  MoveSku: undefined;
  Picking: undefined;
  Adjust: undefined;
  Hospital: undefined;
  Settings: undefined;
};

/** Params for Adjust tab stack */
export type AdjustStackParamList = {
  AdjustRoot: { scannedField?: string; scannedValue?: string } | undefined;
  Scanner: { returnTo: 'AdjustRoot'; field: string; title?: string };
  AdjustInventory: { skuId: string };
};

/** Params for MoveSku tab stack (inner screens; tab name stays "MoveSku") */
export type MoveSkuStackParamList = {
  MoveSkuRoot: { scannedField?: string; scannedValue?: string } | undefined;
  MoveSkuHistory: undefined;
  Scanner: { returnTo: 'MoveSkuRoot'; field: string; title?: string };
};

/** Params for Picking tab stack (inner screens; tab name stays "Picking") */
export type PickingStackParamList = {
  PickingRoot: { scannedField?: string; scannedValue?: string } | undefined;
  Scanner: { returnTo: 'PickingRoot'; field: string; title?: string };
};
