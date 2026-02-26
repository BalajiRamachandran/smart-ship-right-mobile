import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdjustStackParamList } from './types';
import AdjustScreen from '../screens/AdjustScreen';
import AdjustInventoryScreen from '../screens/AdjustInventoryScreen';
import BarcodeScannerScreen from '../screens/BarcodeScannerScreen';

const Stack = createNativeStackNavigator<AdjustStackParamList>();

export default function AdjustStack() {
  return (
    <Stack.Navigator screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen
        name="AdjustRoot"
        component={AdjustScreen}
        options={{ title: 'Adjust inventory' }}
      />
      <Stack.Screen
        name="Scanner"
        component={BarcodeScannerScreen}
        options={({ route }) => ({ title: route.params.title || 'Scan' })}
      />
      <Stack.Screen
        name="AdjustInventory"
        component={AdjustInventoryScreen}
        options={{ title: 'Edit inventory' }}
      />
    </Stack.Navigator>
  );
}
