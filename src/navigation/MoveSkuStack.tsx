import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MoveSkuStackParamList } from './types';
import MoveSkuScreen from '../screens/MoveSkuScreen';
import BarcodeScannerScreen from '../screens/BarcodeScannerScreen';
import { useAuthStore } from '../store/authStore';
import { theme } from '../theme';

const Stack = createNativeStackNavigator<MoveSkuStackParamList>();

export default function MoveSkuStack() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <Stack.Navigator screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen
        name="MoveSkuRoot"
        component={MoveSkuScreen}
        options={{
          title: 'Move SKU',
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
