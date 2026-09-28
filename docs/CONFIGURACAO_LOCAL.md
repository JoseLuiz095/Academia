# Configuração local do Impulso

## Vite e Supabase

Na pasta `work/creator-saas`, crie o arquivo local a partir do exemplo:

```powershell
Copy-Item .env.example .env.local
```

Depois preencha apenas no arquivo `.env.local`:

```env
VITE_SUPABASE_URL=https://vnpoinodvchmmbyxpacj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_copie-a-do-painel
VITE_WHATSAPP_TEST_PHONE=
```

A chave deve ser a **Publishable key** em Supabase > Project Settings > API. Nunca use `service_role`, chave secreta do Gemini ou token do WhatsApp em uma variável `VITE_*`, porque o Vite envia esse conteúdo para o navegador.

Após salvar, encerre e inicie novamente o servidor:

```powershell
npm run dev
```

Se a tela de login continuar informando que o Supabase não está configurado, confira se o arquivo se chama exatamente `.env.local` e se o terminal foi reiniciado.

## Telefone para o teste manual

O painel em `/admin/whatsapp` aceita o telefone com DDI e DDD. Para deixá-lo pré-preenchido apenas no seu computador, informe os dígitos em `VITE_WHATSAPP_TEST_PHONE`, por exemplo `5511999999999`, sem espaços ou símbolos. Use o seu próprio número ou um contato que autorizou o teste.

Esse fluxo abre o WhatsApp com uma mensagem preparada. O envio só acontece quando você confirma no próprio WhatsApp. A automação oficial exigirá a API WhatsApp Business Cloud, consentimento dos destinatários, templates quando aplicável e um servidor/Edge Function; o n8n pode orquestrar esse fluxo depois, mas não deve automatizar o WhatsApp Web de forma não oficial.

## Admin de teste

`/admin/demo` é um painel demonstrativo local. Ele não cria usuário, workspace ou dados no Supabase e não substitui autenticação.

Para criar a conta real, acesse `/admin/login`, escolha **Criar minha conta**, use um e-mail que você controla e confirme o e-mail enviado pelo Supabase. Depois o onboarding cria o espaço do personal ou criador.
