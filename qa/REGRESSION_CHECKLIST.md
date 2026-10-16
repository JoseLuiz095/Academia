# Checklist de regressão do Impulso

Esta lista acompanha o produto e deve ser executada antes de publicar uma versão.

## Viewports

- [ ] 390 × 844: nenhuma tela cria rolagem horizontal.
- [ ] 768 × 1024: formulários e tabelas continuam utilizáveis.
- [ ] 1280 × 768: sidebar, cabeçalho e conteúdo não se sobrepõem.
- [ ] Teclado virtual no celular não cobre o botão principal.

## Conta e aprovação

- [ ] Cadastro envia confirmação de e-mail e o link retorna para a origem correta.
- [ ] Login do Admin funciona sem Supabase configurado apenas no modo demonstração.
- [ ] Solicitação Demo segue para aprovação sem cobrança.
- [ ] Plano pago mostra Pix copia e cola e não cria solicitação antes do comprovante.
- [ ] Abrir o WhatsApp não é considerado envio do comprovante.
- [ ] Admin Master só aprova plano pago com comprovante informado.
- [ ] Rejeição e aprovação preservam observação e aparecem no histórico.

## Catálogo, compra e acesso

- [ ] Vitrine mostra preço, categoria, nível, documentos profissionais e CTA legível.
- [ ] Checkout recalcula o total no servidor e não duplica o pedido ao repetir o envio.
- [ ] Falha de pagamento preserva o carrinho e apresenta uma ação de recuperação.
- [ ] Pedido confirmado aparece na fila operacional antes do histórico.
- [ ] Pedido confirmado libera o acesso somente após a ação do Admin.
- [ ] Token vincula o primeiro dispositivo e rejeita outro dispositivo.
- [ ] “Acesse seu conteúdo” reúne todos os produtos do pedido em uma biblioteca.

## Treino, dieta e avaliação

- [ ] Admin consegue criar treino com dias da semana, duração, execução e descanso.
- [ ] Prévia do Admin corresponde ao que o cliente verá.
- [ ] Timer inicia, pausa, avança, emite sinal sonoro e encerra com estado de conclusão.
- [ ] Exercícios possuem nome em português, instruções e crédito/licença da fonte visual.
- [ ] Dieta mostra porções, componentes e observações sem apresentar diagnóstico médico.
- [ ] Avaliação respeita disponibilidade, exceções, feriados e reagendamento.
- [ ] Horário só é efetivado depois de pagamento confirmado e aprovação profissional.

## IA e notificações

- [ ] Perfil do nicho limita o contexto da IA e apresenta aviso de revisão humana.
- [ ] Limite diário é aplicado no servidor e falhas não consomem cota indevidamente.
- [ ] Erros da IA apresentam orientação acionável e não uma mensagem genérica sem contexto.
- [ ] Permissão de notificações é solicitada somente em contexto claro.
- [ ] Negação do navegador não quebra o portal; avisos internos continuam disponíveis.
- [ ] Admin consegue enviar aviso por produto ou para todos os acessos ativos.
- [ ] Cliente consegue marcar avisos como lidos.

## Segurança e operação

- [ ] RLS impede que um workspace leia ou altere dados de outro.
- [ ] Chaves secretas ficam somente em Edge Functions/secrets.
- [ ] Turnstile e validação de origem protegem checkout e denúncias públicas.
- [ ] Webhook do Asaas valida segredo, é idempotente e registra falhas.
- [ ] Eventos administrativos e alterações de assinatura aparecem na auditoria.
- [ ] Expiração/suspensão não apaga produtos, pedidos ou conteúdos já vendidos.

