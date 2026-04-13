export type PhoneNotification = {
  id: string;
  app: string;
  icon: string;
  iconBg: string;
  time: string;
  text: string;
  sub: string | null;
  hasDot?: boolean;
  highlight?: boolean;
};

type PhoneMockupProps = {
  notifications: PhoneNotification[];
  singleMode?: boolean;
  size?: 'small' | 'large';
  mode?: 'lockscreen' | 'app';
  children?: React.ReactNode;
};

export default function PhoneMockup({
  notifications,
  singleMode = false,
  size = 'small',
  mode = 'lockscreen',
  children
}: PhoneMockupProps) {
  return (
    <div
      className={`phone-mockup phone-mockup--${size}${mode === 'app' ? ' phone-mockup--app' : ''}`}
      aria-label="Dealify lockscreen με ειδοποιήσεις"
    >
      <div className="phone-mockup__screen">
        <div className="phone-mockup__island" />

        {mode === 'app' ? (
          <div className="phone-mockup__app-screen">{children}</div>
        ) : (
          <>
            <div className="phone-mockup__lockscreen">
              <div className="phone-mockup__time">9:41</div>
              <div className="phone-mockup__date">Σάββατο, 5 Απριλίου</div>
            </div>

            <div className={`phone-mockup__notifications${singleMode ? ' phone-mockup__notifications--single' : ''}`}>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notif-card${notification.highlight ? ' notif-card--highlight' : ''}`}
                  id={`notif-${notification.id}`}
                >
                  <div className="notif-card__icon" style={{ backgroundColor: notification.iconBg }}>
                    <span>{notification.icon}</span>
                  </div>

                  <div className="notif-card__body">
                    <div className="notif-card__meta">
                      <span className="notif-card__app">{notification.app}</span>
                      <span className="notif-card__time">{notification.time}</span>
                    </div>

                    <div className="notif-card__text">
                      {notification.hasDot ? <span className="notif-card__dot" aria-hidden="true" /> : null}
                      <span>{notification.text}</span>
                    </div>

                    {notification.sub ? <div className="notif-card__sub">{notification.sub}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
