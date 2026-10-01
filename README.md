# Impulso

SaaS para personal trainers e criadores, construído em React, TypeScript, Vite e Supabase. Impulso é a marca da plataforma; cada profissional ou empresa usa seu próprio nome e endereço `/p/:slug`. O repositório e o projeto Supabase ainda se chamam `Academia`. A operação segue o modelo do FoodWeb: Admin Master → lojista → loja pública, com aprovação, planos e renovação manual.

## Áreas

| Área | Rotas | O que funciona agora |
| --- | --- | --- |
| Página pública | `/`, `/demonstracao`, `/p/:slug`, produto, sacola e finalizar | Página comercial, demonstração interativa local, vitrine, catálogo, pedido pendente com referência e Pix manual |
| Admin do criador | `/admin/*` | Cadastro sujeito à aprovação, loja, pedidos, plano, Pix da assinatura, ideias, assistente de nicho e lembretes |
| Admin Master | `/admin-master/*` | Aprovação de lojistas, controle de espaços/planos, Pix da plataforma e confirmação manual de mensalidades |

O Admin Master não é liberado pelo cadastro público. Um operador do banco adiciona o usuário autorizado em `public.platform_admins`. O lojista escolhe a Demonstração ou um plano pago e aguarda aprovação. A Demonstração libera 14 dias sem cobrança automática. Para continuar ou renovar, solicita cobrança Pix, informa o comprovante e aguarda o Master conferir o crédito. Só a confirmação do Master avança o vencimento. Os pedidos da loja têm Pix próprio e confirmação manual pelo profissional; não há entrega automática de arquivo digital.

O contrato atual do produto, o ciclo de acesso e os limites estão em [Contrato do produto](docs/CONTRATO_DO_PRODUTO.md).

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

Para configurar o Vite, preencher o telefone de teste e entender o admin demonstrativo, veja [Configuração local](docs/CONFIGURACAO_LOCAL.md). A rota `/admin/demo` é somente uma prévia local; o admin real é criado pelo fluxo do Supabase em `/admin/login`.

### E-mail de confirmação, recuperação e Turnstile

O cadastro e a recuperação de senha usam o SMTP do Supabase Auth. O SMTP padrão é limitado para testes e pode entregar somente a endereços autorizados no projeto; para uso normal, configure um SMTP próprio em Authentication > Emails > SMTP Settings e confira os Auth Logs. A aplicação agora oferece “Reenviar confirmação”, “Esqueci minha senha” e troca de senha em `/conta/seguranca`.

`TURNSTILE_SECRET_KEY` não envia e-mails. Para ativar a proteção, habilite Turnstile no CAPTCHA do Supabase Auth, cadastre o secret no Supabase e configure `VITE_TURNSTILE_SITE_KEY` nas variáveis públicas do build do Cloudflare/Vite. O widget aparece no cadastro, login e recuperação; o token é enviado ao Supabase Auth. Adicionar somente o secret não faz o widget aparecer.

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

A Edge Function `generate-content-idea` exige sessão autenticada. O botão de geração depende de `GEMINI_API_KEY` como secret da Edge Function no Supabase. A chave de teste local em `supabase/functions/.env` é ignorada pelo Git e **não** é enviada automaticamente ao servidor. `GEMINI_MODEL` é opcional; o padrão é `gemini-3.5-flash-lite`. Os limites diários por espaço são 3/5/12/20 solicitações (Demo/Essencial/Criador/Crescimento), compartilhadas entre ideias e assistente; há teto de 20 por usuário. Sem secret remoto, o usuário pode copiar o prompt ou salvar uma ideia manualmente. A função também aceita os nomes alternativos `GOOGLE_GENERATIVE_AI_API_KEY` e `GOOGLE_API_KEY`, mas o nome recomendado é `GEMINI_API_KEY`.

O plano Demo é controlado pelo Admin Master, começa somente após aprovação e não gera cobrança Pix. O lojista vê o vencimento no painel; depois do teste, escolhe um plano pago. A cobrança paga só muda o plano após comprovante enviado pelo WhatsApp e confirmação manual do crédito.

Cada resposta de IA é salva como `review` e só passa a `approved` por ação do criador. Pesquisa de tendências é opcional e precisa produzir fontes verificáveis para que a ideia seja rotulada como atual. O mini assistente limita perguntas ao nicho do criador. Lembretes são marcações no painel; o WhatsApp automático ainda não foi integrado e a tela permite testar individualmente uma ideia aprovada pelo aplicativo.

Para a decisão de modelo Gemini e a evolução segura do WhatsApp Business — incluindo n8n opcional com a API oficial — veja [IA e WhatsApp](docs/INTEGRACOES_IA_WHATSAPP.md).

## Pix e pedidos

O profissional cadastra preferencialmente um Pix copia e cola **estático** do banco, ou uma chave Pix (inclusive CPF) com nome e cidade do recebedor. No checkout, o cliente primeiro registra um pedido pendente; preços e total são recalculados no banco, que devolve uma referência. O navegador insere esse total no código estático e recalcula sua verificação, ou monta um BR Code a partir da chave. Códigos dinâmicos são rejeitados. O cliente confere recebedor e valor no aplicativo do banco, paga e envia a referência pelo WhatsApp. O profissional verifica o crédito no extrato e marca o pedido como confirmado no painel. Na primeira versão, entrega manual digital, serviço e envio de produto são combinados por WhatsApp; o site não libera arquivos automaticamente. Para outras formas de pagamento, o cliente combina diretamente com o profissional. O fluxo público ainda não tem proteção antiabuso dedicada; avalie Turnstile antes de divulgar amplamente.

## Marca própria e domínio

Cada espaço possui nome e slug próprios, como `/p/minha-marca`. Atualmente cada conta administra um espaço; outra empresa pode criar outra conta com outra marca. Uma conta administrando várias empresas exige uma evolução do painel e do vínculo de espaços. Domínios próprios por profissional ainda não estão ativos. Para suportá-los depois, será necessário verificar a titularidade do domínio, configurar DNS/SSL no Cloudflare e mapear cada hostname a um único espaço publicado sem permitir que um cliente reivindique o domínio de outro.

## Homologação no Cloudflare Workers

A URL `academia.joseluizacama.workers.dev` pertence a um Worker de assets estáticos, não a um projeto Pages conectado ao GitHub. O arquivo `wrangler.jsonc` configura a saída `dist` e o fallback das rotas React. O GitHub guarda o código, mas fazer push não publica automaticamente esse Worker. Para publicar: configure as variáveis públicas do Supabase no ambiente de build, rode `npm run build` e depois `wrangler deploy`. Nunca publique `.env.local` ou a chave secreta do Gemini. Se desejar CI para cada push na `main`, configure um workflow com credencial limitada do Cloudflare em etapa separada.
