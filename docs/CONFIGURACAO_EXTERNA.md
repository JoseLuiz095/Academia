# Configuração externa antes de publicar

## 1. Cloudflare Turnstile

1. No Cloudflare Dashboard, abra **Turnstile** e crie ou edite o widget do Impulso.
2. Cadastre `localhost`, o endereço de homologação `academia.joseluizacama.workers.dev` e o futuro domínio próprio em **Hostnames**.
3. Salve a chave pública como `VITE_TURNSTILE_SITE_KEY` no arquivo `.env.local` para desenvolvimento e nas variáveis de build do Cloudflare para produção.
4. Salve a chave secreta como `TURNSTILE_SECRET_KEY` nos segredos das Edge Functions do projeto Supabase. Nunca a coloque em arquivos Vite, código do navegador ou Git.
5. Faça um teste real de cadastro e de envio de comprovante após publicar. O widget deve aceitar o domínio e a função deve validar o token no servidor.

## 2. Senhas vazadas no Supabase Auth

1. No painel Supabase, abra **Authentication** e depois as configurações de senha.
2. Ative a proteção contra senhas vazadas (o nome pode aparecer como **Leaked password protection**).
3. Salve e tente cadastrar uma senha de teste reconhecidamente fraca para confirmar o bloqueio.

## 3. Deploy no Cloudflare Workers

1. Instale dependências: `npm install`.
2. Gere a versão de produção: `npm run build`.
3. Autentique o terminal uma vez: `npx wrangler login`.
4. No projeto, publique: `npx wrangler deploy`.
5. No Cloudflare, cadastre as variáveis públicas do Vite usadas pela aplicação: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_WHATSAPP_TEST_PHONE` e `VITE_TURNSTILE_SITE_KEY`.
6. Faça novo build/deploy sempre que alterar uma variável `VITE_*`, pois ela é incorporada ao pacote do navegador durante o build.

## 4. WhatsApp

O fluxo atual abre uma mensagem pronta para o WhatsApp do profissional; ele permanece seguro para o piloto porque não exige acesso à conta do WhatsApp.

Para envio automático, escolha uma das opções:

- **API oficial do WhatsApp Business / Cloud API:** configurar conta Meta Business, número aprovado, templates e um webhook para eventos de pedido, Pix e agenda.
- **n8n para testes controlados:** receber os eventos do Supabase em um webhook e encaminhar ao provedor escolhido. Use somente uma integração que respeite as regras do WhatsApp e tenha consentimento dos contatos.

## 5. Validação profissional e denúncias

Antes de liberar venda de ficha de treino ou dieta, o Admin Master deve validar manualmente o documento profissional enviado, a área de atuação e o texto exibido na vitrine. Denúncias, suspensão e eventual fechamento de página continuam sendo decisões humanas do Admin Master, com registro do motivo.

## 6. Biblioteca ampliada de exercícios

A biblioteca 2D ampliada usa o catálogo público do RepDB. Ela não exige token, conta ou configuração de ambiente: o Admin carrega o catálogo somente ao abrir a aba **2D ampliado**. Para que essas ilustrações apareçam, o navegador precisa conseguir acessar `https://exercise-dataset.com`.

O catálogo é permitido para uso comercial dentro do aplicativo, desde que o crédito visível para RepDB permaneça. Não remova o crédito da biblioteca administrativa, da prévia pública ou do conteúdo protegido. Caso a fonte externa fique indisponível, os modelos 3D já empacotados e as demais opções de mídia do produto continuam funcionando.

## Animações HD 3D

A aba **HD 3D** usa os 50 exercícios do pacote gratuito publicado pela Vital Animations. Não é necessário token ou conta: o catálogo JSON e os vídeos são carregados sob demanda por URLs públicas. Essa opção melhora a apresentação sem adicionar uma API paga ao MVP.

Para produção com maior volume, adquira o pacote licenciado desejado e hospede os MP4 em um bucket próprio do Cloudflare R2/CDN. O arquivo ZIP do pacote gratuito é grande e não deve ser commitado no repositório; o projeto utiliza somente os metadados e URLs dos exercícios escolhidos.
