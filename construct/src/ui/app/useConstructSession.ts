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
};

export const useConstructSession = (active: boolean): UseConstructSessionResult => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<ConstructSession | null>(null);

  const [propDoc, setPropDoc] = useState<PropDocument>(() => createEmptyPropDocument());
  const [actorDoc, setActorDoc] = useState<ActorDocument>(() => createEmptyActorDocument());
  const [actorBoneNames, setActorBoneNames] = useState<string[]>([]);
  const [sessionReady, setSessionReady] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (sessionRef.current) return;

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
    };
  }, [active]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    session.setActive(active);
  }, [active, sessionReady]);

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

    return () => {
      session.setPropDocumentListener(null);
      session.setActorDocumentListener(null);
    };
  }, [active, sessionReady]);

  useEffect(() => {
    if (active) return;

    const session = sessionRef.current;
    if (!session) return;

    session.unload();
    sessionRef.current = null;
  }, [active]);

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
  };
};
