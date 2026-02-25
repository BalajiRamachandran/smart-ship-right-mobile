import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PickingStackParamList } from './types';
import PickingScreen from '../screens/PickingScreen';
import BarcodeScannerScreen from '../screens/BarcodeScannerScreen';

const Stack = createNativeStackNavigator<PickingStackParamList>();

export default function PickingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen
        name="PickingRoot"
        component={PickingScreen}
        options={{ title: 'Picking' }}
      />
      <Stack.Screen
        name="Scanner"
        component={BarcodeScannerScreen}
        options={({ route }) => ({ title: route.params.title || 'Scan' })}
      />
    </Stack.Navigator>
  );
}
