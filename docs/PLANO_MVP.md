# Academia — plano de produto e arquitetura do MVP

## 1. Proposta

Uma plataforma para o profissional ou influenciador:

- configurar sua identidade, público e regras de comunicação;
- receber ideias de posts e stories geradas por IA;
- revisar, editar e aprovar cada ideia;
- enviar conteúdo aprovado pelo WhatsApp para clientes ou lista opt-in;
- vender avaliações, fichas/manuais digitais, acessórios, roupas, suplementos e outros produtos;
- publicar uma página própria com catálogo, serviços, locais de atendimento e pedidos.

O foco inicial deve ser **venda e relacionamento para personal trainers**, mantendo o modelo de dados capaz de atender outros criadores depois.

**Estado em 25/09/2026:** a aplicação já usa React + Vite e possui as três áreas do FoodWeb (vitrine pública, Admin do criador e Admin Master). Catálogo, configurações e biblioteca de ideias usam o projeto Supabase `Academia`. A Edge Function do Gemini foi publicada, mas requer `GEMINI_API_KEY` para gerar conteúdo. Pedido, confirmação Pix, entrega digital, planos SaaS e disparo automático de WhatsApp ainda são etapas futuras.

## 2. Perfis e áreas

### Admin master da plataforma

- gerencia workspaces, planos e status da conta;
- acompanha uso de IA, mensagens e vendas;
- revisa configurações globais e auditoria;
- não deve acessar dados de clientes de um workspace sem permissão operacional registrada.

### Admin do workspace (personal/criador)

- configura perfil, marca, nicho e tom de voz;
- define público, objetivos, equipamentos, modalidades, frequência e restrições;
- cadastra produtos e serviços;
- configura locais e horários de atendimento;
- aprova ideias de conteúdo;
- cria campanhas e acompanha entregas;
- acompanha clientes, pedidos e agenda.

### Cliente/seguidor

- acessa a página pública do criador;
- compra produtos ou serviços;
- informa dados mínimos necessários ao atendimento;
- recebe mensagens somente com consentimento válido;
- pode cancelar comunicações e solicitar seus dados.

## 3. Escopo do MVP

### Entram no MVP

1. Autenticação e criação do workspace.
2. Página pública do criador com slug personalizado.
3. Catálogo com três tipos de item:
   - serviço/agendamento, como avaliação presencial ou online;
   - produto digital, como manual ou ficha de treino;
   - produto físico, como roupa, acessório ou suplemento.
4. Cadastro de locais de atendimento e disponibilidade básica.
5. Configuração da IA:
   - nicho e subnicho;
   - público-alvo;
   - tom de voz;
   - objetivos de conteúdo;
   - equipamentos, métodos e temas permitidos;
   - temas proibidos e avisos obrigatórios.
6. Geração de ideias estruturadas para post/story, com edição e aprovação.
7. Lista de contatos com status de opt-in/opt-out.
8. Integração inicial com WhatsApp Business Cloud API ou BSP oficial, sempre por servidor.
9. Envio de mensagens aprovadas, histórico e status de entrega.
10. Pedido simples com Pix copia e cola, deixando outras formas de pagamento para negociação direta com o personal.
11. RLS e auditoria por workspace desde a primeira migration.

Para evitar uma quinta plataforma no protótipo, o primeiro fluxo de venda pode funcionar como **pedido iniciado na página e concluído por Pix/WhatsApp**. Cartão, boleto, parcelamento e split ficam fora do MVP e podem ser tratados diretamente com o personal.

### Pix em duas etapas

#### Etapa 1 — confirmação manual, sem gateway

- o personal cadastra sua chave Pix;
- a página mostra a chave e, quando possível, QR Code/Pix copia e cola;
- o cliente envia o comprovante pelo WhatsApp ou pela página;
- o personal confirma o pagamento manualmente;
- somente depois disso o sistema libera o manual digital ou confirma a avaliação.

Essa é a opção mais simples para validar o produto e não exige contratar uma plataforma de pagamentos. O sistema deve deixar claro que o pedido está `aguardando confirmação`.

#### Etapa 2 — confirmação automática

- o sistema solicita uma cobrança Pix a um provedor compatível;
- salva o código copia e cola, QR Code e ID externo;
- recebe o webhook do pagamento;
- altera o pedido para `pago` somente após confirmação do provedor;
- libera automaticamente o arquivo digital ou agenda o serviço.

Essa evolução deve usar a mesma entidade `payments`, sem alterar o fluxo de pedidos. Os campos principais são `method`, `status`, `copy_paste_code`, `qr_code_url`, `external_id`, `paid_at` e `confirmed_by`.

Nunca liberar produto digital apenas porque o cliente enviou uma imagem de comprovante; na modalidade manual, a liberação depende da confirmação do personal.

### Ficam fora da primeira versão

- publicação automática no Instagram;
- prescrição clínica ou diagnóstico de saúde;
- acompanhamento completo de cargas, séries e evolução;
- marketplace entre criadores;
- automações complexas de funil;
- múltiplos provedores de pagamento simultaneamente;
- geração autônoma e envio sem aprovação humana.

## 4. Arquitetura recomendada

### Aplicação

- React com TypeScript, Vite e React Router, com build estático em `dist`;
- Supabase Auth para autenticação;
- Supabase Postgres para dados transacionais;
- Supabase Storage para imagens e arquivos digitais;
- Supabase Edge Functions para webhooks, IA e integração WhatsApp;
- Cloudflare Pages para hospedagem, domínio e cache;
- CSS próprio para preservar a identidade visual aprovada do Academia.

### Integrações

- **IA:** Gemini chamado exclusivamente no backend. A saída deve ser JSON validado, não texto livre usado diretamente na tela ou no WhatsApp.
- **WhatsApp:** Cloud API oficial ou provedor oficial compatível. Tokens, webhooks e credenciais ficam fora do cliente.
- **Pagamentos:** começar com `manual_pix` e deixar `pix_gateway` preparado para uma futura integração automática.

O modelo de IA deve ser configurável por ambiente (`AI_MODEL`): um modelo econômico para desenvolvimento e um modelo mais forte quando o produto entrar em produção. Dessa forma, o código não fica preso ao nome ou à versão de um modelo específico.

### Stack mínima por ambiente

#### Desenvolvimento e validação

- Cloudflare Pages para hospedar o frontend estático;
- Supabase no plano gratuito para Auth, banco e Storage;
- WhatsApp Business em modo de teste, com poucos destinatários autorizados;
- Gemini API com limite de gasto configurado;
- sem fila, sem Redis, sem observabilidade paga e sem ferramenta de automação externa.

#### Produção inicial

- manter a mesma arquitetura;
- ativar os planos pagos somente quando houver usuários, tráfego ou necessidade de backup/limites maiores;
- adicionar Cloudflare Queues ou Workflows somente quando o volume de mensagens justificar processamento assíncrono;
- adicionar serviço de pagamentos quando o checkout real entrar no MVP comercial.

Cloudflare Workers não é obrigatório no começo. O build estático do Vite pode ser hospedado no Pages, enquanto a lógica sensível fica nas Edge Functions do Supabase. [Guia Vite no Cloudflare](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite-site/)

O código deve esconder cada integração atrás de uma interface simples (`AiProvider`, `MessagingProvider` e `PaymentProvider`). Assim, o MVP não depende de várias plataformas, mas continua preparado para trocar Gemini, WhatsApp ou checkout sem reescrever o domínio.

### Distribuição de responsabilidades

| Componente | Responsabilidade inicial |
| --- | --- |
| Cloudflare | frontend, domínio, cache, proteção e Worker/rotas de borda |
| Supabase | autenticação, PostgreSQL, Storage, RLS e funções de backend |
| WhatsApp Business | entrega das mensagens e webhooks de status |
| Gemini | geração de ideias, roteiros e respostas simples |
| Academia | regras de negócio, aprovação, consentimento, campanhas e auditoria |

### Fluxo seguro da IA

1. Usuário solicita ideias para um objetivo.
2. Backend carrega somente o contexto permitido daquele workspace.
3. Gemini retorna uma estrutura validada:
   - formato: story/post;
   - gancho;
   - roteiro ou legenda;
   - CTA;
   - sugestão de mídia;
   - observações e alertas.
4. Usuário revisa e aprova.
5. Apenas o conteúdo aprovado entra em campanha.

## 5. Modelo de dados inicial

Todas as tabelas de domínio devem possuir `workspace_id`, salvo entidades globais explicitamente definidas.

### Identidade e tenancy

- `profiles`
- `workspaces`
- `workspace_members`
- `workspace_settings`
- `audit_logs`

### Configuração de conteúdo

- `content_profiles`
- `audience_profiles`
- `content_ideas`
- `content_templates`
- `content_approvals`

### Clientes e consentimento

- `customers`
- `customer_consents`
- `customer_tags`
- `customer_tag_links`

### WhatsApp e campanhas

- `whatsapp_connections`
- `campaigns`
- `campaign_recipients`
- `whatsapp_messages`
- `message_events`

### Loja e atendimento

- `products`
- `product_files`
- `service_locations`
- `service_availability`
- `product_location_rules`
- `orders`
- `order_items`
- `appointments`
- `fulfillments`

### Regras importantes

- `products.kind` deve ser `service`, `digital` ou `physical`.
- Um produto digital não deve expor o arquivo diretamente; o acesso deve usar URL assinada e autorização do pedido.
- Telefones devem ser normalizados para E.164 e ter índice/unique por workspace quando necessário.
- Consentimento precisa registrar finalidade, origem, versão do texto, data, IP/identificador técnico quando aplicável e revogação.
- Mensagens devem ter `idempotency_key`, provedor, ID externo e status para evitar duplicidade.

## 6. Segurança e LGPD

- Habilitar RLS em toda tabela exposta e escrever políticas por operação.
- Não usar `user_metadata` para autorização; a relação usuário-workspace deve estar no banco e ser verificada por policy/função segura.
- Nunca enviar `service_role` ou token do WhatsApp para o navegador.
- Separar dados comerciais de dados de avaliação física.
- Coletar somente o necessário para a oferta ou atendimento.
- Criar exportação, exclusão e revogação de consentimento.
- Inserir revisão humana e avisos para qualquer conteúdo que possa ser interpretado como orientação de saúde.
- Registrar auditoria de acesso administrativo e de alterações de consentimento.

## 7. Fluxos principais

### Onboarding do personal

1. Cria conta.
2. Escolhe o template `fitness`.
3. Configura perfil público e slug.
4. Define público, método, tom e regras da IA.
5. Cadastra primeiro produto/serviço.
6. Conecta WhatsApp e valida webhook.

### Ideia até envio

`brief do personal -> geração -> revisão -> aprovação -> campanha -> opt-in -> envio -> webhook -> histórico`

### Compra de avaliação

`página pública -> serviço -> local/horário -> checkout -> pedido pago -> agendamento -> confirmação`

## 8. Base visual

O Academia usa identidade própria em CSS, preservada nesta implementação. O FoodWeb serviu como referência para as três áreas, a navegação e o fluxo comercial; não copiamos regras de alimentação, banco compartilhado ou componentes visuais do outro produto.

Referências consultadas:

- [nextjs/saas-starter](https://github.com/nextjs/saas-starter)
- [tremorlabs/tremor](https://github.com/tremorlabs/tremor)
- [TailAdmin/free-nextjs-admin-dashboard](https://github.com/TailAdmin/free-nextjs-admin-dashboard)
- [horizon-ui/shadcn-nextjs-boilerplate](https://github.com/horizon-ui/shadcn-nextjs-boilerplate)

## 9. Ordem de implementação

1. Criar o app React/Vite e o sistema visual.
2. Criar Auth, workspaces, membros, slug e RLS.
3. Criar página pública e catálogo.
4. Criar produtos digitais/serviços e Storage protegido.
5. Criar configuração e geração de ideias com aprovação.
6. Criar contatos, consentimentos e campanhas.
7. Integrar WhatsApp com webhook e idempotência.
8. Integrar checkout escolhido.
9. Criar painel master, limites de plano e auditoria.

## 10. Custos e limites

É possível validar o MVP usando planos gratuitos, mas isso não significa custo zero em todos os fluxos. O WhatsApp Business pode envolver configuração, aprovação de templates e cobrança por mensagens conforme a política vigente da Meta. A API Gemini possui limites de uso e controles de gasto; a aplicação deve registrar consumo por workspace e impor limite diário/mensal.

O Cloudflare Workers possui plano gratuito com limites diários e plano pago separado; o Supabase também possui plano gratuito com limites e possibilidade de pausa em projetos inativos. Esses limites devem ser tratados como configuração operacional, não como requisito do domínio. [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/) · [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase) · [Gemini billing](https://ai.google.dev/gemini-api/docs/billing)

## 11. Decisões que precisam ser confirmadas

1. O `project_ref` do Supabase `Academia` é `vnpoinodvchmmbyxpacj`.
2. O Pix inicial será confirmado manualmente pelo personal; gateway automático fica para a segunda etapa.
3. A integração de disparos WhatsApp será com Cloud API oficial da Meta ou um BSP já contratado? A primeira etapa usa conversa individual via link.
4. A primeira oferta comercial pode ser um manual digital ou avaliação para validar a vitrine.
