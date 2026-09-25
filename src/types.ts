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
  created_at?: string
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
