import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MoveSkuStackParamList } from './types';
import MoveSkuScreen from '../screens/MoveSkuScreen';
import MoveSkuHistoryScreen from '../screens/MoveSkuHistoryScreen';
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
        options={({ navigation }) => ({
          title: 'Move SKU',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <TouchableOpacity onPress={() => navigation.navigate('MoveSkuHistory')} hitSlop={8}>
                <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>History</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => logout()} hitSlop={8}>
                <Text style={{ color: theme.colors.textSecondary, fontWeight: '700' }}>Logout</Text>
              </TouchableOpacity>
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="MoveSkuHistory"
        component={MoveSkuHistoryScreen}
        options={{ title: 'Move history' }}
      />
      <Stack.Screen
        name="Scanner"
        component={BarcodeScannerScreen}
        options={({ route }) => ({ title: route.params.title || 'Scan' })}
      />
    </Stack.Navigator>
  );
}
