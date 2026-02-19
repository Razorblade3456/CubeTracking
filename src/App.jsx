import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'cube-smash-items-v1';
const TOAST_DURATION = 1800;
const ATTACK_DURATION = 1400;

const initialForm = {
  text: '',
  note: ''
};

function safeParseItems(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: String(item.id ?? crypto.randomUUID()),
        text: String(item.text ?? '').trim(),
        note: String(item.note ?? '').trim(),
        negatives: Math.max(0, Number(item.negatives ?? 0) || 0),
        createdAt: Number(item.createdAt ?? Date.now()),
        completed: Boolean(item.completed),
        queued: Boolean(item.queued),
        completedAt: item.completedAt ? Number(item.completedAt) : null
      }))
      .filter((item) => item.text.length > 0);
  } catch {
    return [];
  }
}

function App() {
  const [items, setItems] = useState(() => {
    if (typeof window === 'undefined') return [];
    return safeParseItems(window.localStorage.getItem(STORAGE_KEY));
  });

  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingNote, setEditingNote] = useState('');
  const [toast, setToast] = useState('');
  const [isAttacking, setIsAttacking] = useState(false);
  const [targetIds, setTargetIds] = useState([]);
  const [smashedIds, setSmashedIds] = useState([]);
  const [projectiles, setProjectiles] = useState([]);
  const attackTimeoutRef = useRef(null);
  const boardRef = useRef(null);
  const muzzleRef = useRef(null);
  const itemRefs = useRef(new Map());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), TOAST_DURATION);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setSmashedIds((prev) => prev.filter((id) => items.some((item) => item.id === id && item.completed)));
  }, [items]);

  useEffect(() => () => window.clearTimeout(attackTimeoutRef.current), []);

  const activeItems = useMemo(() => items.filter((item) => !item.completed), [items]);
  const completedItems = useMemo(() => items.filter((item) => item.completed), [items]);

  const showToast = (message) => setToast(message);

  const handleAdd = (event) => {
    event.preventDefault();
    const trimmed = form.text.trim();
    if (!trimmed) {
      showToast('Please enter a habit or to-do first.');
      return;
    }

    const newItem = {
      id: crypto.randomUUID(),
      text: trimmed,
      note: form.note.trim(),
      createdAt: Date.now(),
      completed: false,
      queued: false,
      completedAt: null
    };

    setItems((prev) => [newItem, ...prev]);
    setForm(initialForm);
    showToast('Enemy bug spawned.');
  };

  const handleDelete = (id) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;

    const shouldDelete = window.confirm(`Delete "${target.text}"?`);
    if (!shouldDelete) return;

    itemRefs.current.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSmashedIds((prev) => prev.filter((value) => value !== id));
    setTargetIds((prev) => prev.filter((value) => value !== id));
    showToast('Bug removed.');

    if (editingId === id) {
      setEditingId(null);
      setEditingText('');
      setEditingNote('');
    }
  };

  const toggleComplete = (id) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;

    const isArmedOrCompleted = target.queued || target.completed;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (isArmedOrCompleted) {
          return {
            ...item,
            queued: false,
            completed: false,
            completedAt: null
          };
        }

        return {
          ...item,
          queued: true,
          completed: false,
          completedAt: null
        };
      })
    );

    if (isArmedOrCompleted) {
      setSmashedIds((prev) => prev.filter((value) => value !== id));
      showToast('Bug restored to open tasks.');
      return;
    }

    showToast('Task checked. Press play to zap bug.');
  };

  const markIncomplete = (id) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              negatives: (item.negatives ?? 0) + 1,
              queued: false,
              completed: false,
              completedAt: null
            }
          : item
      )
    );

    setSmashedIds((prev) => prev.filter((value) => value !== id));
    setTargetIds((prev) => prev.filter((value) => value !== id));
    showToast('Marked incomplete. Negative added.');
  };

  const buildProjectilePaths = (pendingTargets) => {
    const boardRect = boardRef.current?.getBoundingClientRect();
    const muzzleRect = muzzleRef.current?.getBoundingClientRect();

    if (!boardRect || !muzzleRect) return [];

    const startX = muzzleRect.left - boardRect.left + muzzleRect.width * 0.5;
    const startY = muzzleRect.top - boardRect.top + muzzleRect.height * 0.5;

    return pendingTargets
      .map((id, index) => {
        const targetElement = itemRefs.current.get(id);
        if (!targetElement) return null;

        const targetRect = targetElement.getBoundingClientRect();
        const endX = targetRect.left - boardRect.left + targetRect.width * 0.5;
        const endY = targetRect.top - boardRect.top + targetRect.height * 0.56;

        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const length = Math.hypot(deltaX, deltaY);

        return {
          id,
          startX,
          startY,
          length,
          angle: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
          delay: index * 85
        };
      })
      .filter(Boolean);
  };

  const playCubeSmash = () => {
    if (isAttacking) return;

    const pendingTargets = items.filter((item) => item.queued && !item.completed).map((item) => item.id);

    if (pendingTargets.length === 0) {
      showToast('No checked bugs ready to zap yet.');
      return;
    }

    const projectilePaths = buildProjectilePaths(pendingTargets);

    setTargetIds(pendingTargets);
    setProjectiles(projectilePaths);
    setIsAttacking(true);
    showToast('Tower firing...');

    attackTimeoutRef.current = window.setTimeout(() => {
      const completedAt = Date.now();

      setItems((prev) =>
        prev.map((item) =>
          pendingTargets.includes(item.id)
            ? {
                ...item,
                queued: false,
                completed: true,
                completedAt
              }
            : item
        )
      );
      setSmashedIds((prev) => [...new Set([...prev, ...pendingTargets])]);
      setIsAttacking(false);
      setTargetIds([]);
      setProjectiles([]);
      showToast(`Tower zapped ${pendingTargets.length} bug${pendingTargets.length > 1 ? 's' : ''}.`);
    }, ATTACK_DURATION);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingText(item.text);
    setEditingNote(item.note ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
    setEditingNote('');
  };

  const saveEdit = (id) => {
    const trimmed = editingText.trim();
    if (!trimmed) {
      showToast('Item text cannot be empty.');
      return;
    }

    const trimmedNote = editingNote.trim();

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, text: trimmed, note: trimmedNote } : item)));
    setEditingId(null);
    setEditingText('');
    setEditingNote('');
    showToast('Item updated.');
  };

  const formatDate = (value) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  return (
    <div className="app-shell">
      <header className="board-section">
        <div className="board-headline">
          <h1>Bug Smash</h1>
          <p>Spawn enemy bugs for each habit or to-do, then zap them by completing tasks.</p>
        </div>

        <div ref={boardRef} className={`cube-board ${isAttacking ? 'is-attacking' : ''}`} aria-label="Enemy bug board">
          <div className="board-ground" />
          <div className="board-tower" aria-hidden="true">
            <span className="tower-window" />
            <span ref={muzzleRef} className="tower-muzzle" />
          </div>

          {isAttacking && projectiles.length > 0 && (
            <div className="tower-projectiles" aria-hidden="true">
              {projectiles.map((projectile) => (
                <span
                  key={projectile.id}
                  className="tower-projectile"
                  style={{
                    left: `${projectile.startX}px`,
                    top: `${projectile.startY}px`,
                    width: `${projectile.length}px`,
                    transform: `rotate(${projectile.angle}deg)`,
                    '--shot-delay': `${projectile.delay}ms`
                  }}
                />
              ))}
            </div>
          )}

          <div className="cube-grid">
            {activeItems.length === 0 ? (
              <div className="board-empty">No bugs yet. Add your first mission below.</div>
            ) : (
              activeItems.map((item, index) => {
                const isTargeted = targetIds.includes(item.id);
                const isSmashed = smashedIds.includes(item.id);
                const isReady = item.queued || item.completed;
                const negativeTier =
                  item.negatives >= 10 ? 'is-negative-10' : item.negatives >= 5 ? 'is-negative-5' : item.negatives >= 1 ? 'is-negative-1' : '';

                return (
                  <article
                    key={item.id}
                    className={`cube ${item.completed ? 'is-complete' : ''} ${isTargeted ? 'is-targeted' : ''} ${
                      isSmashed ? 'is-smashed' : ''
                    }`}
                    style={{ '--delay': `${(index % 10) * 45}ms` }}
                    title={item.text}
                    ref={(node) => {
                      if (node) itemRefs.current.set(item.id, node);
                      else itemRefs.current.delete(item.id);
                    }}
                  >
                    <p className="cube-name">{item.text}</p>
                    <div className="cube-voxel" aria-hidden="true">
                      <div className={`roach-sprite ${negativeTier}`.trim()}>
                        <span className="roach-core" />
                        <span className="roach-eye roach-eye-left" />
                        <span className="roach-eye roach-eye-right" />
                        {item.negatives >= 10 && <span className="roach-brow roach-brow-left" />}
                        {item.negatives >= 10 && <span className="roach-brow roach-brow-right" />}
                        <span className="roach-antenna roach-antenna-left" />
                        <span className="roach-antenna roach-antenna-right" />
                        <span className="roach-leg roach-leg-left-top" />
                        <span className="roach-leg roach-leg-left-mid" />
                        <span className="roach-leg roach-leg-left-bottom" />
                        <span className="roach-leg roach-leg-right-top" />
                        <span className="roach-leg roach-leg-right-mid" />
                        <span className="roach-leg roach-leg-right-bottom" />
                      </div>
                    </div>
                    {isReady && <span className="cube-skull" aria-hidden="true">☠</span>}
                    {isReady && <span className="cube-tag">ready</span>}
                  </article>
                );
              })
            )}
          </div>

          <button className="play-button" type="button" onClick={playCubeSmash} disabled={isAttacking}>
            ▶
          </button>
        </div>
      </header>

      <main className="list-section">
        <section className="todo-card">
          <div className="card-heading">
            <h2>Habits / To-Dos</h2>
            <p>Track missions, add optional notes, and use ✓ Complete or - Incomplete for spooky momentum.</p>
          </div>

          <form className="add-form" onSubmit={handleAdd}>
            <input
              value={form.text}
              onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
              placeholder="Add a new habit or to-do"
              aria-label="Habit or to-do text"
            />
            <textarea
              className="add-note"
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Optional notes"
              aria-label="Optional note"
              rows={2}
            />
            <button type="submit">Add Item</button>
          </form>

          <div className="list-group">
            <h3>Open / Checked ({activeItems.length})</h3>
            {activeItems.length === 0 ? (
              <p className="empty-state">No open tasks. Add one above.</p>
            ) : (
              activeItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  editingId={editingId}
                  editingText={editingText}
                  editingNote={editingNote}
                  onEditTextChange={setEditingText}
                  onEditNoteChange={setEditingNote}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onToggleComplete={toggleComplete}
                  onMarkIncomplete={markIncomplete}
                  onDelete={handleDelete}
                  formatDate={formatDate}
                />
              ))
            )}
          </div>

          <div className="list-group completed">
            <h3>Completed ({completedItems.length})</h3>
            {completedItems.length === 0 ? (
              <p className="empty-state">Check a task, then press play to zap it.</p>
            ) : (
              completedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  editingId={editingId}
                  editingText={editingText}
                  editingNote={editingNote}
                  onEditTextChange={setEditingText}
                  onEditNoteChange={setEditingNote}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onToggleComplete={toggleComplete}
                  onMarkIncomplete={markIncomplete}
                  onDelete={handleDelete}
                  formatDate={formatDate}
                />
              ))
            )}
          </div>
        </section>
      </main>

      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  editingId,
  editingText,
  editingNote,
  onEditTextChange,
  onEditNoteChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleComplete,
  onMarkIncomplete,
  onDelete,
  formatDate
}) {
  const isEditing = editingId === item.id;

  return (
    <article className={`item-row ${item.completed ? 'done' : ''}`}>
      <div className="item-main">
        {isEditing ? (
          <>
            <input
              className="inline-editor"
              autoFocus
              value={editingText}
              onChange={(event) => onEditTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  onSaveEdit(item.id);
                }
                if (event.key === 'Escape') {
                  onCancelEdit();
                }
              }}
            />
            <textarea
              className="inline-editor inline-note"
              value={editingNote}
              onChange={(event) => onEditNoteChange(event.target.value)}
              placeholder="Optional notes"
              rows={2}
            />
          </>
        ) : (
          <>
            <p>{item.text}</p>
            {item.note && <small className="item-note">Note: {item.note}</small>}
            <small>
              Created {formatDate(item.createdAt)}
              {item.completedAt ? ` · Completed ${formatDate(item.completedAt)}` : ''}
              {item.queued && !item.completed ? ' · Checked for next zap' : ''}
              {item.negatives > 0 ? ` · -${item.negatives} incomplete` : ''}
            </small>
          </>
        )}
      </div>

      <div className="item-actions">
        {isEditing ? (
          <>
            <button className="ghost" type="button" onClick={() => onSaveEdit(item.id)}>
              Save
            </button>
            <button className="ghost" type="button" onClick={onCancelEdit}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="ghost" type="button" onClick={() => onToggleComplete(item.id)}>
              {item.completed || item.queued ? 'Undo' : '✓ Complete'}
            </button>
            <button className="negative" type="button" onClick={() => onMarkIncomplete(item.id)}>
              - Incomplete
            </button>
            <button className="ghost" type="button" onClick={() => onStartEdit(item)}>
              Edit
            </button>
            <button className="danger" type="button" onClick={() => onDelete(item.id)}>
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default App;
