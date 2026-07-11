import { useEffect, useMemo, useState } from 'react';
import { SandboxApp } from 'sandbox';
import { ConstructApp } from 'construct';

type ActiveApp = 'sandbox' | 'construct';

export const App = () => {
  const [active, setActive] = useState<ActiveApp>('sandbox');

  const onToggle = useMemo(
    () => (next?: ActiveApp) => {
      setActive((cur) => next ?? (cur === 'sandbox' ? 'construct' : 'sandbox'));
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'F1') return;

      e.preventDefault();
      onToggle();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); };
  }, [onToggle]);

  useEffect(() => {
    if (active !== 'construct') return;

    if (document.pointerLockElement) document.exitPointerLock();
  }, [active]);

  return (
    <div className="lander-root">
      {active === 'sandbox' ? (
        <div className="app-layer" data-active="true">
          <SandboxApp active />
        </div>
      ) : (
        <div className="app-layer" data-active="true">
          <ConstructApp active />
        </div>
      )}
    </div>
  );
};
