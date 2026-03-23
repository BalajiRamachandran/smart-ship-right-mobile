import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdjustStackParamList } from './types';
import AdjustScreen from '../screens/AdjustScreen';
import AdjustInventoryScreen from '../screens/AdjustInventoryScreen';
import BarcodeScannerScreen from '../screens/BarcodeScannerScreen';
import { useAuthStore } from '../store/authStore';
import { theme } from '../theme';

const Stack = createNativeStackNavigator<AdjustStackParamList>();

export default function AdjustStack() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <Stack.Navigator screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen
        name="AdjustRoot"
        component={AdjustScreen}
        options={{
          title: 'Adjust inventory',
          headerRight: () => (
            <TouchableOpacity onPress={() => logout()} hitSlop={8}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '700' }}>Logout</Text>
            </TouchableOpacity>
          ),
        }}
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
