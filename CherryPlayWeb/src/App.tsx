import { useMemo, useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { CabinetPage } from './pages/CabinetPage';
import { LoginPage } from './pages/LoginPage';
import { PartyListPage } from './pages/PartyListPage';
import { PartyView } from './pages/PartyView';
import { RegisterPage } from './pages/RegisterPage';
import '@cherryplay/components/themes/index.css';
import './App.css';

function AppContent() {
  const shortCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('party') || undefined;
  }, []);

  const [selectedParty, setSelectedParty] = useState<string | undefined>(shortCode);

  const handlePartySelect = useCallback((shortCode: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('party', shortCode);
    window.history.pushState({}, '', url.toString());
    setSelectedParty(shortCode);
  }, []);

  const handleBackToList = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('party');
    window.history.pushState({}, '', url.toString());
    setSelectedParty(undefined);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const party = params.get('party') || undefined;
      setSelectedParty(party);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (selectedParty || shortCode) {
    return <PartyView shortCode={selectedParty || shortCode} onBackToList={handleBackToList} />;
  }

  return <PartyListPage onPartySelect={handlePartySelect} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/cabinet" element={<CabinetPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
