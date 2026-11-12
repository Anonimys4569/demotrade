import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Sheet } from './ui';

const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const isSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua);
const isStandalone = () =>
  (navigator as unknown as { standalone?: boolean }).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

/** Чи це сайт у браузері (а не встановлений додаток) */
export const canInstall = () =>
  !Capacitor.isNativePlatform() && location.protocol.startsWith('http') && !isStandalone();

const ShareIcon = () => (
  <svg className="share-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15V3m0 0L8 7m4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
  </svg>
);

export function InstallSheet({ onClose }: { onClose(): void }) {
  const [os, setOs] = useState<'ios' | 'android'>(isAndroid ? 'android' : 'ios');
  return (
    <Sheet title="Встановити DemoTrade" onClose={onClose}>
      <div className="seg">
        <button className={os === 'ios' ? 'on' : ''} onClick={() => setOs('ios')}>
          iPhone
        </button>
        <button className={os === 'android' ? 'on' : ''} onClick={() => setOs('android')}>
          Android
        </button>
      </div>

      {os === 'ios' ? (
        <>
          {isIOS && !isSafari && (
            <p className="note warnbox">Зараз сайт відкрито не в Safari. Скопіюй адресу і відкрий її саме в Safari.</p>
          )}
          <ol className="steps">
            <li>
              <span>
                Відкрий цей сайт у <b>Safari</b>.
              </span>
            </li>
            <li>
              <span>
                Натисни кнопку <b>«Поділитися»</b> <ShareIcon /> внизу екрана.
              </span>
            </li>
            <li>
              <span>
                Прогорни список і вибери <b>«На початковий екран»</b>.
              </span>
            </li>
            <li>
              <span>
                Натисни <b>«Додати»</b> у правому верхньому куті.
              </span>
            </li>
            <li>
              <span>
                Закрий Safari і запусти <b>DemoTrade</b> з іконки на екрані.
              </span>
            </li>
          </ol>
          <p className="note">
            Кабель, комп’ютер і Apple ID не потрібні, перевстановлювати кожні 7 днів теж не треба. Після першого запуску
            додаток відкривається і без інтернету.
          </p>
        </>
      ) : (
        <>
          <ol className="steps">
            <li>
              <span>
                Відкрий цей сайт у <b>Chrome</b>.
              </span>
            </li>
            <li>
              <span>
                Натисни меню <b>⋮</b> у правому верхньому куті.
              </span>
            </li>
            <li>
              <span>
                Вибери <b>«Встановити додаток»</b> або <b>«Додати на головний екран»</b>.
              </span>
            </li>
            <li>
              <span>
                Підтверди і запусти <b>DemoTrade</b> з іконки на екрані.
              </span>
            </li>
          </ol>
        </>
      )}
      <p className="note">
        Торгуй саме в додатку з іконки: у нього власне сховище, тому баланс із вкладки браузера туди не переноситься.
        Перенести прогрес можна через Активи → Налаштування → «Резервна копія».
      </p>
      <button className="btn primary block" onClick={onClose}>
        Зрозуміло
      </button>
    </Sheet>
  );
}

/** Сама показує інструкцію, коли сайт уперше відкрили на телефоні */
export function AutoInstallHint() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!canInstall() || !(isIOS || isAndroid)) return;
    try {
      if (localStorage.getItem('dt_install_seen')) return;
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, []);
  if (!open) return null;
  return (
    <InstallSheet
      onClose={() => {
        try {
          localStorage.setItem('dt_install_seen', '1');
        } catch {
          /* ignore */
        }
        setOpen(false);
      }}
    />
  );
}
