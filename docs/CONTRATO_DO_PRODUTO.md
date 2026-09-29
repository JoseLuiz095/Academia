# Impulso — contrato operacional

Atualizado em 29/09/2026. Este documento descreve o comportamento a manter ao evoluir a aplicação. O FoodWeb é a referência da **lógica da operação**, não do catálogo de comida nem da identidade visual.

## Papéis e fluxo

1. **Admin Master** administra todos os lojistas. Revê solicitações, altera planos, acompanha vencimentos, configura o Pix da plataforma, confere mensalidades no banco e suspende/restaura espaços. Não confirma pagamento apenas por comprovante ou clique do lojista.
2. **Lojista** é um personal trainer, estúdio ou influenciador. Cria conta, escolhe plano, envia solicitação e aguarda aprovação. Após liberação, configura uma loja pública, produtos/serviços, Pix próprio, pedidos e perfil de conteúdo. Pode solicitar renovação ou mudança de plano; a cobrança é gerada com o preço corrente do plano.
3. **Cliente/seguidor** acessa `/p/:slug`, escolhe produtos ou serviços, registra um pedido e paga ao lojista via Pix. O lojista confere o crédito e confirma o pedido com autoria e data registradas. A assinatura SaaS do lojista é uma cobrança separada, paga ao Pix da plataforma e confirmada pelo Master. A publicação da vitrine exige WhatsApp válido para o checkout funcionar.

## Estados da assinatura

`pending` na solicitação → aprovação do Master → `trial` por 14 dias → cobrança `pending` → comprovante informado (`proof_sent`) → Master confirma (`paid`) → assinatura `active` por mais 30 dias a partir do maior valor entre o vencimento vigente e a data da confirmação. Se o Master rejeita, o vencimento não muda. Após o vencimento, a loja pública e as ferramentas de IA deixam de operar até regularização; o lojista ainda acessa a página de plano para solicitar a cobrança. Suspensão pelo Master impede a publicação.

O pagamento é manual. Não existe renovação automática, gateway ou liberação baseada apenas em comprovante. Histórico e auditoria ficam em `subscription_payments` e `subscription_events`.

## Planos de lançamento

| Plano | Mensalidade | Produtos | Solicitações de IA por espaço/dia |
| --- | ---: | ---: | ---: |
| Essencial | R$ 29 | 5 | 5 |
| Criador | R$ 59 | 30 | 12 |
| Crescimento | R$ 99 | 100 | 20 |

Preço e limites são armazenados em `platform_plans` e podem ser alterados pelo Master. A cobrança criada preserva o valor histórico do momento da solicitação. Há teto adicional de 20 solicitações de IA por usuário/dia.

## Diferencial de conteúdo

- O lojista descreve seu público, tom, objetivos, equipamentos/métodos quando aplicáveis e temas proibidos.
- A IA gera roteiro detalhado de story/post e grava a ideia em revisão. O lojista edita e aprova antes de usar.
- A pesquisa de tendências é opcional. Quando habilitada, a geração consulta fontes atuais e salva os links consultados. Sem fontes, o produto não apresenta a ideia como tendência comprovada. Pesquisa na web não equivale a dados internos do Instagram/TikTok.
- O assistente Gemini responde apenas dúvidas de comunicação e conteúdo relacionadas ao nicho e usa o mesmo limite diário da geração.
- O lojista pode marcar lembretes de publicação ou WhatsApp em `content_reminders`. A marcação não envia mensagem. O teste atual abre a conversa no WhatsApp para revisão e envio manual.

## Stack mínima

React/Vite no Cloudflare, Supabase para Auth/Postgres/RLS/Edge Functions, Gemini no servidor e WhatsApp manual no MVP. Tokens do Gemini/Meta jamais entram no frontend. O código pode evoluir para WhatsApp Business oficial com consentimento e fila por lojista, sem depender de n8n para a operação inicial.

## Verificação antes de publicar

- Build de produção e navegação nas três áreas.
- Conta do Master realmente presente em `auth.users` e `platform_admins` do projeto Academia.
- RLS impede um novo usuário de criar workspace sem aprovação e de alterar plano/vencimento.
- Pix da plataforma configurado antes de gerar mensalidade; valor calculado no banco.
- Cobrança só altera assinatura após confirmação pelo Master; rejeição não avança vencimento.
- Ideias com pesquisa exibem fontes; sem pesquisa não alegam tendência atual.
- Nenhum lembrete é apresentado como disparo automático de WhatsApp.
- A conferência do Pix do pedido da loja usa uma transição protegida, não uma atualização direta do status.

As lacunas para produção completa estão em [STATUS_DO_MVP.md](STATUS_DO_MVP.md), incluindo antiabuso do checkout, MFA do Master e envio oficial do WhatsApp.
