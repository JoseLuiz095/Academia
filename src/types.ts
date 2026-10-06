export type Workspace = {
  id: string
  owner_id: string
  name: string
  slug: string
  niche: string
  description: string | null
  whatsapp_number: string | null
  pix_key: string | null
  pix_receiver: string | null
  pix_city: string | null
  service_cities: string | null
  training_document_type?: 'CREF' | 'Registro profissional' | 'Outro' | null
  training_document_number?: string | null
  nutrition_document_type?: 'CRN' | 'Registro profissional' | 'Outro' | null
  nutrition_document_number?: string | null
  published: boolean
  plan_code?: 'demo' | 'starter' | 'creator' | 'pro' | null
  subscription_status?: 'trial' | 'active' | 'past_due' | 'cancelled' | null
  subscription_started_at?: string | null
  subscription_ends_at?: string | null
  store_settings?: StoreSettings | null
  approval_status?: 'pending' | 'approved' | 'rejected' | 'suspended' | null
  approved_at?: string | null
  approved_by?: string | null
  created_at?: string
}

export type StoreSettings = {
  theme?: 'sage' | 'sunset' | 'lavender' | 'impulso'
  tagline?: string | null
  cta_label?: string | null
  primary_color?: string | null
  accent_color?: string | null
  hero_title?: string | null
  background_color?: string | null
  surface_color?: string | null
  text_color?: string | null
  muted_color?: string | null
  border_color?: string | null
  button_text_color?: string | null
  card_radius?: number | null
  show_whatsapp?: boolean
  show_pix?: boolean
  show_service_area?: boolean
  show_ai_badge?: boolean
}

export type MotionType = 'embedded' | 'none' | 'video' | 'gif' | 'sequence'
export type MotionPreset = 'auto' | 'squat' | 'lunge' | 'pushup' | 'row' | 'deadlift' | 'press' | 'plank' | 'strength'
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'glutes' | 'quadriceps' | 'hamstrings' | 'calves'

export type DietPart = {
  name: string
  amount?: string | null
  description?: string | null
  icon?: string | null
  color?: string | null
}

export type ProductContentItem = {
  title: string
  details?: string | null
  icon?: string | null
  image_url?: string | null
  meta?: string | null
  motion_type?: MotionType
  exercise_library_id?: string | null
  motion_preset?: MotionPreset
  muscle_focus?: MuscleGroup[] | null
  motion_url?: string | null
  motion_poster?: string | null
  motion_label?: string | null
  diet_parts?: DietPart[] | null
}

export type WorkoutSettings = {
  duration_minutes: number
  exercise_seconds: number
  rest_seconds: number
}

export type ProductContent = {
  intro?: string | null
  items?: ProductContentItem[]
  workout_settings?: WorkoutSettings | null
}

export type WorkspaceRequest = {
  id: string
  owner_id: string
  name: string
  slug: string
  niche: 'fitness' | 'wellness' | 'creator'
  plan_code: 'demo' | 'starter' | 'creator' | 'pro'
  status: 'payment_pending' | 'pending' | 'approved' | 'rejected'
  payment_status?: 'not_required' | 'awaiting_payment' | 'proof_sent' | 'confirmed' | 'rejected' | null
  payment_amount_cents?: number | null
  payment_reference?: string | null
  payment_pix_static_code?: string | null
  payment_pix_key?: string | null
  payment_pix_receiver?: string | null
  payment_pix_city?: string | null
  payment_whatsapp?: string | null
  payment_proof_declared_at?: string | null
  reviewer_note: string | null
  created_at: string
  reviewed_at?: string | null
}

export type Product = {
  id: string
  workspace_id: string
  kind: 'service' | 'digital' | 'physical'
  name: string
  description: string | null
  price: number | null
  currency: string
  published: boolean
  image_url: string | null
  service_area: string | null
  category?: 'workout' | 'diet' | 'service' | 'physical' | 'other'
  level?: 'beginner' | 'intermediate' | 'advanced' | 'all'
  access_mode?: 'whatsapp' | 'portal' | 'both'
  access_days?: number
  booking_enabled?: boolean
  content?: ProductContent | null
  created_at?: string
}

export type EvaluationAvailability = {
  id: string
  workspace_id: string
  product_id: string
  weekday: number
  start_time: string
  end_time: string
  slot_minutes: number
  location: string
  active: boolean
}

export type EvaluationSlot = {
  availability_id: string
  scheduled_date: string
  scheduled_start: string
  scheduled_end: string
  location: string
}

export type AppointmentSelection = {
  product_id: string
  availability_id: string
  scheduled_date: string
  scheduled_start: string
  scheduled_end: string
  location: string
}

export type EvaluationBooking = AppointmentSelection & {
  id: string
  workspace_id: string
  order_id: string
  order_item_id: number | null
  customer_name: string
  customer_phone: string
  status: 'payment_pending' | 'awaiting_approval' | 'confirmed' | 'rejected' | 'cancelled' | 'expired'
  hold_expires_at: string
  payment_confirmed_at: string | null
  approved_at: string | null
  reviewer_note: string | null
}

export type OrderReceipt = {
  reference: string
  total: number
  items: { name: string; quantity: number; unit_price: number; line_total: number }[]
  appointment?: {
    id: string
    status: EvaluationBooking['status']
    scheduled_date: string
    scheduled_start: string
    scheduled_end: string
    location: string
  } | null
}

export type ContentProfile = {
  workspace_id: string
  tone: string
  audience: string | null
  goals: string | null
  guidelines: string | null
  forbidden_topics: string | null
  preferred_equipment: string | null
  training_methods: string | null
  weekly_frequency: string | null
}

export type ContentIdea = {
  id: string
  workspace_id: string
  format: 'story' | 'post' | 'message'
  title: string
  hook: string | null
  body: string | null
  cta: string | null
  status: 'draft' | 'review' | 'approved' | 'archived'
  source: 'manual' | 'ai'
  created_at: string
}
