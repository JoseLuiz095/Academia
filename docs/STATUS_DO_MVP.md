# Status do Impulso em 29/09/2026

## Fluxo disponível

- Cadastro do criador com plano escolhido, fila de aprovação e 14 dias de teste após liberação pelo Admin Master.
- Planos e limites editáveis pelo Master. O lojista solicita cobrança Pix da plataforma; informar comprovante não renova. Só a confirmação do Master avança o vencimento em 30 dias e registra auditoria.
- Vitrine pública por marca, catálogo, sacola, pedido com preço calculado no banco, Pix do lojista com valor e confirmação manual auditada por quem marcou o pedido.
- Perfil de conteúdo, ideias detalhadas, pesquisa opcional na web com fontes, revisão humana, lembretes no painel e assistente Gemini limitado ao nicho e à cota diária do plano.
- WhatsApp manual: o profissional ou cliente abre a conversa com mensagem preparada e decide se a envia. Não há disparo automático.
- Layout da página comercial, loja, carrinho, checkout e navegação do painel adaptados para celular.

## Configuração necessária para teste real

1. Confirmar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no build do Cloudflare; a chave local não é publicada automaticamente.
2. Confirmar `GEMINI_API_KEY` como segredo das Edge Functions no projeto Supabase Academia. Jamais usar `VITE_` para esta chave.
3. Entrar como Admin Master, configurar o Pix da plataforma e o WhatsApp financeiro em **Pagamentos e Pix**.
4. Criar ou aprovar um criador de teste, publicar sua vitrine com WhatsApp válido, cadastrar produto e testar pedido/Pix. O pagamento de teste não deve ser confirmado sem crédito real no banco.

## Pendências para operar além do MVP

- Integração oficial da API do WhatsApp Business com número, token, modelos aprovados, consentimento e processamento agendado. O lembrete atual não faz envio automático.
- Proteção antiabuso do pedido anônimo (Turnstile validado no servidor e limitação de tentativas). A idempotência atual evita duplicação acidental, mas não abuso deliberado.
- MFA/AAL2 obrigatório para Master, com fluxo de cadastro e recuperação antes de ativar a exigência para não bloquear o proprietário.
- Entrega digital protegida e coleta mínima de dados para envio físico/agendamento dentro da plataforma. Hoje a entrega é combinada no WhatsApp.
- Testes ponta a ponta com contas autenticadas e uma vitrine publicada em celular real. Compilação e políticas do banco não substituem esses testes.
