# Academia

SaaS para personal trainers e criadores, construído em React, TypeScript, Vite e Supabase. A organização segue as três áreas do FoodWeb, com visual próprio do Academia.

## Áreas

| Área | Rotas | O que funciona agora |
| --- | --- | --- |
| Página pública | `/`, `/p/:slug`, produto, sacola e finalizar | Vitrine, catálogo e pedido combinado pelo WhatsApp; Pix manual |
| Admin do criador | `/admin/*` | Conta, criação do espaço, produtos, perfil de conteúdo, ideias e configurações |
| Admin Master | `/admin-master/*` | Acesso restrito, visão geral e listagem de espaços |

O Admin Master não é liberado pelo cadastro público. Um operador do banco deve adicionar o usuário autorizado em `public.platform_admins`. Planos e cobrança SaaS ainda não foram implementados. O pedido da vitrine abre uma conversa; ainda não grava pedido, confirma Pix nem entrega arquivo digital automaticamente.

## Execução local

Requer Node.js 22 ou superior.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Preencha `.env.local` com a URL e a chave **publicável** do projeto Supabase `Academia`. O arquivo é ignorado pelo Git. Use `npm run build` para validar a versão de produção.

```env
VITE_SUPABASE_URL=https://vnpoinodvchmmbyxpacj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Não coloque `service_role`, chave secreta do Gemini ou token do WhatsApp em variáveis `VITE_*`.

## Supabase

As migrations em `supabase/migrations/` foram aplicadas ao projeto `Academia`. Todas as tabelas públicas têm RLS. A vitrine só lê workspaces e produtos publicados. O Admin Master precisa de um usuário já cadastrado no Supabase Auth e de um registro inserido por um administrador do banco:

```sql
insert into public.platform_admins (user_id, display_name)
select id, 'Admin Master'
from auth.users
where email = 'seu-email@exemplo.com'
on conflict (user_id) do nothing;
```

Substitua o e-mail e confira o usuário antes de executar. Em Auth > URL Configuration, inclua a origem local e o domínio de produção nas URLs de redirecionamento para a confirmação por e-mail.

### Gemini

A Edge Function `generate-content-idea` já está publicada e exige sessão autenticada. O botão de geração fica operacional quando `GEMINI_API_KEY` for configurada como secret da Edge Function no Supabase. `GEMINI_MODEL` é opcional; o padrão é `gemini-2.5-flash`. O limite inicial é de 20 pedidos por dia por espaço. Sem chave, o usuário pode preparar e copiar o prompt ou salvar uma ideia manualmente.

Cada resposta de IA é salva como `review` e só passa a `approved` por ação do criador. O WhatsApp automático ainda não foi integrado; a tela permite testar individualmente uma ideia aprovada pelo aplicativo.

## Pix e pedidos

O profissional cadastra chave Pix, nome e cidade do recebedor. No checkout, o navegador monta um BR Code estático com o total exibido. O cliente deve conferir os dados no banco, e o profissional confirma o crédito manualmente. O site não libera manuais nem confirma avaliações nessa etapa. Para outras formas de pagamento, o cliente combina diretamente com o profissional.

## Cloudflare Pages

Conecte o repositório `JoseLuiz095/Academia`, branch `main`, com build `npm run build`, saída `dist` e raiz do projeto `/`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no Pages para produção e preview. O projeto Pages ainda depende de autenticação com permissão de criação na conta Cloudflare do proprietário.
