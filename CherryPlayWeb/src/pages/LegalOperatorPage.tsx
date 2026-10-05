import { Link } from 'react-router-dom';

import { SiteFooter } from '../components/SiteFooter';
import { ROUTES } from '../constants/routes';
import { LEGAL_OPERATOR_CONTENT } from '../content/legal/documents';

import { linkifyLegalText } from './linkifyLegalText';
import './LegalPage.css';

export const LegalOperatorPage = () => {
  const content = LEGAL_OPERATOR_CONTENT;

  return (
    <div className="legal-page">
      <main className="legal-page-main">
        <p className="legal-page-back">
          <Link to={ROUTES.HOME}>← На главную</Link>
        </p>
        <h1>{content.title}</h1>
        <div className="legal-page-body">
          {content.paragraphs.map((paragraph, index) => (
            <p key={index}>{linkifyLegalText(paragraph)}</p>
          ))}
          <dl className="legal-operator-dl">
            <dt>Оператор</dt>
            <dd>{content.operatorName}</dd>
            <dt>Общий контакт</dt>
            <dd>
              <a href={`mailto:${content.generalContact}`}>{content.generalContact}</a>
            </dd>
            <dt>Контакт по персональным данным</dt>
            <dd>
              <a href={`mailto:${content.privacyContact}`}>{content.privacyContact}</a>
            </dd>
            <dt>Запросы субъекта персональных данных</dt>
            <dd>{content.subjectRequestChannel}</dd>
          </dl>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};
