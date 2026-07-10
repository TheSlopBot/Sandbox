export type ConstructMode = 'preview' | 'prop' | 'character' | 'level';

export type AppMenuProps = {
  mode: ConstructMode;
  onModeChange: (mode: ConstructMode) => void;
  fileOpen: boolean;
  onFileOpenChange: (open: boolean) => void;
  onNew: () => void;
  onSave: () => void;
  onLoad: () => void;
};

const MODES: { id: ConstructMode; label: string; enabled: boolean }[] = [
  { id: 'preview', label: 'Preview', enabled: true },
  { id: 'prop', label: 'Prop', enabled: true },
  { id: 'character', label: 'Character', enabled: false },
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
}: AppMenuProps) => (
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
            onClick={() => {
              onFileOpenChange(false);
              onSave();
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="construct-menuDropdownItem"
            onClick={() => {
              onFileOpenChange(false);
              onLoad();
            }}
          >
            Load
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
