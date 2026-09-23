import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { CookieNotice } from './components/CookieNotice';
import { ROUTES } from './constants/routes';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { ClientOutdatedProvider } from './contexts/ClientOutdatedContext';
import { ConsentGateProvider, useConsentGateOpen } from './contexts/ConsentGateContext';
import { AdminOrganizerDetailPage } from './pages/admin/AdminOrganizerDetailPage';
import { AdminOrganizersPage } from './pages/admin/AdminOrganizersPage';
import { CabinetPage } from './pages/CabinetPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LegalDocumentPage } from './pages/LegalDocumentPage';
import { LegalOperatorPage } from './pages/LegalOperatorPage';
import { LoginPage } from './pages/LoginPage';
import { OAuthCompletePage } from './pages/OAuthCompletePage';
import { PartyInfoPage } from './pages/PartyInfoPage';
import { PartyListPage } from './pages/PartyListPage';
import { PartyView } from './pages/PartyView';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import '@cherryplay/components/themes/index.css';
import './App.css';

const CatalogOrRedirect = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const partyFromQuery = searchParams.get('party');
  if (partyFromQuery) {
    return <Navigate to={ROUTES.PARTY_VIEW(partyFromQuery)} replace />;
  }
  return <PartyListPage onPartySelect={(shortCode) => navigate(ROUTES.PARTY_VIEW(shortCode))} />;
};

const AppShell = () => {
  const consentGateOpen = useConsentGateOpen();

  return (
    <>
      <Routes>
        <Route path={ROUTES.HOME} element={<CatalogOrRedirect />} />
        <Route path="/party/:shortCode" element={<PartyViewByRoute />} />
        <Route path="/party/:shortCode/info" element={<PartyInfoPage />} />
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.OAUTH_COMPLETE} element={<OAuthCompletePage />} />
        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
        <Route path={ROUTES.CABINET} element={<CabinetPage />} />
        <Route
          path={ROUTES.ADMIN_ROOT}
          element={<Navigate to={ROUTES.ADMIN_ORGANIZERS} replace />}
        />
        <Route path={ROUTES.ADMIN_ORGANIZERS} element={<AdminOrganizersPage />} />
        <Route path="/admin/organizers/:id" element={<AdminOrganizerDetailPage />} />
        <Route path={ROUTES.PRIVACY} element={<LegalDocumentPage docKey="privacy" />} />
        <Route path="/privacy/v/:version" element={<LegalDocumentPage docKey="privacy" />} />
        <Route path={ROUTES.CONSENT} element={<LegalDocumentPage docKey="consent" />} />
        <Route path="/consent/v/:version" element={<LegalDocumentPage docKey="consent" />} />
        <Route path={ROUTES.TERMS} element={<LegalDocumentPage docKey="terms" />} />
        <Route path="/terms/v/:version" element={<LegalDocumentPage docKey="terms" />} />
        <Route path={ROUTES.COOKIES} element={<LegalDocumentPage docKey="cookies" />} />
        <Route path="/cookies/v/:version" element={<LegalDocumentPage docKey="cookies" />} />
        <Route path={ROUTES.LEGAL} element={<LegalOperatorPage />} />
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>
      {consentGateOpen ? null : <CookieNotice />}
    </>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <ClientOutdatedProvider>
        <AppConfigProvider>
          <ConsentGateProvider>
            <AppShell />
          </ConsentGateProvider>
        </AppConfigProvider>
      </ClientOutdatedProvider>
    </BrowserRouter>
  );
};

const PartyViewByRoute = () => {
  const shortCode = useParams<{ shortCode: string }>().shortCode;
  const navigate = useNavigate();
  if (!shortCode) return <Navigate to="/" replace />;
  return <PartyView shortCode={shortCode} onBackToList={() => navigate(ROUTES.HOME)} />;
};

export default App;
