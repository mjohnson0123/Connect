import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { color, font } from '../../src/theme/tokens';

function Glyph({ char, focused }: { char: string; focused: boolean }) {
  return (
    <Text
      allowFontScaling={false}
      style={{
        fontFamily: font.mono,
        fontSize: 18,
        color: focused ? color.ink : color.textMutedOnChalk,
      }}
    >
      {char}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.chalk },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: font.display, fontSize: 22, color: color.ink },
        headerTitleAlign: 'left',
        tabBarStyle: { backgroundColor: color.chalk, borderTopColor: color.hairline },
        tabBarActiveTintColor: color.ink,
        tabBarInactiveTintColor: color.textMutedOnChalk,
        tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 11 },
        sceneStyle: { backgroundColor: color.chalk },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Departures',
          tabBarLabel: 'Board',
          tabBarIcon: ({ focused }) => <Glyph char="▤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: 'Connections',
          tabBarLabel: 'Connect',
          tabBarIcon: ({ focused }) => <Glyph char="◇" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarLabel: 'You',
          tabBarIcon: ({ focused }) => <Glyph char="●" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
