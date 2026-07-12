import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { DEFAULT_MODEL_PATH } from '../../catalog/manifest/defaults.ts';
import {
  type KaykitManifest,
  type KaykitManifestEntry,
  type KaykitTextureVariant,
} from '../../catalog/manifest/kaykitManifest.ts';
import { mapTextureVariants, resolveManifestEntryForAssetUrl } from '../../catalog/manifest/manifestLookup.ts';
import { type ActorDocument } from '../../catalog/actors/actorDocument.ts';
import { type ConstructSession } from '../../globals/bootstrap.ts';
import { scopeExplorerDirPath } from '../explorer/AssetExplorer.tsx';
import { expandVariantPaths } from './useManifestExplorer.ts';
import { type ConstructMode } from '../menu/AppMenu.tsx';

export type UseConstructViewerParams = {
  active: boolean;
  mode: ConstructMode;
  sessionRef: RefObject<ConstructSession | null>;
  sessionReady: number;
  manifest: KaykitManifest | null;
  entriesByPath: Map<string, KaykitManifestEntry>;
  selectedEntry: KaykitManifestEntry | null;
  setSelectedPath: (path: string | null) => void;
  setSelectedEntry: (entry: KaykitManifestEntry | null) => void;
  setExpanded: (updater: (prev: Set<string>) => Set<string>) => void;
  actorCharacter: ActorDocument['character'];
  setStatus: (status: string) => void;
};

export const useConstructViewer = ({
  active,
  mode,
  sessionRef,
  sessionReady,
  manifest,
  entriesByPath,
  selectedEntry,
  setSelectedPath,
  setSelectedEntry,
  setExpanded,
  actorCharacter,
  setStatus,
}: UseConstructViewerParams) => {
  const defaultLoadedRef = useRef(false);

  const [animPackUrl, setAnimPackUrl] = useState<string | null>(null);
  const [clipName, setClipName] = useState<string | null>(null);
  const [availableClipNames, setAvailableClipNames] = useState<string[]>([]);
  const [animPaused, setAnimPaused] = useState(false);
  const [textureVariants, setTextureVariants] = useState<KaykitTextureVariant[]>([]);
  const [textureVariantUrl, setTextureVariantUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    if (!sessionRef.current) return;
    if (mode === 'prop' || mode === 'actor') return;

    defaultLoadedRef.current = false;
  }, [active, mode]);

  useEffect(() => {
    if (active) return;

    defaultLoadedRef.current = false;
  }, [active]);

  const loadEntry = async (entry: KaykitManifestEntry) => {
    const session = sessionRef.current;
    if (!session) return;

    const url = `${import.meta.env.BASE_URL}${entry.url}`;
    const altVariants = mapTextureVariants(entry);

    setStatus('Loading model…');
    setAvailableClipNames([]);
    setClipName(null);
    setAnimPackUrl(null);
    setAnimPaused(false);
    setTextureVariants(altVariants);
    setTextureVariantUrl(null);

    try {
      const loaded = await session.loadModel(url, altVariants);
      setTextureVariantUrl(loaded.activeTextureVariantUrl);
      setStatus(loaded.kind === 'CharacterModel' ? 'Character loaded.' : 'Asset loaded.');
    } catch (err) {
      setStatus(`Load error: ${String(err)}`);
    }
  };

  useEffect(() => {
    if (!active) return;
    if (!manifest) return;
    if (!sessionRef.current) return;
    if (defaultLoadedRef.current) return;
    if (mode !== 'preview') return;

    const entry = entriesByPath.get(DEFAULT_MODEL_PATH);
    if (!entry) {
      setStatus('Default asset missing from manifest.');
      return;
    }

    defaultLoadedRef.current = true;
    setSelectedPath(entry.path);
    setSelectedEntry(entry);
    setExpanded((prev) => expandVariantPaths(prev, entry.path, 'assets'));
    void loadEntry(entry);
  }, [active, manifest, entriesByPath, mode, sessionReady]);

  const compatibleAnimPacks = useMemo(() => {
    if (!manifest) return [];

    const characterEntry =
      mode === 'actor' && actorCharacter
        ? resolveManifestEntryForAssetUrl(actorCharacter.url, entriesByPath)
        : selectedEntry;

    if (!characterEntry || characterEntry.kind !== 'CharacterModel' || characterEntry.boneCount <= 0) {
      return [];
    }

    const seen = new Set<string>();

    return manifest.entries
      .filter((e) => e.kind === 'AnimationSet')
      .filter((e) => {
        const name = e.path.split('/').slice(-1)[0] ?? e.path;
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  }, [manifest, selectedEntry, mode, actorCharacter, entriesByPath]);

  const canAnimatePreview = useMemo(
    () => !!selectedEntry && selectedEntry.kind === 'CharacterModel' && selectedEntry.boneCount > 0,
    [selectedEntry],
  );

  const canAnimateActor = useMemo(() => {
    if (!actorCharacter) return false;
    const entry = resolveManifestEntryForAssetUrl(actorCharacter.url, entriesByPath);
    return !!entry && entry.kind === 'CharacterModel' && entry.boneCount > 0;
  }, [actorCharacter, entriesByPath]);

  const canSwitchTexture = useMemo(() => textureVariants.length > 0, [textureVariants]);

  const handleTextureVariantChange = (url: string | null) => {
    setTextureVariantUrl(url);

    const session = sessionRef.current;
    if (!session) return;

    void (async () => {
      try {
        await session.setTextureVariant(url);
      } catch (err) {
        setStatus(`Texture variant error: ${String(err)}`);
      }
    })();
  };

  const handleAnimPackChange = (url: string | null) => {
    setAnimPackUrl(url);

    const session = sessionRef.current;
    if (!session) return;

    if (!url) {
      session.clearAnimationPreview();
      setAvailableClipNames([]);
      setClipName(null);
      setAnimPaused(false);
      return;
    }

    setStatus('Loading animation pack…');
    void (async () => {
      try {
        const loaded = await session.loadAnimationPack(`${import.meta.env.BASE_URL}${url}`);
        setAvailableClipNames(loaded.clipNames);
        const nextClip = loaded.clipNames[0] ?? null;
        setClipName(nextClip);
        setAnimPaused(false);
        if (nextClip) session.applyClip(nextClip);
        setStatus('Ready.');
      } catch (err) {
        setStatus(`Animation load error: ${String(err)}`);
      }
    })();
  };

  const handleClipChange = (next: string | null) => {
    setClipName(next);

    const session = sessionRef.current;
    if (!session) return;

    if (!next) {
      session.resetToBindPose();
      setAnimPaused(false);
      return;
    }

    session.applyClip(next);
    setAnimPaused(false);
  };

  const handleAnimPlayPause = () => {
    const session = sessionRef.current;
    if (!session) return;

    const nextPaused = !animPaused;
    session.setAnimationPaused(nextPaused);
    setAnimPaused(nextPaused);
  };

  const handleAnimReset = () => {
    const session = sessionRef.current;
    if (!session) return;

    session.clearAnimationPreview();
    setAnimPackUrl(null);
    setAvailableClipNames([]);
    setClipName(null);
    setAnimPaused(false);
  };

  return {
    loadEntry,
    animPackUrl,
    setAnimPackUrl,
    clipName,
    setClipName,
    availableClipNames,
    setAvailableClipNames,
    animPaused,
    textureVariants,
    textureVariantUrl,
    setTextureVariantUrl,
    compatibleAnimPacks,
    canAnimatePreview,
    canAnimateActor,
    canSwitchTexture,
    handleTextureVariantChange,
    handleAnimPackChange,
    handleClipChange,
    handleAnimPlayPause,
    handleAnimReset,
  };
};

export type UseConstructViewerResult = ReturnType<typeof useConstructViewer>;
