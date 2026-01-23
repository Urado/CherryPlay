/**
 * Главный компонент приложения
 * Роутинг:
 * - Если есть параметр ?party=XXX - показывает конкретную вечеринку
 * - Если параметр отсутствует - показывает список всех вечеринок
 */
import { useMemo, useState, useCallback, useEffect } from 'react';
import { PartyView } from './pages/PartyView';
import { PartyListPage } from './pages/PartyListPage';
// Импортируем все темы для поддержки всех стилей вечеринок
import '@cherryplay/components/themes/cyberpunk/index.css';
import '@cherryplay/components/themes/sakura/index.css';
import '@cherryplay/components/themes/art-deco/index.css';
import './App.css';

function App() {
  // Извлекаем shortCode из URL параметра ?party=XXX
  const shortCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('party') || undefined;
  }, []);

  const [selectedParty, setSelectedParty] = useState<string | undefined>(shortCode);

  const handlePartySelect = useCallback((shortCode: string) => {
    // Обновляем URL без перезагрузки страницы
    const url = new URL(window.location.href);
    url.searchParams.set('party', shortCode);
    window.history.pushState({}, '', url.toString());
    setSelectedParty(shortCode);
  }, []);

  const handleBackToList = useCallback(() => {
    // Удаляем параметр party из URL
    const url = new URL(window.location.href);
    url.searchParams.delete('party');
    window.history.pushState({}, '', url.toString());
    setSelectedParty(undefined);
  }, []);

  // Обработка изменения URL через кнопки браузера (назад/вперед)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const party = params.get('party') || undefined;
      setSelectedParty(party);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Если есть shortCode в URL или выбранная вечеринка - показываем вечеринку
  if (selectedParty || shortCode) {
    return <PartyView shortCode={selectedParty || shortCode} onBackToList={handleBackToList} />;
  }

  // Иначе показываем список вечеринок
  return <PartyListPage onPartySelect={handlePartySelect} />;
}

export default App;

