import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/providers/auth-provider';

export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') {
    return null;
  }

  if (status === 'signedIn') {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
