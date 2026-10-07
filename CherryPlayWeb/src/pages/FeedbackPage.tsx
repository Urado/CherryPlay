import { Link } from 'react-router-dom';

import { SUPPORT_CONTACT_EMAIL } from '../constants/legalContacts';
import { ROUTES } from '../constants/routes';

import './FeedbackPage.css';

const VK_MESSAGE_URL = 'https://vk.me/cherrypashkaparty';

export const FeedbackPage = () => {
  return (
    <main className="feedback-page">
      <div className="feedback-page__content">
        <Link className="feedback-page__back" to={ROUTES.HOME}>
          На главную
        </Link>
        <h1>Обратная связь</h1>
        <section className="feedback-page__contact" aria-labelledby="feedback-contact-title">
          <h2 id="feedback-contact-title">Напишите нам</h2>
          <p>
            Чтобы задать вопрос или сообщить о проблеме, отправьте письмо на адрес поддержки. Если
            проблема связана с аккаунтом, укажите email, использованный при регистрации, и опишите,
            что произошло.
          </p>
          <a className="feedback-page__email" href={`mailto:${SUPPORT_CONTACT_EMAIL}`}>
            {SUPPORT_CONTACT_EMAIL}
          </a>
        </section>
        <section className="feedback-page__community" aria-labelledby="feedback-community-title">
          <h2 id="feedback-community-title">Напишите нам во ВКонтакте</h2>
          <p>Откройте диалог с сообществом, чтобы задать вопрос или сообщить о проблеме.</p>
          <a
            className="feedback-page__vk-message-link"
            href={VK_MESSAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть диалог с сообществом ВКонтакте
          </a>
        </section>
      </div>
    </main>
  );
};
