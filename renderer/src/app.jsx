import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './components/Sidebar';
import NotesList from './components/NotesList';
import Editor from './components/Editor';
import ErrorBoundary from './components/ErrorBoundary';
import Onboarding from './components/Onboarding';
import LockScreen from './components/LockScreen';
import LandingPage from './components/LandingPage';
import { AppProvider, useApp } from './store/AppContext';
import { Toaster } from 'react-hot-toast';
import './index.css';

const Layout = () => {
  const { focusMode, isSetup, isLocked, authChecked, finishSetup, unlockApp, loginApp } = useApp();
  const [hasPin, setHasPin] = useState(false);
  const [checkingPin, setCheckingPin] = useState(true);

  // Check if PIN exists separately to route between Onboarding (New) and Landing (Login)
  useEffect(() => {
    const checkPin = async () => {
        try {
            const status = await window.electron.invoke('auth-status');
            setHasPin(status.hasPin);
        } catch (e) {
            console.error(e);
        } finally {
            setCheckingPin(false);
        }
    };
    checkPin();
  }, [authChecked]); // Re-check when authChecked changes (e.g. after logout/reload)

  if (!authChecked || checkingPin) {
      return <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-slate-900 text-white">Loading...</div>;
  }

  // Case 1: Fresh Install (No PIN) -> Onboarding
  if (!hasPin) {
      return <Onboarding onComplete={finishSetup} />;
  }

  // Case 2: Logged Out / No Project Selected -> Landing Page
  // isSetup checks for (hasPin && projectPath). If false but hasPin is true, we are here.
  if (!isSetup) {
      return <LandingPage onOpenProject={loginApp} />;
  }

  // Case 3: Locked -> Lock Screen
  if (isLocked) {
      return <LockScreen onUnlock={unlockApp} />;
  }
  
  // Case 4: Authenticated & Unlocked -> Main App
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-900 transition-colors duration-200">
      {!focusMode && (
        <>
          <Sidebar />
          <NotesList />
        </>
      )}
      <Editor />
    </div>
  );
};

const App = () => {
  console.log('App mounting...');
  try {
    if (!window.electron) {
      console.warn('Electron API not found. Running in web mode?');
    }
  } catch (e) {
    console.error('Error accessing window.electron:', e);
  }

  return (
    <ErrorBoundary>
      <AppProvider>
        <Layout />
        <Toaster position="bottom-right" />
      </AppProvider>
    </ErrorBoundary>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
