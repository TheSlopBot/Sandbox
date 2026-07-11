export type ConstructMode = 'preview' | 'prop' | 'actor' | 'level';

export type AppMenuProps = {
  mode: ConstructMode;
  onModeChange: (mode: ConstructMode) => void;
  fileOpen: boolean;
  onFileOpenChange: (open: boolean) => void;
  onNew: () => void;
  onSave: () => void;
  onLoad: () => void;
  onImport: () => void;
  onExport: () => void;
};

const MODES: { id: ConstructMode; label: string; enabled: boolean }[] = [
  { id: 'preview', label: 'Preview', enabled: true },
  { id: 'prop', label: 'Prop', enabled: true },
  { id: 'actor', label: 'Actor', enabled: true },
  { id: 'level', label: 'Level', enabled: false },
];

export const AppMenu = ({
  mode,
  onModeChange,
  fileOpen,
  onFileOpenChange,
  onNew,
  onSave,
  onLoad,
  onImport,
  onExport,
}: AppMenuProps) => {
  const propFileActionsEnabled = mode === 'prop' || mode === 'actor';

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
            title={propFileActionsEnabled ? undefined : 'Available in Prop or Actor mode'}
            onClick={() => {
              if (!propFileActionsEnabled) return;
              onFileOpenChange(false);
              onSave();
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="construct-menuDropdownItem"
            disabled={!propFileActionsEnabled}
            title={propFileActionsEnabled ? undefined : 'Available in Prop or Actor mode'}
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
            title={propFileActionsEnabled ? undefined : 'Available in Prop or Actor mode'}
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
            title={propFileActionsEnabled ? undefined : 'Available in Prop or Actor mode'}
            onClick={() => {
              if (!propFileActionsEnabled) return;
              onFileOpenChange(false);
              onExport();
            }}
          >
            Export
          </button>
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
