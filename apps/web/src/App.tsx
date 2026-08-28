import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { AppShell } from './pages/AppShell';
import { Chats } from './pages/Chats';
import { Settings } from './pages/Settings';
import { Moments } from './pages/Moments';
import { Connections } from './pages/Connections';
import { Shared } from './pages/Shared';
import { BondLock } from './pages/BondLock';
import { SurpriseBoxes } from './pages/SurpriseBox';
import { INeedYou } from './pages/INeedYou';
import { VoiceDiary } from './pages/VoiceDiary';
import { Notifications } from './pages/Notifications';

function Protected() {
  const { status } = useAuth();
  if (status === 'loading') return <div className="auth-wrap">Loading…</div>;
  if (status === 'signedOut') return <Navigate to="/login" replace />;
  return <AppShell />;
}

function GuestOnly({ children }: { children: React.ReactElement }) {
  const { status } = useAuth();
  if (status === 'signedIn') return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
          <Route path="/app" element={<Protected />}>
            <Route index element={<Chats />} />
            <Route path="moments" element={<Moments />} />
            <Route path="connections" element={<Connections />} />
            <Route path="shared" element={<Shared />} />
            <Route path="bond-lock" element={<BondLock />} />
            <Route path="surprise-box" element={<SurpriseBoxes />} />
            <Route path="i-need-you" element={<INeedYou />} />
            <Route path="voice-diary" element={<VoiceDiary />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
