export type ReminderKind =
  | 'credit_payment'
  | 'subscription_cancel'
  | 'card_cancel'
  | 'event'
  | 'pet_memorial'
  | 'other'

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export type Reminder = {
  id: string
  user_id: string
  title: string
  kind: ReminderKind
  trigger_at: string
  recurrence: Recurrence
  days_before: number | null
  reference_date: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
