export type Input = {
  down: (code: string) => boolean;
  pressed: (code: string) => boolean;
  mouseDown: (button: number) => boolean;
  mousePressed: (button: number) => boolean;
  mouseDelta: () => { dx: number; dy: number };
  pointerLocked: () => boolean;
  commitFrame: () => void;
};

export const createInput = (target: Window = window, pointerLockEl?: HTMLElement): Input => {
  const held = new Set<string>();
  const pressedThisFrame = new Set<string>();
  const heldMouse = new Set<number>();
  const pressedMouseThisFrame = new Set<number>();
  let mouseDX = 0;
  let mouseDY = 0;

  target.addEventListener('keydown', (e) => {
    if (!held.has(e.code)) pressedThisFrame.add(e.code);
    held.add(e.code);
  });
  target.addEventListener('keyup', (e) => { held.delete(e.code); });

  target.addEventListener('mousedown', (e) => {
    if (!heldMouse.has(e.button)) pressedMouseThisFrame.add(e.button);
    heldMouse.add(e.button);

    if (pointerLockEl) {
      if (document.pointerLockElement === pointerLockEl) document.exitPointerLock();
      else pointerLockEl.requestPointerLock();
    }
  });
  target.addEventListener('mouseup', (e) => { heldMouse.delete(e.button); });

  target.addEventListener('mousemove', (e) => {
    if (pointerLockEl && document.pointerLockElement === pointerLockEl) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
      return;
    }
    if (heldMouse.size > 0) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
    }
  });

  if (pointerLockEl) pointerLockEl.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    down: (code) => held.has(code),
    pressed: (code) => pressedThisFrame.has(code),
    mouseDown: (button) => heldMouse.has(button),
    mousePressed: (button) => pressedMouseThisFrame.has(button),
    mouseDelta: () => ({ dx: mouseDX, dy: mouseDY }),
    pointerLocked: () => (pointerLockEl ? document.pointerLockElement === pointerLockEl : false),
    commitFrame: () => {
      pressedThisFrame.clear();
      pressedMouseThisFrame.clear();
      mouseDX = 0;
      mouseDY = 0;
    },
  };
};
