import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { CabinetPage } from './pages/CabinetPage';
import { LoginPage } from './pages/LoginPage';
import { PartyInfoPage } from './pages/PartyInfoPage';
import { PartyListPage } from './pages/PartyListPage';
import { PartyView } from './pages/PartyView';
import { RegisterPage } from './pages/RegisterPage';
import '@cherryplay/components/themes/index.css';
import './App.css';

function CatalogOrRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const partyFromQuery = searchParams.get('party');
  if (partyFromQuery) {
    return <Navigate to={`/party/${partyFromQuery}`} replace />;
  }
  return <PartyListPage onPartySelect={(shortCode) => navigate(`/party/${shortCode}`)} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CatalogOrRedirect />} />
        <Route path="/party/:shortCode" element={<PartyViewByRoute />} />
        <Route path="/party/:shortCode/info" element={<PartyInfoPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/cabinet" element={<CabinetPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function PartyViewByRoute() {
  const shortCode = useParams<{ shortCode: string }>().shortCode;
  const handleBackToList = () => {
    window.location.href = '/';
  };
  if (!shortCode) return <Navigate to="/" replace />;
  return <PartyView shortCode={shortCode} onBackToList={handleBackToList} />;
}

export default App;
