# Impulso / base candidata Fit — correções e segurança

22/10/2026. O repositório `Academia` identifica o produto como Impulso; o vínculo literal com Fit de COSMIN precisa de confirmação. A auditoria usou o código real e fixtures locais. O projeto Supabase documentado `vnpoinodvchmmbyxpacj` não aparece na conexão atual. Não houve consulta/migração/deploy remoto.

## Entregue

- Alertas administrativos agora dependem das pendências carregadas no Dashboard. O scheduler não cria avisos administrativos fictícios a cada 15 minutos.
- O opt-out é respeitado imediatamente, inclusive mudanças de preferência na mesma aba ou em outra aba. Falha de carregamento não gera alerta.
- Lembretes locais do cliente continuam por workspace; textos esclarecem a dependência do painel aberto.
- `npm test`: três casos de regressão aprovados. `npm run build`: TypeScript e Vite aprovados. `git diff --check`: aprovado.

## Draft de integridade, não aplicado

`supabase/drafts/tenant_reference_guards.sql` valida referências entre tenant/produto/token/pedido/disponibilidade/item nas tabelas de avisos e avaliações. Não altera status, pagamento, planos ou histórico. O teste local reproduz três vínculos indevidos antes dos guards e depois verifica bloqueios e operações legítimas entre empresas sintéticas fitness e creator, com RLS.

Execução reproduzível, reutilizando a dependência de desenvolvimento já existente no VendeWeb:

```sh
PGLITE_MODULE_URL=file:///caminho/absoluto/Food-Service-SaaS/node_modules/@electric-sql/pglite/dist/index.js node --test scripts/tenant-reference-guards.test.mjs
```

Foi usado PGlite 0.3.14. Resultado: um caso PostgreSQL aprovado, contendo as tentativas permitidas/negadas. Isso não testa o esquema remoto completo. Antes de promover o draft: inventariar referências existentes, roles/grants/policies e fluxos de servidor; revisar proteção contra mover registros-pai entre workspaces e testar o esquema real. O draft fica fora de `migrations/` para impedir aplicação automática.

## Pendências críticas

1. `src/layouts/PublicLayout.tsx` consulta `products.content`, concedido a `anon` por `20261005121000_expose_product_content.sql`; `StoreContent.tsx` renderiza seus itens. A liberação por token em `access-product` não protege uma cópia já pública. A migration inicial também concede leitura a `authenticated`, e a policy permite produtos publicados. Corrigir ambos os papéis com conteúdo privado separado de prévia comercial, em mudança coordenada de backend/frontend. Não resolvido nesta entrega; estado remoto não confirmado.
2. `evaluation_bookings_member_update`, em `20261005150000_evaluation_scheduling.sql`, permite UPDATE amplo. Restringir transições críticas a RPCs autorizadas. O draft de referências não resolve a autorização de status/pagamento.
3. Dados clínicos/documentos privados precisam de modelo próprio de autorização, consentimento e retenção; não tratá-los como produto público. Ainda faltam jornadas completas de alunos/pacientes, acompanhamento e campanhas Creator.

Não foram alteradas cobranças reais, confirmações de pagamento, marcas, credenciais ou permissões remotas. Não foi realizado redesign integral. A proposta de destino é um monólito modular no VendeWeb, usando aplicações separadas como transição e preservando os contratos especializados.

Relatório consolidado: `Food-Service-SaaS/docs/AUDITORIA_MODULAR_FIT_20261022.md`, na branch desta entrega. Ele contém arquitetura, comparação de estratégias, planos/custos, reaproveitamento, validação e prioridades.
