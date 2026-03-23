import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AlertTriangle, ClipboardList, Package, Move, SlidersHorizontal, Settings } from 'lucide-react-native';

import type { MainTabParamList } from './types';
import OrdersListScreen from '../screens/Orders/OrdersListScreen';
import MoveSkuStack from './MoveSkuStack';
import PickingStack from './PickingStack';
import AdjustStack from './AdjustStack';
import HospitalScreen from '../screens/HospitalScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { theme } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Solid dark tab bar for clear contrast; no blur so background is never light grey. */
function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.colors.tabBarBackground ?? theme.colors.background,
            borderTopWidth: 1,
            borderTopColor: theme.colors.borderStrong,
          },
        ]}
      />
    </View>
  );
}
// Alias for backwards compatibility (e.g. cached bundles that still reference old name)
const TabBarGlassBackground = TabBarBackground;

const tabIcon = (Icon: React.ComponentType<{ size: number; color: string }>, focused: boolean) => (
  <Icon size={22} color={focused ? theme.colors.tabActive : theme.colors.tabInactive} />
);

/** Set to true to show Orders tab (e.g. for internal use). When false, Orders is hidden but still in the navigator. */
const SHOW_ORDERS_TAB = process.env.EXPO_PUBLIC_SHOW_ORDERS_TAB === 'true';

const MainTabs: React.FC = () => {
  const initialRoute = SHOW_ORDERS_TAB ? 'Orders' : 'MoveSku';

  return (
    <Tab.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerTitleAlign: 'center',
        tabBarActiveTintColor: theme.colors.tabActive,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarBackground: () => <TabBarBackground />,
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
      {SHOW_ORDERS_TAB ? (
        <Tab.Screen
          name="Orders"
          component={OrdersListScreen}
          options={{
            title: 'Orders',
            tabBarIcon: ({ focused }) => tabIcon(ClipboardList, focused),
          }}
        />
      ) : null}
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
        name="Hospital"
        component={HospitalScreen}
        options={{
          title: 'Hospital',
          tabBarIcon: ({ focused }) => tabIcon(AlertTriangle, focused),
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
