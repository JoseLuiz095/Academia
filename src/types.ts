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
  theme?: 'sage' | 'sunset' | 'lavender'
  tagline?: string | null
  cta_label?: string | null
  show_whatsapp?: boolean
  show_pix?: boolean
  show_service_area?: boolean
  show_ai_badge?: boolean
}

export type WorkspaceRequest = {
  id: string
  owner_id: string
  name: string
  slug: string
  niche: 'fitness' | 'wellness' | 'creator'
  plan_code: 'demo' | 'starter' | 'creator' | 'pro'
  status: 'pending' | 'approved' | 'rejected'
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
  created_at?: string
}

export type OrderReceipt = {
  reference: string
  total: number
  items: { name: string; quantity: number; unit_price: number; line_total: number }[]
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
