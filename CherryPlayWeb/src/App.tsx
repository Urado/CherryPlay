import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { ROUTES } from './constants/routes';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { ClientOutdatedProvider } from './contexts/ClientOutdatedContext';
import { AdminOrganizerDetailPage } from './pages/admin/AdminOrganizerDetailPage';
import { AdminOrganizersPage } from './pages/admin/AdminOrganizersPage';
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
    return <Navigate to={ROUTES.PARTY_VIEW(partyFromQuery)} replace />;
  }
  return <PartyListPage onPartySelect={(shortCode) => navigate(ROUTES.PARTY_VIEW(shortCode))} />;
}

function App() {
  return (
    <BrowserRouter>
      <ClientOutdatedProvider>
        <AppConfigProvider>
          <Routes>
            <Route path={ROUTES.HOME} element={<CatalogOrRedirect />} />
            <Route path="/party/:shortCode" element={<PartyViewByRoute />} />
            <Route path="/party/:shortCode/info" element={<PartyInfoPage />} />
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
            <Route path={ROUTES.CABINET} element={<CabinetPage />} />
            <Route
              path={ROUTES.ADMIN_ROOT}
              element={<Navigate to={ROUTES.ADMIN_ORGANIZERS} replace />}
            />
            <Route path={ROUTES.ADMIN_ORGANIZERS} element={<AdminOrganizersPage />} />
            <Route path="/admin/organizers/:id" element={<AdminOrganizerDetailPage />} />
            <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
          </Routes>
        </AppConfigProvider>
      </ClientOutdatedProvider>
    </BrowserRouter>
  );
}

function PartyViewByRoute() {
  const shortCode = useParams<{ shortCode: string }>().shortCode;
  const navigate = useNavigate();
  if (!shortCode) return <Navigate to="/" replace />;
  return <PartyView shortCode={shortCode} onBackToList={() => navigate(ROUTES.HOME)} />;
}

export default App;
