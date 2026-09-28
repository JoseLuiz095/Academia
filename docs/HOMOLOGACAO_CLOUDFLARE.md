# Configurar o login na homologação

O `.env.local` funciona somente na máquina local. Como o Vite substitui `import.meta.env.VITE_*` durante o build, essas variáveis precisam ser cadastradas no projeto do Cloudflare antes de gerar um novo deploy.

## Cloudflare Pages

1. Abra **Workers & Pages** no painel Cloudflare.
2. Selecione o projeto da Academia.
3. Acesse **Settings → Environment variables** (em algumas contas aparece como **Variables and Secrets**).
4. Cadastre estas variáveis no ambiente que será publicado:

```text
VITE_SUPABASE_URL=https://vnpoinodvchmmbyxpacj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave publicável do Supabase>
```

Use a chave em **Supabase → Project Settings → API → Publishable key**. Não use `service_role`, `secret` ou qualquer chave privada no frontend.

5. Salve as variáveis.
6. Em **Deployments**, faça um novo deploy da branch `main` ou use **Retry deployment** depois de salvar.

O comando de build deve ser `npm run build` e o diretório de saída deve ser `dist`. Se o repositório estiver configurado como monorepo, o diretório raiz precisa apontar para `work/creator-saas`.

## Como validar

Abra:

```text
https://academia.joseluizacama.workers.dev/admin/login
```

Depois do novo deploy, a mensagem **Configuração de homologação incompleta** deve desaparecer. Se ela continuar, o deploy usou outro ambiente (Preview/Produção) ou foi criado antes de as variáveis serem salvas.

## Se aparecer `Invalid API key`

Isso significa que o build publicado recebeu uma chave que o Supabase rejeitou. Confira, sem compartilhar a chave:

1. No Supabase, abra **Project Settings → API** do projeto cujo ref é `vnpoinodvchmmbyxpacj`.
2. Copie a **Publishable key** ativa desse mesmo projeto. Uma chave de outro projeto, desativada, com aspas ou com espaços no início/fim falha mesmo quando o formato parece correto.
3. No Cloudflare, confira as variáveis no ambiente que realmente está sendo publicado — **Production** e **Preview** são separados — e use exatamente:

```text
VITE_SUPABASE_URL=https://vnpoinodvchmmbyxpacj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

4. Salve e gere um novo deploy. Como o Vite incorpora `VITE_*` durante o build, alterar apenas uma variável em runtime não corrige um bundle antigo.

Não use `service_role`, `secret` ou a chave do Gemini no frontend. Se o erro persistir, abra o Network do navegador e confirme apenas o domínio da requisição e o status HTTP; não copie o header `apikey` para mensagens ou tickets.

Referência oficial: [variáveis e configuração de build no Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/).
