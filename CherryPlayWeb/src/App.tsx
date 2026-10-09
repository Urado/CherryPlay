import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { CookieNotice } from './components/CookieNotice';
import { SiteLayout } from './components/SiteLayout';
import { ROUTES } from './constants/routes';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { ClientOutdatedProvider } from './contexts/ClientOutdatedContext';
import { ConsentGateProvider, useConsentGateOpen } from './contexts/ConsentGateContext';
import { AdminOrganizerDetailPage } from './pages/admin/AdminOrganizerDetailPage';
import { AdminOrganizersPage } from './pages/admin/AdminOrganizersPage';
import { CabinetPage } from './pages/CabinetPage';
import { DownloadPage } from './pages/DownloadPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { FirstRunGuidePage } from './pages/FirstRunGuidePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LegalDocumentPage } from './pages/LegalDocumentPage';
import { LegalOperatorPage } from './pages/LegalOperatorPage';
import { LoginPage } from './pages/LoginPage';
import { OAuthCompletePage } from './pages/OAuthCompletePage';
import { PartyInfoPage } from './pages/PartyInfoPage';
import { PartyListPage } from './pages/PartyListPage';
import { PartyQrPage } from './pages/PartyQrPage';
import { PartyView } from './pages/PartyView';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import '@cherryplay/components/themes/index.css';
import './App.css';

const PAGE_TITLES: Record<string, string> = {
  [ROUTES.HOME]: 'Вечеринки',
  ['/download']: 'Скачать приложение',
  [ROUTES.FIRST_RUN_GUIDE]: 'Первый запуск CherryPashkaParty',
  [ROUTES.FEEDBACK]: 'Обратная связь',
  [ROUTES.LOGIN]: 'Вход',
  [ROUTES.REGISTER]: 'Регистрация',
  [ROUTES.OAUTH_COMPLETE]: 'Вход в приложение',
  [ROUTES.FORGOT_PASSWORD]: 'Восстановление пароля',
  [ROUTES.RESET_PASSWORD]: 'Новый пароль',
  [ROUTES.CABINET]: 'Кабинет организатора',
  [ROUTES.ADMIN_ORGANIZERS]: 'Организаторы',
  [ROUTES.PRIVACY]: 'Политика персональных данных',
  [ROUTES.CONSENT]: 'Согласие на обработку данных',
  [ROUTES.TERMS]: 'Пользовательское соглашение',
  [ROUTES.COOKIES]: 'Политика cookie',
  [ROUTES.LEGAL]: 'Реквизиты оператора',
};

const getDocumentTitle = (pathname: string): string => {
  const normalizedPath = pathname.replace(/\/+$/, '') || ROUTES.HOME;

  if (/^\/party\/[^/]+\/info$/.test(normalizedPath)) {
    return 'Информация о вечеринке';
  }

  if (/^\/party\/[^/]+\/qr$/.test(normalizedPath)) {
    return 'QR-код вечеринки';
  }

  if (/^\/party\/[^/]+$/.test(normalizedPath)) {
    return 'Вечеринка';
  }

  if (/^\/admin\/organizers\/[^/]+$/.test(normalizedPath)) {
    return 'Карточка организатора';
  }

  if (/^\/(privacy|consent|terms|cookies)\/v\/[^/]+$/.test(normalizedPath)) {
    const documentPath = normalizedPath.split('/')[1];
    return PAGE_TITLES[`/${documentPath}`] ?? PAGE_TITLES[ROUTES.HOME];
  }

  return PAGE_TITLES[normalizedPath] ?? PAGE_TITLES[ROUTES.HOME];
};

const CatalogOrRedirect = () => {
  const [searchParams] = useSearchParams();
  const partyFromQuery = searchParams.get('party');
  if (partyFromQuery) {
    return <Navigate to={ROUTES.PARTY_VIEW(partyFromQuery)} replace />;
  }
  return <PartyListPage />;
};

const AppShell = () => {
  const consentGateOpen = useConsentGateOpen();
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${getDocumentTitle(pathname)} — CherryPashkaParty`;
  }, [pathname]);

  return (
    <>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path={ROUTES.HOME} element={<CatalogOrRedirect />} />
          <Route path={ROUTES.DOWNLOAD} element={<DownloadPage />} />
          <Route path={ROUTES.FIRST_RUN_GUIDE} element={<FirstRunGuidePage />} />
          <Route path={ROUTES.FEEDBACK} element={<FeedbackPage />} />
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.OAUTH_COMPLETE} element={<OAuthCompletePage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
          <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
          <Route path={ROUTES.CABINET} element={<CabinetPage />} />
          <Route path={ROUTES.ADMIN_ROOT} element={<Navigate to={ROUTES.ADMIN_ORGANIZERS} replace />} />
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
        </Route>
        <Route path="/party/:shortCode" element={<PartyViewByRoute />} />
        <Route path="/party/:shortCode/info" element={<PartyInfoPage />} />
        <Route path="/party/:shortCode/qr" element={<PartyQrPage />} />
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
  if (!shortCode) return <Navigate to="/" replace />;
  return <PartyView shortCode={shortCode} />;
};

export default App;
