import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { bootstrap, type ConstructSession } from '../../globals/bootstrap.ts';
import {
  type ActorDocument,
  createEmptyActorDocument,
} from '../../catalog/actors/actorDocument.ts';
import { type PropDocument, createEmptyPropDocument } from '../../catalog/props/propDocument.ts';
import { type LevelDocument, createEmptyLevelDocument } from '../../catalog/levels/levelDocument.ts';

export const cloneActorDoc = (doc: ActorDocument): ActorDocument => ({
  ...doc,
  tags: [...doc.tags],
  character: doc.character ? { ...doc.character } : null,
  attachments: doc.attachments.map((a) => ({ ...a, tags: [...a.tags] })),
  colliders: doc.colliders.map((c) => ({
    ...c,
    parent: { ...c.parent },
    halfExtents: c.halfExtents ? ([...c.halfExtents] as [number, number, number]) : undefined,
  })),
});

export type UseConstructSessionResult = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sessionRef: RefObject<ConstructSession | null>;
  sessionReady: number;
  propDoc: PropDocument;
  setPropDoc: Dispatch<SetStateAction<PropDocument>>;
  actorDoc: ActorDocument;
  setActorDoc: Dispatch<SetStateAction<ActorDocument>>;
  actorBoneNames: string[];
  setActorBoneNames: Dispatch<SetStateAction<string[]>>;
  levelDoc: LevelDocument;
  setLevelDoc: Dispatch<SetStateAction<LevelDocument>>;
};

export const useConstructSession = (active: boolean): UseConstructSessionResult => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<ConstructSession | null>(null);

  const [propDoc, setPropDoc] = useState<PropDocument>(() => createEmptyPropDocument());
  const [actorDoc, setActorDoc] = useState<ActorDocument>(() => createEmptyActorDocument());
  const [actorBoneNames, setActorBoneNames] = useState<string[]>([]);
  const [levelDoc, setLevelDoc] = useState<LevelDocument>(() => createEmptyLevelDocument());
  const [sessionReady, setSessionReady] = useState(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    void bootstrap(canvas).then((session) => {
      if (cancelled) {
        session.unload();
        return;
      }

      sessionRef.current = session;
      session.setActive(true);
      setSessionReady((n) => n + 1);
    });

    return () => {
      cancelled = true;

      const session = sessionRef.current;
      if (!session) return;

      session.setPropDocumentListener(null);
      session.setActorDocumentListener(null);
      session.setLevelDocumentListener(null);
      session.unload();
      sessionRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    session.setPropDocumentListener((doc) => {
      setPropDoc({ ...doc, parts: [...doc.parts] });
    });
    session.setActorDocumentListener((doc) => {
      setActorDoc(cloneActorDoc(doc));
      setActorBoneNames(session.getActorBoneNames());
    });
    session.setLevelDocumentListener((doc) => {
      setLevelDoc(doc);
    });

    return () => {
      session.setPropDocumentListener(null);
      session.setActorDocumentListener(null);
      session.setLevelDocumentListener(null);
    };
  }, [sessionReady]);

  return {
    canvasRef,
    sessionRef,
    sessionReady,
    propDoc,
    setPropDoc,
    actorDoc,
    setActorDoc,
    actorBoneNames,
    setActorBoneNames,
    levelDoc,
    setLevelDoc,
  };
};
