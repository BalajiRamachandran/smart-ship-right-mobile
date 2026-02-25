import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardList, Package, Move } from 'lucide-react-native';

import type { MainTabParamList } from './types';
import OrdersListScreen from '../screens/Orders/OrdersListScreen';
import MoveSkuStack from './MoveSkuStack';
import PickingStack from './PickingStack';
import { theme } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

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
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          height: 58,
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
    </Tab.Navigator>
  );
};

export default MainTabs;
