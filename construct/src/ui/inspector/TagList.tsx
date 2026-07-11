import { useState } from 'react';
import { TagModal } from '../modals/TagModal.tsx';

export type TagListProps = {
  tags: readonly string[];
  documentTags: readonly string[];
  title?: string;
  onChange: (tags: string[]) => void;
};

export const TagList = ({ tags, documentTags, title = 'Tags', onChange }: TagListProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="construct-detailsSection">
      <div className="construct-detailsSectionTitleRow">
        <div className="construct-detailsSectionTitle">{title}</div>
        <button
          type="button"
          className="construct-iconBtn"
          title="Add tag"
          aria-label="Add tag"
          onClick={() => setModalOpen(true)}
        >
          +
        </button>
      </div>
      {tags.length === 0 ? (
        <div className="mutedNote">No tags</div>
      ) : (
        <div className="construct-tagList">
          {tags.map((tag) => (
            <span key={tag} className="construct-tagBadge">
              {tag}
              <button
                type="button"
                className="construct-tagBadgeRemove"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(tags.filter((t) => t !== tag))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {modalOpen ? (
        <TagModal
          existingTags={documentTags}
          currentTags={tags}
          onCancel={() => setModalOpen(false)}
          onPick={(tag) => {
            if (!tags.includes(tag)) onChange([...tags, tag]);
            setModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
};
