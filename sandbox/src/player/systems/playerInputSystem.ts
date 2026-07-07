import {
  type Registry,
  type Input,
  type Transform,
  type CameraFollow,
  type LocomotionIntent,
  type CharacterController,
  COMPONENT_KEYS,
  v3Set,
} from 'viberanium';
import { PLAYER_CONTROLLER_KEY, type PlayerController } from '../components/playerController.ts';

export const installPlayerInputSystem = (registry: Registry, input: Input) => {
  registry.addAction('update', () => {
    let camYaw = 0;
    for (const e of registry.view(COMPONENT_KEYS.cameraFollow)) {
      camYaw = (e.components[COMPONENT_KEYS.cameraFollow] as CameraFollow).yawRad;
      break;
    }
    const sinY = Math.sin(camYaw);
    const cosY = Math.cos(camYaw);

    for (const e of registry.view(PLAYER_CONTROLLER_KEY)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      const intent = e.components[COMPONENT_KEYS.locomotionIntent] as LocomotionIntent | undefined;
      const pc = e.components[PLAYER_CONTROLLER_KEY] as PlayerController;
      if (!t || !cc || !intent) continue;

      if (input.pressed(pc.resetKey)) {
        t.position[0] = 0;
        t.position[1] = 1.6;
        t.position[2] = 0;
        cc.velocity[0] = cc.velocity[1] = cc.velocity[2] = 0;
        cc.onGround = false;
        cc.jumpPhase = 'none';
        cc.jumpClipTime = 0;
        cc.locomotionAnimTime = 0;
        cc.locomotionBlend = 1;
        t.dirty = true;
      }

      let mx = 0;
      let mz = 0;
      if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
      if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
      if (input.down('KeyW') || input.down('ArrowUp')) mz -= 1;
      if (input.down('KeyS') || input.down('ArrowDown')) mz += 1;

      const len = Math.hypot(mx, mz);
      if (len > 1e-6) { mx /= len; mz /= len; }

      const forwardAmt = -mz;
      v3Set(
        intent.desiredVelocity,
        (cosY * mx + -sinY * forwardAmt) * cc.moveSpeed,
        0,
        (-sinY * mx + -cosY * forwardAmt) * cc.moveSpeed,
      );
      intent.jumpRequested = input.pressed('Space');
    }
  }, 5);
};
