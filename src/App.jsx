import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'cube-smash-items-v1';
const TOAST_DURATION = 1800;
const ATTACK_DURATION = 1400;

const initialForm = {
  text: ''
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
        createdAt: Number(item.createdAt ?? Date.now()),
        completed: Boolean(item.completed),
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
  const [toast, setToast] = useState('');
  const [isAttacking, setIsAttacking] = useState(false);
  const [targetIds, setTargetIds] = useState([]);
  const [smashedIds, setSmashedIds] = useState([]);
  const attackTimeoutRef = useRef(null);

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
      createdAt: Date.now(),
      completed: false,
      completedAt: null
    };

    setItems((prev) => [newItem, ...prev]);
    setForm(initialForm);
    showToast('Enemy cube spawned.');
  };

  const handleDelete = (id) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;

    const shouldDelete = window.confirm(`Delete "${target.text}"?`);
    if (!shouldDelete) return;

    setItems((prev) => prev.filter((item) => item.id !== id));
    setSmashedIds((prev) => prev.filter((value) => value !== id));
    setTargetIds((prev) => prev.filter((value) => value !== id));
    showToast('Cube removed.');

    if (editingId === id) {
      setEditingId(null);
      setEditingText('');
    }
  };

  const toggleComplete = (id) => {
    const isCurrentlyComplete = items.find((item) => item.id === id)?.completed;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const nextCompleted = !item.completed;
        return {
          ...item,
          completed: nextCompleted,
          completedAt: nextCompleted ? Date.now() : null
        };
      })
    );

    if (isCurrentlyComplete) {
      setSmashedIds((prev) => prev.filter((value) => value !== id));
      showToast('Cube restored to battle.');
      return;
    }

    showToast('Task complete. Press play to smash cube.');
  };

  const playCubeSmash = () => {
    if (isAttacking) return;

    const pendingTargets = completedItems.filter((item) => !smashedIds.includes(item.id)).map((item) => item.id);

    if (pendingTargets.length === 0) {
      showToast('No completed cubes ready to smash yet.');
      return;
    }

    setTargetIds(pendingTargets);
    setIsAttacking(true);
    showToast('Tower firing...');

    attackTimeoutRef.current = window.setTimeout(() => {
      setSmashedIds((prev) => [...new Set([...prev, ...pendingTargets])]);
      setIsAttacking(false);
      setTargetIds([]);
      showToast(`Tower smashed ${pendingTargets.length} cube${pendingTargets.length > 1 ? 's' : ''}.`);
    }, ATTACK_DURATION);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const saveEdit = (id) => {
    const trimmed = editingText.trim();
    if (!trimmed) {
      showToast('Item text cannot be empty.');
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, text: trimmed } : item)));
    setEditingId(null);
    setEditingText('');
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
          <h1>Cube Smash</h1>
          <p>Spawn enemy cubes for each habit or to-do, then smash them by completing tasks.</p>
        </div>

        <div className={`cube-board ${isAttacking ? 'is-attacking' : ''}`} aria-label="Enemy cube board">
          <div className="board-ground" />
          <div className="board-tower" aria-hidden="true">
            <span />
          </div>

          {isAttacking && <div className="tower-beam" aria-hidden="true" />}

          <div className="cube-grid">
            {items.length === 0 ? (
              <div className="board-empty">No cubes yet. Add your first mission below.</div>
            ) : (
              items.map((item, index) => {
                const isTargeted = targetIds.includes(item.id);
                const isSmashed = smashedIds.includes(item.id);

                return (
                  <article
                    key={item.id}
                    className={`cube ${item.completed ? 'is-complete' : ''} ${isTargeted ? 'is-targeted' : ''} ${
                      isSmashed ? 'is-smashed' : ''
                    }`}
                    style={{ '--delay': `${(index % 10) * 45}ms` }}
                    title={item.text}
                  >
                    <p className="cube-name">{item.text}</p>
                    <div className="cube-voxel" aria-hidden="true">
                      <div className="cube-top" />
                      <div className="cube-front" />
                      <div className="cube-side" />
                    </div>
                    {item.completed && <span className="cube-tag">ready</span>}
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
            <p>Track missions, edit details, and keep momentum with one-tap complete and undo.</p>
          </div>

          <form className="add-form" onSubmit={handleAdd}>
            <input
              value={form.text}
              onChange={(event) => setForm({ text: event.target.value })}
              placeholder="Add a new habit or to-do"
              aria-label="Habit or to-do text"
            />
            <button type="submit">Add Item</button>
          </form>

          <div className="list-group">
            <h3>Open ({activeItems.length})</h3>
            {activeItems.length === 0 ? (
              <p className="empty-state">No open tasks. Add one above.</p>
            ) : (
              activeItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  editingId={editingId}
                  editingText={editingText}
                  onEditTextChange={setEditingText}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onToggleComplete={toggleComplete}
                  onDelete={handleDelete}
                  formatDate={formatDate}
                />
              ))
            )}
          </div>

          <div className="list-group completed">
            <h3>Completed ({completedItems.length})</h3>
            {completedItems.length === 0 ? (
              <p className="empty-state">Complete a task to arm the tower.</p>
            ) : (
              completedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  editingId={editingId}
                  editingText={editingText}
                  onEditTextChange={setEditingText}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onToggleComplete={toggleComplete}
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
  onEditTextChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleComplete,
  onDelete,
  formatDate
}) {
  const isEditing = editingId === item.id;

  return (
    <article className={`item-row ${item.completed ? 'done' : ''}`}>
      <div className="item-main">
        {isEditing ? (
          <input
            className="inline-editor"
            autoFocus
            value={editingText}
            onChange={(event) => onEditTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSaveEdit(item.id);
              }
              if (event.key === 'Escape') {
                onCancelEdit();
              }
            }}
          />
        ) : (
          <>
            <p>{item.text}</p>
            <small>
              Created {formatDate(item.createdAt)}
              {item.completedAt ? ` · Completed ${formatDate(item.completedAt)}` : ''}
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
              {item.completed ? 'Undo' : 'Complete'}
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
