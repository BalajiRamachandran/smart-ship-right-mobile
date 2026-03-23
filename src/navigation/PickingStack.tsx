import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PickingStackParamList } from './types';
import PickingScreen from '../screens/PickingScreen';
import BarcodeScannerScreen from '../screens/BarcodeScannerScreen';
import { useAuthStore } from '../store/authStore';
import { theme } from '../theme';

const Stack = createNativeStackNavigator<PickingStackParamList>();

export default function PickingStack() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <Stack.Navigator screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen
        name="PickingRoot"
        component={PickingScreen}
        options={{
          title: 'Picking',
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
    </Stack.Navigator>
  );
}
