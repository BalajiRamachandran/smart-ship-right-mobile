import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
import { ClipboardList, Package, Move, SlidersHorizontal, Settings } from 'lucide-react-native';

import type { MainTabParamList } from './types';
import OrdersListScreen from '../screens/Orders/OrdersListScreen';
import MoveSkuStack from './MoveSkuStack';
import PickingStack from './PickingStack';
import AdjustStack from './AdjustStack';
import SettingsScreen from '../screens/SettingsScreen';
import { theme } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** In Expo Go, BlurView causes "Unable to get the view config for ExpoBlurView". Use solid background there. */
const useTabBarBlur = (Platform.OS === 'ios' || Platform.OS === 'android') && Constants.appOwnership !== 'expo';

function TabBarGlassBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {useTabBarBlur ? (
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.backgroundCard }]} />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderTopWidth: 1, borderTopColor: 'rgba(148, 163, 184, 0.2)' },
        ]}
      />
    </View>
  );
}

const tabIcon = (Icon: React.ComponentType<{ size: number; color: string }>, focused: boolean) => (
  <Icon size={22} color={focused ? theme.colors.tabActive : theme.colors.tabInactive} />
);

const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Orders"
      screenOptions={{
        headerTitleAlign: 'center',
        tabBarActiveTintColor: theme.colors.tabActive,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarBackground: () => <TabBarGlassBackground />,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          paddingTop: 6,
          height: 58,
          overflow: 'hidden',
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontSize: 17, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Orders"
        component={OrdersListScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => tabIcon(ClipboardList, focused),
        }}
      />
      <Tab.Screen
        name="MoveSku"
        component={MoveSkuStack}
        options={{
          title: 'Move SKU',
          tabBarIcon: ({ focused }) => tabIcon(Move, focused),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Picking"
        component={PickingStack}
        options={{
          title: 'Picking',
          tabBarIcon: ({ focused }) => tabIcon(Package, focused),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Adjust"
        component={AdjustStack}
        options={{
          title: 'Adjust',
          tabBarIcon: ({ focused }) => tabIcon(SlidersHorizontal, focused),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => tabIcon(Settings, focused),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabs;
