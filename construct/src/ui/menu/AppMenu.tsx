export type ConstructMode = 'preview' | 'prop' | 'actor' | 'equipment' | 'level';

export type AppMenuProps = {
  mode: ConstructMode;
  onModeChange: (mode: ConstructMode) => void;
  fileOpen: boolean;
  onFileOpenChange: (open: boolean) => void;
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onLoad: () => void;
  onImport: () => void;
  onExport: () => void;
  onOpenSandbox?: () => void;
};

const MODES: { id: ConstructMode; label: string; enabled: boolean }[] = [
  { id: 'preview', label: 'Preview', enabled: true },
  { id: 'prop', label: 'Prop', enabled: true },
  { id: 'equipment', label: 'Equipment', enabled: true },
  { id: 'actor', label: 'Actor', enabled: true },
  { id: 'level', label: 'Level', enabled: true },
];

export const AppMenu = ({
  mode,
  onModeChange,
  fileOpen,
  onFileOpenChange,
  onNew,
  onSave,
  onSaveAs,
  onLoad,
  onImport,
  onExport,
  onOpenSandbox,
}: AppMenuProps) => {
  const propFileActionsEnabled =
    mode === 'prop' || mode === 'actor' || mode === 'equipment' || mode === 'level';

  return (
  <div className="construct-menuBar">
    <div className="construct-menuFile">
      <button
        type="button"
        className="construct-menuItem"
        aria-expanded={fileOpen}
        onClick={() => onFileOpenChange(!fileOpen)}
      >
        File
      </button>
      {fileOpen ? (
        <div className="construct-menuDropdown">
          <button
            type="button"
            className="construct-menuDropdownItem"
            onClick={() => {
              onFileOpenChange(false);
              onNew();
            }}
          >
            New
          </button>
          <button
            type="button"
            className="construct-menuDropdownItem"
            disabled={!propFileActionsEnabled}
            title={
              propFileActionsEnabled
                ? undefined
                : 'Available in Prop, Actor, Equipment, or Level mode'
            }
            onClick={() => {
              if (!propFileActionsEnabled) return;
              onFileOpenChange(false);
              onSave();
            }}
          >
            Save
            <span className="construct-menuShortcut">Ctrl+S</span>
          </button>
          <button
            type="button"
            className="construct-menuDropdownItem"
            disabled={!propFileActionsEnabled}
            title={
              propFileActionsEnabled
                ? undefined
                : 'Available in Prop, Actor, Equipment, or Level mode'
            }
            onClick={() => {
              if (!propFileActionsEnabled) return;
              onFileOpenChange(false);
              onSaveAs();
            }}
          >
            Save As
          </button>
          <button
            type="button"
            className="construct-menuDropdownItem"
            disabled={!propFileActionsEnabled}
            title={
              propFileActionsEnabled
                ? undefined
                : 'Available in Prop, Actor, Equipment, or Level mode'
            }
            onClick={() => {
              if (!propFileActionsEnabled) return;
              onFileOpenChange(false);
              onLoad();
            }}
          >
            Load
          </button>
          <button
            type="button"
            className="construct-menuDropdownItem"
            disabled={!propFileActionsEnabled}
            title={
              propFileActionsEnabled
                ? undefined
                : 'Available in Prop, Actor, Equipment, or Level mode'
            }
            onClick={() => {
              if (!propFileActionsEnabled) return;
              onFileOpenChange(false);
              onImport();
            }}
          >
            Import
          </button>
          <button
            type="button"
            className="construct-menuDropdownItem"
            disabled={!propFileActionsEnabled}
            title={
              propFileActionsEnabled
                ? undefined
                : 'Available in Prop, Actor, Equipment, or Level mode'
            }
            onClick={() => {
              if (!propFileActionsEnabled) return;
              onFileOpenChange(false);
              onExport();
            }}
          >
            Export
          </button>
          {onOpenSandbox ? (
            <button
              type="button"
              className="construct-menuDropdownItem"
              onClick={() => {
                onFileOpenChange(false);
                onOpenSandbox();
              }}
            >
              Sandbox
              <span className="construct-menuShortcut">F1</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
    <div className="construct-menuModes">
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            item.id === mode
              ? 'construct-menuItem construct-menuItemActive'
              : 'construct-menuItem'
          }
          disabled={!item.enabled}
          title={item.enabled ? undefined : 'Coming later'}
          onClick={() => {
            if (!item.enabled) return;
            onModeChange(item.id);
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  </div>
  );
};
