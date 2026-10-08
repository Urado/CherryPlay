import { Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import './FirstRunGuidePage.css';

export const FirstRunGuidePage = () => (
  <main className="first-run-guide-page" aria-labelledby="first-run-guide-title">
    <header className="first-run-guide-header">
      <p className="first-run-guide-eyebrow">CherryPashkaParty</p>
      <h1 id="first-run-guide-title">Первый запуск CherryPashka List</h1>
      <p className="first-run-guide-intro">
        Создайте вечеринку, опубликуйте плейлист и поделитесь ссылкой с гостями. Для эфира
        используйте встроенный проигрыватель или подключите AIMP.
      </p>
      <p className="first-run-guide-callout">
        Для этой инструкции: Windows 10/11 x64. Источник AIMP доступен только в Windows x64.
      </p>
    </header>

    <div className="first-run-guide-steps">
      <section className="first-run-guide-section">
        <h2>1. Скачайте и распакуйте приложение</h2>
        <ol>
          <li>
            Откройте <Link to={ROUTES.DOWNLOAD}>страницу загрузки CherryPashkaParty</Link> и
            скачайте ZIP для Windows.
          </li>
          <li>
            В Проводнике нажмите ZIP правой кнопкой мыши → <strong>Извлечь всё…</strong>.
          </li>
          <li>
            Откройте распакованную папку и запустите <strong>CherryPashkaList.exe</strong>.
          </li>
        </ol>
        <p className="first-run-guide-muted">
          Приложение распространяется ZIP-архивом: запускать нужно файл из распакованной папки.
        </p>
      </section>

      <section className="first-run-guide-section">
        <h2>2. Выберите проигрыватель</h2>
        <p>
          Для эфира можно использовать встроенный проигрыватель CherryPashka List или подключить AIMP.
          Инструкция по подключению AIMP приведена ниже.
        </p>
      </section>

      <section className="first-run-guide-section">
        <h2>3. Зарегистрируйтесь и войдите</h2>
        <ol>
          <li>
            Если аккаунта ещё нет, откройте <Link to={ROUTES.REGISTER}>регистрацию на сайте</Link>.
          </li>
          <li>
            Укажите <strong>Название организации</strong>, <strong>Email</strong>, пароль и его
            подтверждение. Отметьте оба обязательных согласия и нажмите{' '}
            <span className="first-run-guide-choice">Зарегистрироваться</span>.
          </li>
          <li>
            Вернитесь в CherryPashka List, откройте аккаунт и нажмите{' '}
            <span className="first-run-guide-choice">Войти через браузер</span>.
          </li>
          <li>
            В открывшемся браузере выберите <strong>Email / Пароль</strong>, введите email и пароль
            и нажмите <span className="first-run-guide-choice">Войти</span>. Браузер вернёт вас в
            приложение; если этого не произошло, нажмите ссылку возврата в CherryPashka List на
            странице входа.
          </li>
        </ol>
      </section>

      <section className="first-run-guide-section">
        <h2>4. Создайте вечеринку и опубликуйте плейлист</h2>
        <ol>
          <li>Откройте настройки вечеринки кнопкой с шестерёнкой в шапке приложения.</li>
          <li>
            Заполните название и нужные сведения. В блоке действий нажмите{' '}
            <span className="first-run-guide-choice">Создать</span>.
          </li>
          <li>
            Добавьте аудиофайлы в плейлист. Для гостей в сети включите <strong>Онлайн</strong> в
            настройках приложения.
          </li>
          <li>
            Нажмите значок публикации в шапке вечеринки. При наведении на него появится подпись{' '}
            <strong>«Обновить на сайте»</strong> или <strong>«Обновить для гостей»</strong>.
            Дождитесь подтверждения синхронизации.
          </li>
          <li>
            Скопируйте <strong>URL вечеринки</strong> в её настройках или откройте страницу
            вечеринки в браузере и возьмите там ссылку или QR-код для гостей.
          </li>
        </ol>
        <p className="first-run-guide-callout">
          Публикация отправляет плейлист на страницу вечеринки. Настройка каталога отдельно
          определяет, будет ли вечеринка видна в каталоге сайта.
        </p>
      </section>

      <section className="first-run-guide-section">
        <h2>5. Начните эфир и отправьте ссылку гостям</h2>
        <ol>
          <li>
            Для встроенного проигрывателя нажмите{' '}
            <span className="first-run-guide-choice">Начать проигрывание</span> в зоне
            «Проигрывание».
          </li>
          <li>
            Если настроили AIMP (см. инструкцию ниже), откройте настройки приложения → раздел
            «Проигрывание» → поле <strong>Источник проигрывания</strong> → выберите{' '}
            <strong>AIMP</strong>. Когда в панели появится подключение и список треков, нажмите{' '}
            <span className="first-run-guide-choice">Включить онлайн</span>.
          </li>
          <li>Отправьте ссылку или QR-код гостям, чтобы они открыли страницу вечеринки.</li>
        </ol>
        <p className="first-run-guide-callout">
          Гости получают плейлист и состояние воспроизведения. Звук на сайт не передаётся: музыку
          слышат в AIMP или CherryPashka List у организатора.
        </p>
      </section>

      <section className="first-run-guide-section">
        <h2>Дополнительно: подключение AIMP</h2>
        <p>
          Этот шаг нужен только если вы хотите использовать AIMP вместо встроенного проигрывателя.
        </p>
        <ol>
          <li>
            Установите <a href="https://www.aimp.ru/?do=download&os=desktop">AIMP x64</a> с
            официального сайта.
          </li>
          <li>Закройте AIMP, если он запущен.</li>
          <li>
            В распакованной папке CherryPashka List скопируйте папку{' '}
            <strong>CherryPlayAimpBridge</strong> целиком в подпапку <strong>Plugins</strong>{' '}
            каталога установки AIMP. Если Windows запросит права, подтвердите копирование.
          </li>
          <li>Запустите AIMP заново и добавьте музыку в его плейлист.</li>
        </ol>
      </section>

      <section className="first-run-guide-section">
        <h2>Если что-то не получилось</h2>
        <ul>
          <li>
            <strong>Не получается войти:</strong> проверьте email и пароль. Если пароль забыт, на
            странице входа нажмите «Забыли пароль?» и следуйте инструкции в письме.
          </li>
          <li>
            <strong>Не удаётся создать вечеринку или опубликовать плейлист:</strong> проверьте
            подключение к интернету, вход в аккаунт и включённую настройку «Онлайн».
          </li>
          <li>
            <strong>Ссылка не копируется:</strong> проверьте, что вечеринка создана и URL уже
            отображается в её настройках.
          </li>
          <li>
            <strong>AIMP недоступен в списке:</strong> функция доступна только в CherryPashka List для
            Windows x64. Проверьте, что в папке приложения есть{' '}
            <strong>CherryPlayAimpBridge</strong> с файлом <strong>manifest.json</strong>, затем
            перезапустите CherryPashka List.
          </li>
          <li>
            <strong>Плагин не подключается:</strong> убедитесь, что запущен AIMP x64, а{' '}
            <strong>CherryPlayAimpBridge.dll</strong> находится в папке Plugins этой установки. В
            CherryPashka List выберите AIMP в настройке «Источник проигрывания» и дождитесь состояния
            «Подключено». Если состояние не меняется, полностью перезапустите AIMP.
          </li>
          <li>
            <strong>Подключение устарело:</strong> перезапустите AIMP. Если это не помогло,
            перезапустите CherryPashka List и дождитесь повторного подключения плагина.
          </li>
          <li>
            <strong>AIMP подключён, но список пуст:</strong> выберите в AIMP активный плейлист с
            треками и дождитесь обновления списка в CherryPashka List.
          </li>
          <li>
            <strong>«Включить онлайн» недоступно:</strong> сначала создайте или привяжите вечеринку,
            включите «Онлайн» в настройках CherryPashka List и дождитесь подключения плагина и списка
            треков.
          </li>
        </ul>
      </section>
    </div>

    <p className="first-run-guide-closing">
      Страница вечеринки доступна гостям по ссылке. Изменения локального плейлиста следует
      публиковать заново.
    </p>
  </main>
);
