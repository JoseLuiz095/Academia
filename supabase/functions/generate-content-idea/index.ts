import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors })
}

type Idea = { title: string; hook: string; body: string; cta: string }
function isIdea(value: unknown): value is Idea {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['title', 'hook', 'body', 'cta'].every((key) => typeof item[key] === 'string' && String(item[key]).trim().length > 0)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Acesso não autorizado.' }, 401)
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'Gemini ainda não foi configurado no servidor.' }, 503)

  let input: { workspaceId?: unknown; brief?: unknown; format?: unknown }
  try { input = await request.json() }
  catch { return json({ error: 'Pedido inválido.' }, 400) }
  const workspaceId = typeof input.workspaceId === 'string' ? input.workspaceId : ''
  const brief = typeof input.brief === 'string' ? input.brief.trim() : ''
  const format = input.format
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId) || brief.length < 8 || brief.length > 500 || !['story', 'post', 'message'].includes(String(format))) {
    return json({ error: 'Informe um objetivo entre 8 e 500 caracteres e um formato válido.' }, 400)
  }

  const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const token = authHeader.slice(7)
  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Sessão inválida.' }, 401)
  const member = await client.from('workspace_members').select('workspace_id').eq('workspace_id', workspaceId).eq('user_id', userData.user.id).maybeSingle()
  if (member.error || !member.data) return json({ error: 'Você não tem acesso a este espaço.' }, 403)

  const [workspaceResult, profileResult] = await Promise.all([
    client.from('workspaces').select('name,niche').eq('id', workspaceId).single(),
    client.from('content_profiles').select('tone,audience,goals,guidelines,forbidden_topics,preferred_equipment,training_methods,weekly_frequency').eq('workspace_id', workspaceId).maybeSingle(),
  ])
  if (workspaceResult.error || !workspaceResult.data) return json({ error: 'Espaço indisponível.' }, 404)
  if (profileResult.error) return json({ error: 'Não foi possível carregar o perfil de conteúdo.' }, 500)

  const quota = await client.rpc('consume_ai_quota', { target_workspace_id: workspaceId })
  if (quota.error) return json({ error: 'Não foi possível verificar o limite diário.' }, 500)
  if (!quota.data) return json({ error: 'Limite diário de 20 ideias atingido.' }, 429)

  const profile = profileResult.data
  const prompt = [
    'Crie UMA ideia de conteúdo para redes sociais em português do Brasil.',
    `Profissional: ${workspaceResult.data.name}. Nicho: ${workspaceResult.data.niche}.`,
    `Formato: ${format}. Objetivo desta ideia: ${brief}.`,
    `Público: ${profile?.audience || 'não informado'}. Tom de voz: ${profile?.tone || 'direto e acolhedor'}.`,
    `Objetivos gerais: ${profile?.goals || 'não informados'}.`,
    `Equipamentos: ${profile?.preferred_equipment || 'não informados'}. Métodos: ${profile?.training_methods || 'não informados'}. Frequência semanal: ${profile?.weekly_frequency || 'não informada'}.`,
    `Instruções: ${profile?.guidelines || 'nenhuma'}. Temas proibidos: ${profile?.forbidden_topics || 'nenhum informado'}.`,
    'Não prometa resultados, não faça diagnóstico ou prescrição clínica. Produza conteúdo informativo a ser revisado pelo profissional.',
    'Responda SOMENTE com um objeto JSON contendo title, hook, body e cta como strings não vazias.',
  ].join('\n')

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite'
  let generated: Idea
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } }),
      signal: AbortSignal.timeout(25000),
    })
    if (!response.ok) return json({ error: 'O Gemini não pôde gerar a ideia agora. Tente novamente mais tarde.' }, 502)
    const result = await response.json()
    const raw = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('')
    const parsed: unknown = JSON.parse(raw)
    if (!isIdea(parsed)) return json({ error: 'A resposta do Gemini veio em um formato inesperado.' }, 502)
    generated = parsed
  } catch {
    return json({ error: 'O Gemini demorou ou respondeu de forma inesperada.' }, 502)
  }

  const saved = await client.from('content_ideas').insert({
    workspace_id: workspaceId, format, title: generated.title.slice(0, 180), hook: generated.hook.slice(0, 1000),
    body: generated.body.slice(0, 8000), cta: generated.cta.slice(0, 1000), status: 'review', source: 'ai', created_by: userData.user.id,
  }).select('id').single()
  if (saved.error) return json({ error: 'A ideia foi gerada, mas não foi possível salvá-la.' }, 500)
  return json({ id: saved.data.id })
})
