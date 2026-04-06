# Backend do PDV

O projeto agora pode rodar em 2 modos, sem quebrar o fluxo atual:

- `demo local`: abrindo o `index.html` direto, continua usando a API fake no navegador.
- `backend real`: abrindo pelo servidor Node, o front usa automaticamente a API do servidor.

## Como subir

1. Tenha o Node.js 18+ instalado.
2. Na pasta do projeto, rode:

```bash
npm start
```

3. Abra no navegador:

```text
http://localhost:8787
```

## Onde os dados ficam

O backend salva a base em:

```text
data/app-db.json
```

Se o arquivo não existir, ele é criado automaticamente.

## Migração segura dos dados do modo demo

Para não perder nada:

1. Abra o sistema no modo atual.
2. Exporte um backup pelo menu de sistema.
3. Suba o backend com `npm start`.
4. Abra `http://localhost:8787`.
5. Importe o mesmo backup pelo menu de sistema.

Assim você migra os dados locais para o servidor sem alterar o frontend.

## Observações

- O backend inicial usa arquivo JSON no servidor, porque esse é o jeito mais seguro de começar sem quebrar as rotas atuais.
- As rotas `/api/*` foram mantidas compatíveis com o front existente.
- Em um próximo passo, dá para trocar a persistência JSON por PostgreSQL sem mexer nas telas.

## Deploy na Railway

O projeto já está preparado para a Railway com:

- `node server/server.js` como comando de inicialização na Railway
- `railway.json` com healthcheck em `/health`
- uso automático do volume da Railway quando `RAILWAY_VOLUME_MOUNT_PATH` estiver disponível
- suporte a host canônico com redirecionamento opcional do domínio raiz para o `www`

### Passo a passo

1. Suba este repositório para o GitHub.
2. Na Railway, crie um projeto novo e conecte o repositório.
3. Ao criar o serviço, deixe a Railway detectar como app Node.
4. Depois do primeiro deploy, adicione um `Volume`.
5. Monte o volume no serviço.

Observação:

- localmente você pode continuar usando `npm start`
- na Railway o projeto sobe direto com `node server/server.js`, o que evita logs confusos do `npm` durante reinícios e redeploys

### Persistência

Se houver volume montado, o backend salva automaticamente em:

```text
$RAILWAY_VOLUME_MOUNT_PATH/app-db.json
```

Se quiser forçar outro caminho, defina:

```text
MVS_DATA_FILE=/caminho/do/arquivo/app-db.json
```

### Domínio principal (`www`) e redirecionamento do raiz

Se quiser que o servidor redirecione automaticamente:

- `mvspdv.com.br` -> `www.mvspdv.com.br`

defina na Railway:

```text
MVS_CANONICAL_HOST=www.mvspdv.com.br
MVS_REDIRECT_HOSTS=mvspdv.com.br
```

Assim, qualquer acesso ao domínio raiz que chegar no backend será redirecionado com `308` para o `www`, preservando rota e parâmetros da URL.

### Cadastro por convite com Supabase

Se quiser que o cadastro de usuários seja controlado pelo backend:

```text
MVS_SUPABASE_URL=https://SEU-PROJETO.supabase.co
MVS_SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
MVS_ACCESS_INVITE_CODES=CODIGO1,CODIGO2,CODIGO3
MVS_ACCESS_OWNER_EMAILS=voce@seudominio.com
```

Com isso:

- o frontend envia o cadastro para `/api/access/signup`
- o backend valida o código de convite
- a conta é criada no Supabase com a `service_role`
- o usuário deixa de depender do signup público
- o painel de convites fica disponível só para os emails listados em `MVS_ACCESS_OWNER_EMAILS`

Importante:

- a `service_role` deve ficar só na Railway/backend
- nunca coloque a `service_role` no frontend
- os códigos de convite agora ficam só no servidor
- o email do proprietário também fica configurado no servidor

No Supabase, depois de configurar isso, desative o cadastro público em:

- `Authentication` -> `General configuration`
- desligue `Allow new users to sign up`

Depois do primeiro deploy com essa estrutura:

- os códigos iniciais de `MVS_ACCESS_INVITE_CODES` são trazidos para a base do backend
- novos convites podem ser criados, bloqueados e excluídos pelo painel, sem redeploy

### Migração dos dados atuais

1. Abra o sistema antigo.
2. Exporte o backup JSON pelo menu do sistema.
3. Abra a URL do projeto na Railway.
4. Importe o backup no sistema já rodando na Railway.

Assim você sobe no gratuito primeiro e mantém um caminho limpo para depois mudar para o plano Hobby sem refazer a app.
