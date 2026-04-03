import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react'
import { useCallback, useEffect, useState } from 'react'
import {
  createReminder,
  deleteReminder,
  fetchReminders,
  updateReminder,
} from './api'
import { AuthApiSync } from './AuthApiSync'
import { getPushAvailability, subscribeToPush } from './push'
import type { Recurrence, Reminder, ReminderKind } from './types'

const KIND_OPTIONS: { value: ReminderKind; label: string }[] = [
  { value: 'credit_payment', label: 'Pago tarjeta' },
  { value: 'subscription_cancel', label: 'Cancelar suscripción' },
  { value: 'card_cancel', label: 'Cancelar tarjeta' },
  { value: 'event', label: 'Evento' },
  { value: 'pet_memorial', label: 'Mascota (memoria)' },
  { value: 'other', label: 'Otro' },
]

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Una vez' },
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
]

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(s: string): string {
  return new Date(s).toISOString()
}

function emptyForm() {
  const t = new Date()
  t.setMinutes(0, 0, 0)
  t.setHours(t.getHours() + 1)
  return {
    title: '',
    kind: 'other' as ReminderKind,
    triggerLocal: toDatetimeLocalValue(t.toISOString()),
    recurrence: 'none' as Recurrence,
    days_before: '' as string | number,
    reference_date: '',
    notes: '',
    is_active: true,
  }
}

function MainApp() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pushStatus, setPushStatus] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const list = await fetchReminders()
      setReminders(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los recordatorios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubscribePush() {
    setPushStatus(null)
    const r = await subscribeToPush()
    const messages: Record<typeof r, string> = {
      ok: 'Notificaciones activadas.',
      unsupported: 'Este navegador no soporta push (usa Safari en iPhone y añade la app a inicio).',
      denied: 'Permiso denegado.',
      error: 'Error al suscribirse. ¿Variables VAPID en el servidor?',
    }
    setPushStatus(messages[r])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const days =
      form.days_before === '' || form.days_before === undefined
        ? null
        : Number(form.days_before)
    if (form.days_before !== '' && (days === null || !Number.isInteger(days) || days < 0)) {
      setError('Días de anticipación inválidos')
      return
    }
    const payload = {
      title: form.title.trim(),
      kind: form.kind,
      trigger_at: fromDatetimeLocalValue(form.triggerLocal),
      recurrence: form.recurrence,
      days_before: days,
      reference_date: form.reference_date || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    }
    if (!payload.title) {
      setError('El título es obligatorio')
      return
    }
    try {
      if (editingId) {
        await updateReminder(editingId, payload)
      } else {
        await createReminder(payload)
      }
      setForm(emptyForm())
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  function startEdit(r: Reminder) {
    setEditingId(r.id)
    setForm({
      title: r.title,
      kind: r.kind,
      triggerLocal: toDatetimeLocalValue(r.trigger_at),
      recurrence: r.recurrence,
      days_before: r.days_before ?? '',
      reference_date: r.reference_date ? r.reference_date.slice(0, 10) : '',
      notes: r.notes ?? '',
      is_active: r.is_active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm())
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este recordatorio?')) return
    setError(null)
    try {
      await deleteReminder(id)
      if (editingId === id) cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  async function toggleActive(r: Reminder) {
    setError(null)
    try {
      await updateReminder(r.id, { is_active: !r.is_active })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  const pushAvailability = getPushAvailability()

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <h1>PulseTime</h1>
            <p className="tagline">Recordatorios que llegan a tu iPhone (PWA + Web Push)</p>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <section className="card onboarding">
        <h2>En iPhone</h2>
        <ol>
          <li>Abre este sitio en <strong>Safari</strong> (iPhone).</li>
          <li>
            <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>.
          </li>
          <li>
            <strong>Importante:</strong> abre PulseTime <strong>tocando el icono</strong> en la pantalla de inicio. En una pestaña normal de Safari, Apple no permite Web Push; por eso verías “no disponible”.
          </li>
          <li>Desde la app instalada, pulsa el botón de abajo para permitir notificaciones.</li>
        </ol>
        {pushAvailability.ok ? (
          <button type="button" className="btn primary" onClick={() => void handleSubscribePush()}>
            Activar notificaciones push
          </button>
        ) : (
          <p className="muted push-hint">{pushAvailability.hint}</p>
        )}
        {pushStatus ? <p className="push-feedback">{pushStatus}</p> : null}
      </section>

      {error ? (
        <div className="banner error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="card">
        <h2>{editingId ? 'Editar recordatorio' : 'Nuevo recordatorio'}</h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="form">
          <label>
            Título
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ej. Pagar Visa"
              required
            />
          </label>
          <label>
            Tipo
            <select
              value={form.kind}
              onChange={(e) =>
                setForm((f) => ({ ...f, kind: e.target.value as ReminderKind }))
              }
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha y hora (referencia del aviso)
            <input
              type="datetime-local"
              value={form.triggerLocal}
              onChange={(e) => setForm((f) => ({ ...f, triggerLocal: e.target.value }))}
              required
            />
          </label>
          <label>
            Repetición
            <select
              value={form.recurrence}
              onChange={(e) =>
                setForm((f) => ({ ...f, recurrence: e.target.value as Recurrence }))
              }
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Avisar X días antes (opcional)
            <input
              type="number"
              min={0}
              step={1}
              value={form.days_before}
              onChange={(e) =>
                setForm((f) => ({ ...f, days_before: e.target.value === '' ? '' : e.target.value }))
              }
              placeholder="0"
            />
          </label>
          {form.kind === 'pet_memorial' ? (
            <label>
              Fecha de referencia (ej. fallecimiento)
              <input
                type="date"
                value={form.reference_date}
                onChange={(e) => setForm((f) => ({ ...f, reference_date: e.target.value }))}
              />
            </label>
          ) : null}
          <label>
            Notas (opcional)
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Activo
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              {editingId ? 'Guardar cambios' : 'Crear'}
            </button>
            {editingId ? (
              <button type="button" className="btn ghost" onClick={cancelEdit}>
                Cancelar edición
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Tus recordatorios</h2>
        {loading ? (
          <p className="muted">Cargando…</p>
        ) : reminders.length === 0 ? (
          <p className="muted">Aún no hay ninguno. Crea el primero arriba.</p>
        ) : (
          <ul className="reminder-list">
            {reminders.map((r) => (
              <li key={r.id} className={r.is_active ? '' : 'inactive'}>
                <div className="reminder-head">
                  <strong>{r.title}</strong>
                  <span className="pill">{KIND_OPTIONS.find((k) => k.value === r.kind)?.label}</span>
                </div>
                <p className="muted small">
                  {new Date(r.trigger_at).toLocaleString()} ·{' '}
                  {RECURRENCE_OPTIONS.find((x) => x.value === r.recurrence)?.label}
                  {r.days_before != null && r.days_before > 0
                    ? ` · ${r.days_before} día(s) antes`
                    : ''}
                </p>
                {!r.is_active ? <p className="muted small">Pausado</p> : null}
                <div className="row-actions">
                  <button type="button" className="btn small" onClick={() => startEdit(r)}>
                    Editar
                  </button>
                  <button type="button" className="btn small" onClick={() => void toggleActive(r)}>
                    {r.is_active ? 'Pausar' : 'Activar'}
                  </button>
                  <button type="button" className="btn small danger" onClick={() => void handleDelete(r.id)}>
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="footer">
        <p className="muted small">
          Cada usuario ve solo sus recordatorios. Variables: <code>DATABASE_URL</code>, Clerk, VAPID,{' '}
          <code>CRON_SECRET</code> (ver README).
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <>
      <SignedOut>
        <div className="app auth-gate">
          <h1>PulseTime</h1>
          <p className="tagline">Inicia sesión para gestionar tus recordatorios y notificaciones.</p>
          <div className="auth-card">
            <SignIn routing="hash" signUpUrl="#/sign-up" />
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <AuthApiSync />
        <MainApp />
      </SignedIn>
    </>
  )
}
