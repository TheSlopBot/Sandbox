export type Input = {
  down: (code: string) => boolean;
  pressed: (code: string) => boolean;
  mouseDown: (button: number) => boolean;
  mousePressed: (button: number) => boolean;
  mouseDelta: () => { dx: number; dy: number };
  pointerLocked: () => boolean;
  commitFrame: () => void;
  destroy: () => void;
};

export const createInput = (target: Window = window, pointerLockEl?: HTMLElement): Input => {
  const held = new Set<string>();
  const pressedThisFrame = new Set<string>();
  const heldMouse = new Set<number>();
  const pressedMouseThisFrame = new Set<number>();
  let mouseDX = 0;
  let mouseDY = 0;

  const onKeyDown = (e: KeyboardEvent) => {
    if (!held.has(e.code)) pressedThisFrame.add(e.code);
    held.add(e.code);
  };

  const onKeyUp = (e: KeyboardEvent) => { held.delete(e.code); };

  const onMouseDown = (e: MouseEvent) => {
    if (!heldMouse.has(e.button)) pressedMouseThisFrame.add(e.button);
    heldMouse.add(e.button);

    if (pointerLockEl) {
      const targetNode = e.target;
      const isOnPointerLockEl = targetNode instanceof Node && pointerLockEl.contains(targetNode);
      if (!isOnPointerLockEl) return;

      if (document.pointerLockElement === pointerLockEl) document.exitPointerLock();
      else pointerLockEl.requestPointerLock();
    }
  };

  const onMouseUp = (e: MouseEvent) => { heldMouse.delete(e.button); };

  const onMouseMove = (e: MouseEvent) => {
    if (pointerLockEl && document.pointerLockElement === pointerLockEl) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
      return;
    }
    if (heldMouse.size > 0) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
    }
  };

  const onContextMenu = (e: MouseEvent) => e.preventDefault();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('mousedown', onMouseDown);
  target.addEventListener('mouseup', onMouseUp);
  target.addEventListener('mousemove', onMouseMove);

  if (pointerLockEl) pointerLockEl.addEventListener('contextmenu', onContextMenu);

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
    destroy: () => {
      held.clear();
      pressedThisFrame.clear();
      heldMouse.clear();
      pressedMouseThisFrame.clear();
      mouseDX = 0;
      mouseDY = 0;

      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('mousedown', onMouseDown);
      target.removeEventListener('mouseup', onMouseUp);
      target.removeEventListener('mousemove', onMouseMove);

      if (pointerLockEl) pointerLockEl.removeEventListener('contextmenu', onContextMenu);
    },
  };
};
