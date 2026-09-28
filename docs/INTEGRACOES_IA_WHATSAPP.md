# IA e WhatsApp — decisão para o MVP

Atualizado em 28/09/2026. Este documento separa o que está implementado do que depende de credenciais, consentimento e integração de produção.

## Gemini para todos os administradores

- **Hoje no código:** a Edge Function `generate-content-idea` usa `gemini-3.5-flash-lite` por padrão. O acesso exige sessão e participação no espaço; existe limite interno de 20 gerações por usuário/espaço/dia. A chave fica somente no servidor. Sem secret remoto, a interface ainda oferece criação manual e cópia do prompt.
- **Recomendação:** usar o nível gratuito apenas para desenvolvimento e poucos usuários-piloto. Antes de abrir o SaaS a vários administradores, habilitar o nível pago da **Gemini API** no Google AI Studio, mantendo o Flash-Lite. Não é necessário contratar uma assinatura de aplicativo “Gemini Pro” para isso; a cobrança da API é por uso. Um único projeto/chave de servidor pode atender os espaços, mas todos compartilham os limites do projeto. Acompanhar RPM, TPM, RPD, erros 429 e gasto. Limites reais são exibidos no AI Studio e podem mudar.
- **Privacidade:** usar perfis de público agregados, sem nomes, telefones ou dados de saúde de alunos nos prompts. A tabela oficial de preços informa uso de dados para melhoria dos produtos no nível gratuito e não no pago; conferir os termos aplicáveis antes de processar dados reais.
- **Preço de referência da API:** na modalidade Standard paga, `gemini-3.5-flash-lite` custa US$ 0,30 por 1 milhão de tokens de entrada e US$ 2,50 por 1 milhão de tokens de saída, incluindo tokens de raciocínio. Uma ideia ilustrativa com 1.000 tokens de entrada e 500 de saída custaria cerca de **US$ 0,00155**; 10.000 ideias semelhantes, cerca de **US$ 15,50**. É só uma estimativa: tokens reais, tentativas, impostos, câmbio e ferramentas extras alteram o custo. Não usar esse exemplo como teto de faturamento. [Preços oficiais](https://ai.google.dev/gemini-api/docs/pricing) · [limites oficiais](https://ai.google.dev/gemini-api/docs/rate-limits) · [cobrança da API](https://ai.google.dev/gemini-api/docs/billing/).
- **Quando trocar de modelo:** avaliar um Flash mais capaz somente se os rascunhos do Lite não atenderem a qualidade desejada. Pro não é a escolha econômica para ideias curtas de posts/stories. Fazer um pequeno teste com exemplos reais e revisão humana antes de mudar.

## WhatsApp Business em etapas

### 1. MVP atual — manual e sem nova plataforma

O número do profissional abre `wa.me` para o cliente iniciar uma conversa. O criador pode abrir uma prévia de mensagem **aprovada** para um contato de teste e apertar o envio no próprio WhatsApp. O sistema não dispara, não agenda nem registra entrega de mensagens. Um pedido com referência é confirmado no painel depois de o profissional conferir o Pix no banco; a entrega é combinada manualmente.

### 2. Teste automatizado opcional — n8n + API oficial

O n8n é um orquestrador de fluxos, **não** uma versão não oficial do WhatsApp. Ele oferece um nó de [WhatsApp Business Cloud](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.whatsapp/) para usar a API autorizada. Para um laboratório isolado:

1. Criar a conta/app de desenvolvedor Meta e obter um número/ambiente de teste permitido pela Cloud API.
2. Guardar token, identificador do número e demais credenciais apenas no n8n/servidor; nunca no React ou no Git.
3. Disparar **somente para números de teste autorizados**, a partir de um fluxo manual no n8n, sem importar contatos reais nem executar campanhas.
4. Registrar destinatário, tipo de mensagem, horário, resposta da API e falha, mas sem armazenar credenciais ou conteúdo sensível em logs abertos.
5. Só integrar o fluxo ao Impulso após definir consentimento, limites, titularidade do número e tratamento de falhas.

Esse laboratório exigiria executar o n8n em algum ambiente separado; **Cloudflare Pages não hospeda um servidor n8n persistente**. Se a prioridade continuar sendo operar só com Cloudflare + Supabase + Meta, a futura chamada pode sair de uma Edge Function/Worker para a API oficial, sem n8n.

**Não usar automação de WhatsApp Web, QR de sessão ou bibliotecas não autorizadas para disparos.** Isso adiciona risco de bloqueio da conta e não é uma base sustentável para um SaaS multicliente. A [política oficial](https://business.whatsapp.com/policy/preview?lang=pt_BR) exige consentimento para contatos iniciados pela empresa, modelos aprovados para iniciar conversas e resposta livre somente dentro da janela de atendimento de 24 horas.

### 3. Produção — integração por profissional

Fluxo proposto:

`ideia revisada e aprovada → campanha em rascunho → público com consentimento válido → aprovação explícita do envio → fila no servidor → WhatsApp Business Platform → status/erros no painel`

Antes de codificar disparos em produção, criar:

- vínculo de cada espaço a um número/conta WhatsApp Business autorizado (ou identificar claramente um remetente único da plataforma em um piloto);
- contatos por espaço com origem do consentimento, finalidade, data e opção de descadastro; sem compartilhar listas entre profissionais;
- modelos de mensagem aprovados quando o profissional inicia o contato ou a janela de 24 horas está fechada;
- fila com limite por espaço, deduplicação/idempotência, tentativas controladas, pausa e auditoria;
- processamento de webhooks de entrega/erro e opção de encaminhar a conversa para atendimento humano;
- credenciais e tokens apenas no backend, RLS para dados de contatos/campanhas e testes de isolamento entre espaços;
- avaliação do custo de mensagens da Meta e política de privacidade adequada antes de captar alunos/clientes.

Nenhum item desta etapa 3 está ativo. A interface não deve apresentar “envio automático” enquanto a integração e as salvaguardas não existirem.
