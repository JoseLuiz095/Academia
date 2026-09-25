# Academia — orientação para agentes

- Este é um produto novo e independente. O FoodWeb é referência de organização em três áreas (Admin Master, Admin do profissional, página pública), não uma fonte de regras de alimentação ou uma lista de recursos a copiar.
- Priorize necessidades de personal trainers e criadores: produtos/serviços, vitrine, conteúdo com IA revisado por humano e atendimento via WhatsApp.
- Preserve a identidade visual atual do Academia. Mantenha a aplicação simples de operar por uma pessoa.
- Banco oficial: projeto Supabase `Academia` (`vnpoinodvchmmbyxpacj`). Não grave dados em projetos ou tabelas do FoodWeb/FloriWeb.
- Toda tabela exposta deve ter RLS; acesso ao workspace depende de vínculo real no banco. Não use metadados editáveis pelo usuário como autorização.
- Chaves `service_role`, Gemini e WhatsApp são somente de servidor. O frontend recebe apenas URL e chave publicável do Supabase.
- Não marque pagamento como confirmado por clique, comprovante ou retorno do navegador. A confirmação Pix inicial é manual pelo profissional.
- Ideias geradas por IA entram em revisão; publicação ou envio exigem aprovação explícita.
- Revise o diff antes de aplicar migrations, publicar funções ou enviar alterações ao GitHub. Valide o build e os diagnósticos do Supabase após mudanças de banco.
