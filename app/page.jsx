'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'todo-harian-v1';
const PRIORITIES = ['Rendah', 'Sedang', 'Tinggi'];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(key, n) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

function weekStart(key) {
  const d = parseDateKey(key);
  const diff = (d.getDay() + 6) % 7; // Senin sebagai awal minggu
  d.setDate(d.getDate() - diff);
  return d;
}

function formatLong(key) {
  const d = parseDateKey(key);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const clean = {};
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) {
        clean[k] = v
          .filter((t) => t && typeof t.title === 'string')
          .map((t) => ({
            id: String(t.id || uid()),
            title: t.title,
            time: typeof t.time === 'string' ? t.time : '',
            note: typeof t.note === 'string' ? t.note : '',
            priority: PRIORITIES.includes(t.priority) ? t.priority : 'Sedang',
            done: !!t.done,
            createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
          }));
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tasksByDate, setTasksByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [filter, setFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState('Sedang');
  const [editingId, setEditingId] = useState(null);
  const titleRef = useRef(null);

  // Muat dari localStorage hanya di client, setelah mount — ini yang
  // mencegah hydration mismatch (server tidak pernah me-render data tanggal).
  useEffect(() => {
    setTasksByDate(loadTasks());
    setMounted(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Simpan otomatis setiap kali data berubah (setelah mount).
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksByDate));
    } catch {
      // Penyimpanan penuh / tidak tersedia: abaikan, data tetap di memori.
    }
  }, [tasksByDate, mounted]);

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const dayTasks = tasksByDate[selectedDate] || [];
  const total = dayTasks.length;
  const doneCount = dayTasks.filter((t) => t.done).length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const visibleTasks = dayTasks.filter((t) =>
    filter === 'all' ? true : filter === 'active' ? !t.done : t.done,
  );

  const weekDays = useMemo(() => {
    const start = weekStart(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return toDateKey(d);
    });
  }, [selectedDate]);

  function resetForm() {
    setTitle('');
    setTime('');
    setNote('');
    setPriority('Sedang');
    setEditingId(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      if (titleRef.current) titleRef.current.focus();
      return;
    }
    if (editingId) {
      setTasksByDate((prev) => ({
        ...prev,
        [selectedDate]: (prev[selectedDate] || []).map((t) =>
          t.id === editingId
            ? { ...t, title: cleanTitle, time, note, priority }
            : t,
        ),
      }));
    } else {
      const task = {
        id: uid(),
        title: cleanTitle,
        time,
        note,
        priority,
        done: false,
        createdAt: Date.now(),
      };
      setTasksByDate((prev) => ({
        ...prev,
        [selectedDate]: [...(prev[selectedDate] || []), task],
      }));
    }
    resetForm();
  }

  function toggleTask(id) {
    setTasksByDate((prev) => ({
      ...prev,
      [selectedDate]: (prev[selectedDate] || []).map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      ),
    }));
  }

  function deleteTask(id) {
    setTasksByDate((prev) => ({
      ...prev,
      [selectedDate]: (prev[selectedDate] || []).filter((t) => t.id !== id),
    }));
    if (editingId === id) resetForm();
  }

  function clearDone() {
    setTasksByDate((prev) => ({
      ...prev,
      [selectedDate]: (prev[selectedDate] || []).filter((t) => !t.done),
    }));
  }

  function startEdit(task) {
    setEditingId(task.id);
    setTitle(task.title);
    setTime(task.time || '');
    setNote(task.note || '');
    setPriority(task.priority || 'Sedang');
    if (titleRef.current) titleRef.current.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Shell statis sebelum mount: tanpa data tanggal, supaya hasil render
  // server (saat build) dan render pertama client selalu identik.
  if (!mounted) {
    return (
      <main className="app">
        <header className="header">
          <h1>
            List Harian <span>Naila Khoirunnisa</span>
          </h1>
          <p className="tagline">Satu hari, satu daftar, semua beres.</p>
        </header>
        <p className="loading">Memuat tugasmu…</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="header">
        <h1>
          List Harian <span>Naila Khoirunnisa</span>
        </h1>
        <p className="tagline">Satu hari, satu daftar, semua beres.</p>
      </header>

      <div className="date-nav">
        <button type="button" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
          ← Kemarin
        </button>
        <button
          type="button"
          className="today-btn"
          onClick={() => setSelectedDate(todayKey)}
        >
          Hari ini
        </button>
        <button type="button" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
          Besok →
        </button>
      </div>

      <p className="current-date">
        <strong>{formatLong(selectedDate)}</strong>
        {selectedDate === todayKey ? ' · Hari ini' : ''}
      </p>

      <div className="week-strip">
        {weekDays.map((key) => {
          const d = parseDateKey(key);
          return (
            <button
              key={key}
              type="button"
              className={
                'week-day' +
                (key === selectedDate ? ' is-selected' : '') +
                (key === todayKey ? ' is-today' : '')
              }
              onClick={() => setSelectedDate(key)}
            >
              <span className="dow">{DAY_NAMES[d.getDay()]}</span>
              <span className="dnum">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <section className="progress-card" aria-label="Progres hari ini">
        <div className="progress-top">
          <span className="progress-label">Progres hari ini</span>
          <span className="progress-count">
            <strong>{doneCount}</strong> dari {total} selesai · {percent}%
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        {total > 0 && doneCount === total && (
          <p className="progress-done">Semua tugas beres. Kerja bagus!</p>
        )}
      </section>

      <form className="add-card" onSubmit={handleSubmit}>
        <h2 className={editingId ? 'editing' : ''}>
          {editingId ? 'Ubah tugas' : 'Tambah tugas baru'}
        </h2>
        <div className="form-row">
          <label htmlFor="task-title">Judul tugas *</label>
          <input
            id="task-title"
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Belanja bahan dapur"
            maxLength={140}
            required
          />
        </div>
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="task-time">Jam (opsional)</label>
            <input
              id="task-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="task-priority">Prioritas</label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="task-note">Catatan (opsional)</label>
          <textarea
            id="task-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Detail tambahan, misal alamat toko atau barang yang dibeli"
            maxLength={500}
          />
        </div>
        <button type="submit" className="btn-add">
          {editingId ? 'Simpan perubahan' : '+ Tambah Tugas'}
        </button>
        {editingId && (
          <button type="button" className="btn-cancel" onClick={resetForm}>
            Batalkan perubahan
          </button>
        )}
      </form>

      <div className="filters">
        <button
          type="button"
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          Semua ({total})
        </button>
        <button
          type="button"
          className={filter === 'active' ? 'active' : ''}
          onClick={() => setFilter('active')}
        >
          Aktif ({total - doneCount})
        </button>
        <button
          type="button"
          className={filter === 'done' ? 'active' : ''}
          onClick={() => setFilter('done')}
        >
          Selesai ({doneCount})
        </button>
      </div>

      {visibleTasks.length === 0 ? (
        <div className="empty">
          <strong>
            {total === 0
              ? 'Belum ada tugas untuk hari ini.'
              : filter === 'done'
                ? 'Belum ada tugas yang selesai.'
                : 'Tidak ada tugas aktif.'}
          </strong>
          {total === 0
            ? 'Tambah tugas pertamamu lewat formulir di atas.'
            : 'Semua tugas pada filter ini sudah beres atau belum ada.'}
        </div>
      ) : (
        <ul className="task-list">
          {visibleTasks.map((task, i) => (
            <li
              key={task.id}
              className={'task-item' + (task.done ? ' is-done' : '')}
              style={{ '--d': `${i * 60}ms` }}
            >
              <button
                type="button"
                className={'check-btn' + (task.done ? ' checked' : '')}
                onClick={() => toggleTask(task.id)}
                aria-label={task.done ? 'Batalkan selesai' : 'Tandai selesai'}
              >
                ✓
              </button>
              <div className="task-body">
                <span className="task-title">{task.title}</span>
                <div className="task-meta">
                  {task.time && <span className="task-time">{task.time}</span>}
                  <span
                    className={
                      'badge' +
                      (task.priority === 'Sedang'
                        ? ' p-sedang'
                        : task.priority === 'Tinggi'
                          ? ' p-tinggi'
                          : '')
                    }
                  >
                    {task.priority}
                  </span>
                </div>
                {task.note && <p className="task-note">{task.note}</p>}
              </div>
              <div className="task-actions">
                <button type="button" onClick={() => startEdit(task)}>
                  Ubah
                </button>
                <button
                  type="button"
                  className="delete"
                  onClick={() => deleteTask(task.id)}
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {doneCount > 0 && (
        <button type="button" className="clear-done" onClick={clearDone}>
          Hapus {doneCount} tugas yang selesai
        </button>
      )}

      <footer className="footer">
        Tugas tersimpan otomatis di perangkat ini (localStorage)
        <br />
        dan tidak hilang saat halaman di-reload.
      </footer>
    </main>
  );
}
