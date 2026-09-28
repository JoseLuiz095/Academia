# Impulso

SaaS para personal trainers e criadores, construído em React, TypeScript, Vite e Supabase. Impulso é a marca da plataforma; cada profissional ou empresa usa seu próprio nome e endereço `/p/:slug`. O repositório e o projeto Supabase ainda se chamam `Academia`. O FoodWeb serviu apenas como referência de estrutura.

## Áreas

| Área | Rotas | O que funciona agora |
| --- | --- | --- |
| Página pública | `/`, `/demonstracao`, `/p/:slug`, produto, sacola e finalizar | Página comercial, demonstração interativa local, vitrine, catálogo, pedido pendente com referência e Pix manual |
| Admin do criador | `/admin/*` | Conta, espaço, produtos, pedidos, ideias com IA, WhatsApp de teste e configurações |
| Admin Master | `/admin-master/*` | Acesso restrito, visão geral e listagem de espaços |

O Admin Master não é liberado pelo cadastro público. Um operador do banco deve adicionar o usuário autorizado em `public.platform_admins`. Planos e cobrança SaaS ainda não foram implementados. O pedido é registrado como pendente e o cliente envia sua referência pelo WhatsApp; não há confirmação automática do Pix nem entrega automática de arquivo digital.

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

A Edge Function `generate-content-idea` já está publicada e exige sessão autenticada. O botão de geração fica operacional quando `GEMINI_API_KEY` for configurada como secret da Edge Function no Supabase. A chave de teste local está em `supabase/functions/.env`, ignorado pelo Git; ela **não** é enviada automaticamente ao servidor. `GEMINI_MODEL` é opcional; o padrão é `gemini-3.5-flash-lite`. O limite inicial é de 20 pedidos por dia por usuário e espaço. Sem secret remoto, o usuário pode preparar e copiar o prompt ou salvar uma ideia manualmente.

Cada resposta de IA é salva como `review` e só passa a `approved` por ação do criador. O WhatsApp automático ainda não foi integrado; a tela permite testar individualmente uma ideia aprovada pelo aplicativo.

Para a decisão de modelo Gemini e a evolução segura do WhatsApp Business — incluindo n8n opcional com a API oficial — veja [IA e WhatsApp](docs/INTEGRACOES_IA_WHATSAPP.md).

## Pix e pedidos

O profissional cadastra preferencialmente um Pix copia e cola **estático** do banco, ou uma chave Pix (inclusive CPF) com nome e cidade do recebedor. No checkout, o cliente primeiro registra um pedido pendente; preços e total são recalculados no banco, que devolve uma referência. O navegador insere esse total no código estático e recalcula sua verificação, ou monta um BR Code a partir da chave. Códigos dinâmicos são rejeitados. O cliente confere recebedor e valor no aplicativo do banco, paga e envia a referência pelo WhatsApp. O profissional verifica o crédito no extrato e marca o pedido como confirmado no painel. Na primeira versão, entrega manual digital, serviço e envio de produto são combinados por WhatsApp; o site não libera arquivos automaticamente. Para outras formas de pagamento, o cliente combina diretamente com o profissional. O fluxo público ainda não tem proteção antiabuso dedicada; avalie Turnstile antes de divulgar amplamente.

## Marca própria e domínio

Cada espaço possui nome e slug próprios, como `/p/minha-marca`. Atualmente cada conta administra um espaço; outra empresa pode criar outra conta com outra marca. Uma conta administrando várias empresas exige uma evolução do painel e do vínculo de espaços. Domínios próprios por profissional ainda não estão ativos. Para suportá-los depois, será necessário verificar a titularidade do domínio, configurar DNS/SSL no Cloudflare e mapear cada hostname a um único espaço publicado sem permitir que um cliente reivindique o domínio de outro.

## Cloudflare Pages

Conecte o repositório `JoseLuiz095/Academia`, branch `main`, com build `npm run build`, saída `dist` e raiz do projeto `/`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no Pages para produção e preview. O projeto Pages ainda depende de autenticação com permissão de criação na conta Cloudflare do proprietário.
