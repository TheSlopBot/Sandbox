import { useEffect, useRef, useState } from 'react';

export type OrientationCubeAngles = {
  yawRad: number;
  pitchRad: number;
};

export type OrientationCubeProps = {
  getAngles: () => OrientationCubeAngles;
};

type FaceDef = {
  key: string;
  label: string;
  axis: 'x' | 'y' | 'z';
};

const FACES: readonly FaceDef[] = [
  { key: 'posX', label: 'x', axis: 'x' },
  { key: 'negX', label: '-x', axis: 'x' },
  { key: 'posY', label: 'y', axis: 'y' },
  { key: 'negY', label: '-y', axis: 'y' },
  { key: 'posZ', label: 'z', axis: 'z' },
  { key: 'negZ', label: '-z', axis: 'z' },
];

export const OrientationCube = ({ getAngles }: OrientationCubeProps) => {
  const getAnglesRef = useRef(getAngles);
  getAnglesRef.current = getAngles;

  const [angles, setAngles] = useState<OrientationCubeAngles>(() => getAngles());

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      const next = getAnglesRef.current();
      setAngles((prev) => {
        if (prev.yawRad === next.yawRad && prev.pitchRad === next.pitchRad) return prev;
        return next;
      });
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const yawDeg = (angles.yawRad * 180) / Math.PI;
  const pitchDeg = (angles.pitchRad * 180) / Math.PI;

  return (
    <div className="construct-orientationCube" aria-hidden="true">
      <div
        className="construct-orientationCubeScene"
        style={{
          transform: `rotateX(${-pitchDeg}deg) rotateY(${-yawDeg}deg)`,
        }}
      >
        {FACES.map((face) => (
          <div
            key={face.key}
            className={`construct-orientationCubeFace construct-orientationCubeFace--${face.key}`}
            data-axis={face.axis}
          >
            <span>{face.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
