// App.js
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MainApp from './mp';  // Main app navigation logic
import SignIn from './components/SignIn';  // Your SignIn component

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('jwt');
      setIsAuthenticated(!!token);  // If token exists, user is authenticated
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Render MainApp if authenticated, otherwise show SignIn */}
      {isAuthenticated ? (
        <MainApp />
      ) : (
        <SignIn onLogin={() => setIsAuthenticated(true)} />
      )}
    </View>
  );
}
