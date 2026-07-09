import {
  type Registry,
  type Input,
  type Transform,
  type CameraFollow,
  type MovementIntent,
  type CharacterController,
  type AnimationStateMachine,
  removeChildId,
  COMPONENT_KEYS,
  v3Set,
} from 'viberanium';
import { spawnAttachmentFromLoad } from '../../character/spawnSkeletalCharacter.ts';
import { PLAYER_CONTROLLER_KEY, type PlayerController } from '../components/playerController.ts';
import { PLAYER_HELMET_KEY } from '../components/playerHelmet.ts';

const anyDown = (input: Input, keys: readonly string[]) => keys.some((key) => input.down(key));

export const installPlayerInputSystem = (registry: Registry, input: Input, gl: WebGL2RenderingContext) => {
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
      const intent = e.components[COMPONENT_KEYS.movementIntent] as MovementIntent | undefined;
      const fsm = e.components[COMPONENT_KEYS.animationStateMachine] as AnimationStateMachine | undefined;
      const pc = e.components[PLAYER_CONTROLLER_KEY] as PlayerController;
      if (!t || !cc || !intent) continue;

      if (input.pressed(pc.resetKey)) {
        t.position[0] = 0;
        t.position[1] = 1.6;
        t.position[2] = 0;
        cc.velocity[0] = cc.velocity[1] = cc.velocity[2] = 0;
        cc.onGround = false;
        if (fsm) {
          fsm.current = 'idle';
          fsm.stateTime = 0;
          fsm.animTime = 0;
        }
        t.dirty = true;
      }

      if (input.pressed(pc.toggleHelmetKey)) {
        const children = e.components[COMPONENT_KEYS.children] as { ids: number[] } | undefined;

        if (pc.helmetEntityId !== null) {
          if (children) removeChildId(children, pc.helmetEntityId);
          registry.deregister(pc.helmetEntityId);
          pc.helmetEntityId = null;
        } else if (pc.stowedHelmet) {
          const helmetEntity = spawnAttachmentFromLoad(
            registry,
            gl,
            e.id,
            e,
            pc.stowedHelmet,
            PLAYER_HELMET_KEY,
          );
          pc.helmetEntityId = helmetEntity.id;
        }
      }

      let mx = 0;
      let mz = 0;
      if (anyDown(input, pc.moveLeftKeys)) mx -= 1;
      if (anyDown(input, pc.moveRightKeys)) mx += 1;
      if (anyDown(input, pc.moveForwardKeys)) mz -= 1;
      if (anyDown(input, pc.moveBackwardKeys)) mz += 1;

      const len = Math.hypot(mx, mz);
      if (len > 1e-6) { mx /= len; mz /= len; }

      const forwardAmt = -mz;
      v3Set(
        intent.desiredVelocity,
        (cosY * mx + -sinY * forwardAmt) * cc.moveSpeed,
        0,
        (-sinY * mx + -cosY * forwardAmt) * cc.moveSpeed,
      );
      intent.jumpRequested = input.pressed(pc.jumpKey);
    }
  }, 5);
};
