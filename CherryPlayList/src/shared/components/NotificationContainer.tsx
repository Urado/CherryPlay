import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import React from 'react';

import { useUIStore } from '../stores/uiStore';

export const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useUIStore();

  if (notifications.length === 0) {
    return null;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon style={{ fontSize: '20px' }} />;
      case 'error':
        return <ErrorIcon style={{ fontSize: '20px' }} />;
      case 'warning':
        return <WarningIcon style={{ fontSize: '20px' }} />;
      case 'info':
        return <InfoIcon style={{ fontSize: '20px' }} />;
      default:
        return null;
    }
  };

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
          onClick={() => removeNotification(notification.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              removeNotification(notification.id);
            }
          }}
        >
          <div className="notification-icon">{getIcon(notification.type)}</div>
          <div className="notification-message">{notification.message}</div>
          <button
            className="notification-close"
            onClick={(e) => {
              e.stopPropagation();
              removeNotification(notification.id);
            }}
            type="button"
            aria-label="Close notification"
          >
            <CloseIcon style={{ fontSize: '16px' }} />
          </button>
        </div>
      ))}
    </div>
  );
};
