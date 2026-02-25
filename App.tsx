import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useApiUrlStore } from './src/store/apiUrlStore';
import { useAuthStore } from './src/store/authStore';
import { RootStackParamList } from './src/navigation/types';
import ApiSetupScreen from './src/screens/ApiSetupScreen';
import LoginScreen from './src/screens/LoginScreen';
import MainTabs from './src/navigation/MainTabs';
import DebugToast from './src/components/DebugToast';
import { theme } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const hydrated = useApiUrlStore((s) => s.hydrated);
  const apiUrl = useApiUrlStore((s) => s.apiUrl);
  const hydrate = useApiUrlStore((s) => s.hydrate);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (apiUrl == null) {
    return <ApiSetupScreen />;
  }

  return (
    <Stack.Navigator>
      {token == null ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View style={{ flex: 1 }}>
          <RootNavigator />
          <DebugToast />
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
