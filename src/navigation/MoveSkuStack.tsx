import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MoveSkuStackParamList } from './types';
import MoveSkuScreen from '../screens/MoveSkuScreen';
import BarcodeScannerScreen from '../screens/BarcodeScannerScreen';

const Stack = createNativeStackNavigator<MoveSkuStackParamList>();

export default function MoveSkuStack() {
  return (
    <Stack.Navigator screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen
        name="MoveSkuRoot"
        component={MoveSkuScreen}
        options={{ title: 'Move SKU' }}
      />
      <Stack.Screen
        name="Scanner"
        component={BarcodeScannerScreen}
        options={({ route }) => ({ title: route.params.title || 'Scan' })}
      />
    </Stack.Navigator>
  );
}
