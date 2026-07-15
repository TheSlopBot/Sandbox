import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  EQUIPMENT_SLOT_TAGS,
  type EquipmentClipBinding,
  type EquipmentDocument,
  type EquipmentDocumentProjectile,
  type EquipmentEditorSelection,
} from '../../catalog/equipment/equipmentDocument.ts';
import { type KaykitManifestEntry } from '../../catalog/manifest/kaykitManifest.ts';
import { createEulerQuat, quatToEulerDegrees } from './euler.ts';
import { AxisRow, DetailsHeader, formatNum, parseNum, type AxisKey } from './shared.tsx';

const ALL_AXES: readonly AxisKey[] = ['x', 'y', 'z'];
const DEFAULT_HIT_WINDOW_START = 0.2;
const DEFAULT_HIT_WINDOW_END = 0.55;
const HIT_WINDOW_MIN_GAP = 0.01;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const snapFrac = (n: number) => Math.round(clamp01(n) * 1000) / 1000;

const HitWindowSlider = ({
  start,
  end,
  onChange,
}: {
  start: number | undefined;
  end: number | undefined;
  onChange: (next: { hitWindowStart: number; hitWindowEnd: number }) => void;
}) => {
  const startValue = start ?? DEFAULT_HIT_WINDOW_START;
  const endValue = end ?? DEFAULT_HIT_WINDOW_END;
  const [startDraft, setStartDraft] = useState(formatNum(startValue));
  const [endDraft, setEndDraft] = useState(formatNum(endValue));
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<'start' | 'end' | null>(null);
  const valuesRef = useRef({ startValue, endValue, onChange });
  valuesRef.current = { startValue, endValue, onChange };

  useEffect(() => {
    setStartDraft(formatNum(startValue));
  }, [startValue]);

  useEffect(() => {
    setEndDraft(formatNum(endValue));
  }, [endValue]);

  useEffect(() => {
    const fractionFromClientX = (clientX: number) => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      return clamp01((clientX - rect.left) / rect.width);
    };

    const applyDrag = (clientX: number) => {
      const handle = dragRef.current;
      if (!handle) return;
      const { startValue: s, endValue: e, onChange: commit } = valuesRef.current;
      const t = fractionFromClientX(clientX);
      if (handle === 'start') {
        commit({
          hitWindowStart: snapFrac(Math.min(t, e - HIT_WINDOW_MIN_GAP)),
          hitWindowEnd: e,
        });
        return;
      }
      commit({
        hitWindowStart: s,
        hitWindowEnd: snapFrac(Math.max(t, s + HIT_WINDOW_MIN_GAP)),
      });
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      ev.preventDefault();
      applyDrag(ev.clientX);
    };
    const onPointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  const beginDrag = (handle: 'start' | 'end', ev: ReactPointerEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    dragRef.current = handle;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const t = clamp01((ev.clientX - rect.left) / rect.width);
    const { startValue: s, endValue: e, onChange: commit } = valuesRef.current;
    if (handle === 'start') {
      commit({
        hitWindowStart: snapFrac(Math.min(t, e - HIT_WINDOW_MIN_GAP)),
        hitWindowEnd: e,
      });
      return;
    }
    commit({
      hitWindowStart: s,
      hitWindowEnd: snapFrac(Math.max(t, s + HIT_WINDOW_MIN_GAP)),
    });
  };

  const onTrackPointerDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const t = clamp01((ev.clientX - rect.left) / rect.width);
    const distStart = Math.abs(t - startValue);
    const distEnd = Math.abs(t - endValue);
    beginDrag(distStart <= distEnd ? 'start' : 'end', ev);
  };

  const commitStartDraft = () => {
    const next = snapFrac(Math.min(parseNum(startDraft, startValue), endValue - HIT_WINDOW_MIN_GAP));
    setStartDraft(formatNum(next));
    onChange({ hitWindowStart: next, hitWindowEnd: endValue });
  };

  const commitEndDraft = () => {
    const next = snapFrac(Math.max(parseNum(endDraft, endValue), startValue + HIT_WINDOW_MIN_GAP));
    setEndDraft(formatNum(next));
    onChange({ hitWindowStart: startValue, hitWindowEnd: next });
  };

  const startPct = `${startValue * 100}%`;
  const endPct = `${endValue * 100}%`;
  const widthPct = `${(endValue - startValue) * 100}%`;

  return (
    <div className="construct-hitWindow">
      <div className="construct-hitWindowLabel">Hit window</div>
      <div className="construct-hitWindowRow">
        <input
          className="construct-detailsInput construct-hitWindowInput"
          value={startDraft}
          aria-label="Hit window start"
          onChange={(ev) => setStartDraft(ev.target.value)}
          onBlur={commitStartDraft}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') ev.currentTarget.blur();
          }}
        />
        <div
          ref={trackRef}
          className="construct-hitWindowTrack"
          onPointerDown={onTrackPointerDown}
        >
          <div
            className="construct-hitWindowRange"
            style={{ left: startPct, width: widthPct }}
          />
          <button
            type="button"
            className="construct-hitWindowThumb"
            style={{ left: startPct }}
            aria-label="Hit window start handle"
            onPointerDown={(ev) => beginDrag('start', ev)}
          />
          <button
            type="button"
            className="construct-hitWindowThumb"
            style={{ left: endPct }}
            aria-label="Hit window end handle"
            onPointerDown={(ev) => beginDrag('end', ev)}
          />
        </div>
        <input
          className="construct-detailsInput construct-hitWindowInput"
          value={endDraft}
          aria-label="Hit window end"
          onChange={(ev) => setEndDraft(ev.target.value)}
          onBlur={commitEndDraft}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') ev.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
};

export type EquipmentDetailsProps = {
  doc: EquipmentDocument;
  selection: EquipmentEditorSelection;
  animPacks: KaykitManifestEntry[];
  onRenameEquipment: () => void;
  onKindChange: (kind: EquipmentDocument['kind']) => void;
  onSlotTagsChange: (tags: string[]) => void;
  onStatsChange: (partial: Partial<EquipmentDocument['stats']>) => void;
  onClipsChange: (partial: Partial<EquipmentDocument['clips']>) => void;
  onProjectileChange: (projectile: EquipmentDocumentProjectile | undefined) => void;
  onCommitLocal: (
    partId: string,
    patch: {
      position?: [number, number, number];
      scale?: [number, number, number];
      rotation?: [number, number, number, number];
    },
  ) => void;
  onColliderRename: (colliderId: string, name: string) => void;
  onColliderRoleChange: (colliderId: string, role: 'weapon' | 'shield') => void;
  onColliderDelete: (colliderId: string) => void;
  onClearMesh: () => void;
};

const NumberField = ({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
}) => {
  const [draft, setDraft] = useState(value === undefined ? '' : formatNum(value));

  useEffect(() => {
    setDraft(value === undefined ? '' : formatNum(value));
  }, [value]);

  return (
    <label className="construct-detailsField">
      <span>{label}</span>
      <input
        className="construct-detailsInput"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (!trimmed) {
            onCommit(undefined);
            setDraft('');
            return;
          }
          const next = parseNum(trimmed, value ?? 0);
          setDraft(formatNum(next));
          onCommit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
};

const packLabel = (entry: KaykitManifestEntry) => entry.path.split('/').slice(-1)[0] ?? entry.path;

const AnimationClipRow = ({
  label,
  value,
  animPacks,
  onCommit,
}: {
  label: string;
  value: EquipmentClipBinding | undefined;
  animPacks: KaykitManifestEntry[];
  onCommit: (next: EquipmentClipBinding | undefined) => void;
}) => {
  const sortedPacks = [...animPacks].sort((a, b) =>
    packLabel(a).localeCompare(packLabel(b), undefined, { sensitivity: 'base' }),
  );
  const selectedPack =
    sortedPacks.find((p) => {
      const stored = value?.animPackUrl;
      if (!stored) return false;
      if (p.url === stored) return true;
      const prefix = import.meta.env.BASE_URL;
      const relative = stored.startsWith(prefix) ? stored.slice(prefix.length) : stored;
      return p.url === relative;
    }) ?? null;
  const clipNames = [...(selectedPack?.clipNames ?? [])].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  const animPackUrl = selectedPack?.url ?? '';
  const clipName = value?.clipName && clipNames.includes(value.clipName) ? value.clipName : '';

  return (
    <div className="construct-detailsAnimRow">
      <span>{label}</span>
      <select
        className="construct-detailsSelect"
        value={animPackUrl}
        onChange={(e) => {
          const nextUrl = e.target.value || undefined;
          if (!nextUrl) {
            onCommit(undefined);
            return;
          }
          const pack = sortedPacks.find((p) => p.url === nextUrl);
          const nextClips = pack?.clipNames ?? [];
          const keepClip =
            value?.clipName && nextClips.includes(value.clipName) ? value.clipName : undefined;
          onCommit({
            animPackUrl: nextUrl,
            clipName: keepClip ?? nextClips[0],
          });
        }}
      >
        <option value="">(none)</option>
        {sortedPacks.map((p) => (
          <option key={p.path} value={p.url}>
            {packLabel(p)}
          </option>
        ))}
      </select>
      <select
        className="construct-detailsSelect"
        disabled={!animPackUrl || clipNames.length === 0}
        value={clipName}
        onChange={(e) => {
          const nextClip = e.target.value || undefined;
          if (!animPackUrl) {
            onCommit(undefined);
            return;
          }
          if (!nextClip) {
            onCommit({ animPackUrl });
            return;
          }
          onCommit({ animPackUrl, clipName: nextClip });
        }}
      >
        <option value="">(none)</option>
        {clipNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
};

export const EquipmentDetails = ({
  doc,
  selection,
  animPacks,
  onRenameEquipment,
  onKindChange,
  onSlotTagsChange,
  onStatsChange,
  onClipsChange,
  onProjectileChange,
  onCommitLocal,
  onColliderRename,
  onColliderRoleChange,
  onColliderDelete,
  onClearMesh,
}: EquipmentDetailsProps) => {
  const collider =
    selection?.kind === 'collider'
      ? (doc.colliders.find((c) => c.id === selection.colliderId) ?? null)
      : null;
  const [colliderNameDraft, setColliderNameDraft] = useState(collider?.name ?? '');

  useEffect(() => {
    setColliderNameDraft(collider?.name ?? '');
  }, [collider?.id, collider?.name]);

  const header = (
    <DetailsHeader
      displayName={doc.displayName}
      renameLabel="Rename equipment"
      onRename={onRenameEquipment}
    />
  );

  if (!selection || selection.kind === 'root') {
    return (
      <div className="construct-inspector">
        {header}
        <div className="construct-inspectorBody construct-detailsBody">
          <label className="construct-detailsField">
            <span>Kind</span>
            <select
              className="construct-detailsSelect"
              value={doc.kind}
              onChange={(e) => onKindChange(e.target.value as EquipmentDocument['kind'])}
            >
              <option value="melee">Melee</option>
              <option value="ranged">Ranged</option>
              <option value="shield">Shield</option>
            </select>
          </label>
          <div className="construct-detailsSection">
            <div className="construct-detailsSectionTitle">Slot tags</div>
            {EQUIPMENT_SLOT_TAGS.map((tag) => (
              <label key={tag} className="construct-detailsField" style={{ flexDirection: 'row', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={doc.slotTags.includes(tag)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...doc.slotTags, tag]
                      : doc.slotTags.filter((t) => t !== tag);
                    onSlotTagsChange(next);
                  }}
                />
                <span>{tag}</span>
              </label>
            ))}
          </div>
          <div className="construct-detailsSection">
            <div className="construct-detailsSectionTitle">Stats</div>
            <NumberField
              label="Damage"
              value={doc.stats.damage}
              onCommit={(v) => onStatsChange({ damage: v ?? 0 })}
            />
            {doc.kind === 'melee' ? (
              <HitWindowSlider
                start={doc.stats.hitWindowStart}
                end={doc.stats.hitWindowEnd}
                onChange={onStatsChange}
              />
            ) : null}
            {doc.kind === 'ranged' ? (
              <NumberField
                label="Fire rate"
                value={doc.stats.fireRate}
                onCommit={(v) => onStatsChange({ fireRate: v })}
              />
            ) : null}
            {doc.kind === 'shield' ? (
              <NumberField
                label="Block angle (deg)"
                value={doc.stats.blockAngleDeg}
                onCommit={(v) => onStatsChange({ blockAngleDeg: v })}
              />
            ) : null}
          </div>
          <div className="construct-detailsSection">
            <div className="construct-detailsSectionTitle">Animations</div>
            {doc.kind === 'melee' || doc.kind === 'ranged' ? (
              <AnimationClipRow
                label="Attack"
                value={doc.clips.attack}
                animPacks={animPacks}
                onCommit={(v) => onClipsChange({ attack: v })}
              />
            ) : null}
            {doc.kind === 'ranged' ? (
              <>
                <AnimationClipRow
                  label="Aim"
                  value={doc.clips.aim}
                  animPacks={animPacks}
                  onCommit={(v) => onClipsChange({ aim: v })}
                />
                <AnimationClipRow
                  label="Reload"
                  value={doc.clips.reload}
                  animPacks={animPacks}
                  onCommit={(v) => onClipsChange({ reload: v })}
                />
              </>
            ) : null}
            {doc.kind === 'shield' ? (
              <AnimationClipRow
                label="Block"
                value={doc.clips.block}
                animPacks={animPacks}
                onCommit={(v) => onClipsChange({ block: v })}
              />
            ) : null}
            <AnimationClipRow
              label="Idle hold"
              value={doc.clips.idleHold}
              animPacks={animPacks}
              onCommit={(v) => onClipsChange({ idleHold: v })}
            />
          </div>
        </div>
      </div>
    );
  }

  if (selection.kind === 'mesh') {
    return (
      <div className="construct-inspector">
        {header}
        <div className="construct-inspectorBody construct-detailsBody">
          <div className="construct-detailsField">
            <span>Mesh</span>
            <span className="construct-detailsReadonly">
              {doc.mesh.url ? (doc.mesh.url.split('/').slice(-1)[0] ?? doc.mesh.url) : 'None'}
            </span>
          </div>
          {doc.mesh.url ? (
            <>
              <AxisRow
                label="Position"
                values={doc.mesh.position}
                onCommit={(position) => onCommitLocal('mesh', { position })}
              />
              <AxisRow
                label="Scale"
                values={doc.mesh.scale}
                onCommit={(scale) => onCommitLocal('mesh', { scale })}
              />
              <AxisRow
                label="Rotation"
                values={[0, 0, 0]}
                disabledAxes={ALL_AXES}
                onCommit={() => undefined}
              />
              <div className="construct-detailsFooter">
                <button type="button" className="construct-detailsDelete" onClick={onClearMesh}>
                  Clear mesh
                </button>
              </div>
            </>
          ) : (
            <div className="mutedNote">Add a mesh from the explorer.</div>
          )}
        </div>
      </div>
    );
  }

  if (selection.kind === 'collider' && collider) {
    const euler = quatToEulerDegrees(collider.rotation);
    return (
      <div className="construct-inspector">
        {header}
        <div className="construct-inspectorBody construct-detailsBody">
          <label className="construct-detailsField">
            <span>Name</span>
            <input
              className="construct-detailsInput"
              value={colliderNameDraft}
              onChange={(e) => setColliderNameDraft(e.target.value)}
              onBlur={() => {
                const next = colliderNameDraft.trim();
                if (!next || next === collider.name) {
                  setColliderNameDraft(collider.name);
                  return;
                }
                onColliderRename(collider.id, next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          </label>
          <label className="construct-detailsField">
            <span>Role</span>
            <select
              className="construct-detailsSelect"
              value={collider.role}
              onChange={(e) =>
                onColliderRoleChange(collider.id, e.target.value as 'weapon' | 'shield')
              }
            >
              <option value="weapon">Weapon</option>
              <option value="shield">Shield</option>
            </select>
          </label>
          <div className="construct-detailsField">
            <span>Shape</span>
            <span className="construct-detailsReadonly">{collider.shape}</span>
          </div>
          <AxisRow
            label="Position"
            values={collider.position}
            onCommit={(position) => onCommitLocal(collider.id, { position })}
          />
          <AxisRow
            label="Scale"
            values={collider.scale}
            onCommit={(scale) => onCommitLocal(collider.id, { scale })}
          />
          <AxisRow
            label="Rotation"
            values={euler}
            onCommit={(degrees) => {
              const q = createEulerQuat(degrees);
              onCommitLocal(collider.id, {
                rotation: [q[0]!, q[1]!, q[2]!, q[3]!],
              });
            }}
          />
          <div className="construct-detailsFooter">
            <button
              type="button"
              className="construct-detailsDelete"
              onClick={() => onColliderDelete(collider.id)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selection.kind === 'projectile') {
    const projectile = doc.projectile ?? {
      shape: 'sphere' as const,
      radius: 0.15,
      localOffset: [0, 0.2, 0.4] as [number, number, number],
      speed: 20,
    };

    return (
      <div className="construct-inspector">
        {header}
        <div className="construct-inspectorBody construct-detailsBody">
          <div className="construct-detailsField">
            <span>Shape</span>
            <span className="construct-detailsReadonly">sphere</span>
          </div>
          <NumberField
            label="Radius"
            value={projectile.radius}
            onCommit={(v) =>
              onProjectileChange({
                ...projectile,
                radius: v ?? projectile.radius,
              })
            }
          />
          <AxisRow
            label="Local offset"
            values={projectile.localOffset}
            onCommit={(localOffset) => onProjectileChange({ ...projectile, localOffset })}
          />
          <NumberField
            label="Speed"
            value={projectile.speed}
            onCommit={(v) =>
              onProjectileChange({
                ...projectile,
                speed: v ?? projectile.speed,
              })
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="construct-inspector">
      {header}
      <div className="construct-inspectorBody">
        <div className="mutedNote">Select an element to edit details.</div>
      </div>
    </div>
  );
};
