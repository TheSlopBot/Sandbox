import { useEffect, useMemo, useState } from 'react';
import { SandboxApp } from '../../sandbox/src/SandboxApp.tsx';
import { PreviewApp } from '../../preview/src/PreviewApp.tsx';

type ActiveApp = 'sandbox' | 'preview';

export const App = () => {
  const [active, setActive] = useState<ActiveApp>('sandbox');

  const onToggle = useMemo(
    () => (next?: ActiveApp) => {
      setActive((cur) => next ?? (cur === 'sandbox' ? 'preview' : 'sandbox'));
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
    if (active !== 'preview') return;

    if (document.pointerLockElement) document.exitPointerLock();
  }, [active]);

  return (
    <div className="lander-root">
      <div className="app-layer" data-active={active === 'sandbox'}>
        <SandboxApp active={active === 'sandbox'} />
      </div>
      <div className="app-layer" data-active={active === 'preview'}>
        <PreviewApp active={active === 'preview'} />
      </div>
    </div>
  );
};

