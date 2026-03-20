import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AnimatedSplash from './src/components/AnimatedSplash';
import { useApiUrlStore } from './src/store/apiUrlStore';
import { useAuthStore } from './src/store/authStore';
import { useDebugStore } from './src/store/debugStore';
import { RootStackParamList } from './src/navigation/types';
import ApiSetupScreen from './src/screens/ApiSetupScreen';
import LoginScreen from './src/screens/LoginScreen';
import MainTabs from './src/navigation/MainTabs';
import DebugToast from './src/components/DebugToast';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const apiUrlHydrated = useApiUrlStore((s) => s.hydrated);
  const apiUrl = useApiUrlStore((s) => s.apiUrl);
  const hydrateApiUrl = useApiUrlStore((s) => s.hydrate);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateDebug = useDebugStore((s) => s.hydrate);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    void hydrateApiUrl();
  }, [hydrateApiUrl]);

  useEffect(() => {
    void hydrateDebug();
  }, [hydrateDebug]);

  useEffect(() => {
    if (apiUrlHydrated) void hydrateAuth();
  }, [apiUrlHydrated, hydrateAuth]);

  if (!apiUrlHydrated || !authHydrated) {
    return <AnimatedSplash />;
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
