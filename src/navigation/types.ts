export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Orders: undefined;
  MoveSku: undefined;
  Picking: undefined;
};

/** Params for MoveSku tab stack (inner screens; tab name stays "MoveSku") */
export type MoveSkuStackParamList = {
  MoveSkuRoot: { scannedField?: string; scannedValue?: string } | undefined;
  Scanner: { returnTo: 'MoveSkuRoot'; field: string; title?: string };
};

/** Params for Picking tab stack (inner screens; tab name stays "Picking") */
export type PickingStackParamList = {
  PickingRoot: { scannedField?: string; scannedValue?: string } | undefined;
  Scanner: { returnTo: 'PickingRoot'; field: string; title?: string };
};
