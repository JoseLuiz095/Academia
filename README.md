# Academia — aplicação web

MVP web em React + Vite para personal trainers e criadores de conteúdo.

## O que existe nesta primeira versão

- Dashboard do personal com receita, clientes, conteúdos e atividade recente.
- Navegação entre Visão geral, Conteúdo IA, Produtos, Clientes e WhatsApp.
- Modal interativo para solicitar uma nova ideia de conteúdo.
- Catálogo inicial de produtos digitais e serviços.
- Estado demonstrativo enquanto o Auth e as tabelas do Supabase são conectados.
- Cliente Supabase preparado em `src/lib/supabase.ts`.

## Executar localmente

```bash
npm install
npm run dev
```

Para ativar a conexão com o Supabase, copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://vnpoinodvchmmbyxpacj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
```

Nunca coloque a chave `service_role` no frontend.

## Próxima etapa

Criar a migration inicial de workspaces, membros, perfil público, produtos e conteúdo com RLS no projeto Supabase `Academia`.
