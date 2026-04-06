# Backend do PDV

## O que esse backend faz

Hoje o projeto pode rodar de dois jeitos:

- se você abrir só o `index.html`, ele continua no modo demo/local
- se você subir o servidor Node, a tela usa o backend real automaticamente

Na prática, isso permitiu colocar:

- dados salvos no servidor
- backup centralizado
- domínio próprio na Railway
- cadastro por convite
- painel de convites para o dono da conta

Sem precisar refazer o frontend.

## Como rodar no computador

Se for usar localmente:

1. instale o Node.js 18 ou superior
2. na pasta do projeto, rode:

```bash
npm start
```

3. depois abra:

```text
http://localhost:8787
```

## Onde os dados ficam

No ambiente local, a base fica aqui:

```text
data/app-db.json
```

Se o arquivo não existir, o sistema cria sozinho.

## Se você já tem dados no modo antigo

O jeito mais seguro de migrar é simples:

1. abra o sistema antigo
2. exporte um backup pelo menu do sistema
3. suba o backend com `npm start`
4. abra `http://localhost:8787`
5. importe o mesmo backup

Isso evita susto e mantém o frontend igual.

## Como ficou na Railway

O projeto já está preparado para deploy.

Hoje usamos:

- `node server/server.js` para subir o serviço
- `railway.json` com healthcheck em `/health`
- volume para persistir o `app-db.json`
- domínio canônico com redirecionamento para o `www`

## Passo a passo da Railway

Quando for subir do zero:

1. mande o projeto para o GitHub
2. conecte o repositório na Railway
3. deixe a Railway detectar como app Node
4. depois do primeiro deploy, crie um volume
5. monte esse volume em `/data`

Com isso, o backend passa a salvar no volume e não perde os dados em restart.

## Onde a Railway salva a base

Se tiver volume montado, o sistema usa:

```text
$RAILWAY_VOLUME_MOUNT_PATH/app-db.json
```

Se um dia você quiser forçar outro caminho:

```text
MVS_DATA_FILE=/caminho/do/arquivo/app-db.json
```

## Domínio principal

Se a ideia for usar o `www` como endereço principal, deixe essas variáveis:

```text
MVS_CANONICAL_HOST=www.mvspdv.com.br
MVS_REDIRECT_HOSTS=mvspdv.com.br
```

Assim, se alguém entrar pelo domínio sem `www`, o sistema manda para o endereço certo sozinho.

## Cadastro por convite

Se quiser manter o cadastro fechado e só liberar quem você autorizar, o backend já faz isso.

As variáveis são estas:

```text
MVS_SUPABASE_URL=https://SEU-PROJETO.supabase.co
MVS_SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
MVS_ACCESS_INVITE_CODES=CODIGO1,CODIGO2,CODIGO3
MVS_ACCESS_OWNER_EMAILS=voce@seudominio.com
```

O papel de cada uma:

- `MVS_SUPABASE_URL`: endereço do projeto no Supabase
- `MVS_SUPABASE_SERVICE_ROLE_KEY`: chave do backend para criar usuários com segurança
- `MVS_ACCESS_INVITE_CODES`: convites iniciais
- `MVS_ACCESS_OWNER_EMAILS`: emails que podem abrir o painel de convites

## Como isso funciona na prática

Depois dessa configuração:

- o cadastro novo não passa mais direto pelo navegador
- a tela manda os dados para `/api/access/signup`
- o backend confere o código de convite
- se estiver certo, ele cria a conta no Supabase

No Supabase, o ideal é deixar o cadastro público desligado:

- `Authentication`
- `General configuration`
- desligar `Allow new users to sign up`

## Painel de convites

Depois do primeiro deploy com essas variáveis:

- os convites iniciais de `MVS_ACCESS_INVITE_CODES` entram na base do backend
- dali para frente você pode criar, bloquear e excluir convites pelo sistema
- não precisa redeploy para mexer nos convites do painel

Esse painel aparece só para quem estiver logado com um email listado em:

```text
MVS_ACCESS_OWNER_EMAILS
```

Se quiser mais de um dono:

```text
MVS_ACCESS_OWNER_EMAILS=email1@dominio.com,email2@dominio.com
```

## O que vale saber sem enrolação

- o sistema hoje está confiável para um cliente e um uso mais controlado
- ele ainda usa JSON como base, não banco SQL
- isso foi escolha para subir rápido sem quebrar o que já existia
- se um dia crescer mais, a próxima evolução natural é migrar a persistência para Postgres/Supabase

## Resumo honesto

Hoje a estrutura está boa para:

- rodar o PDV com domínio próprio
- salvar tudo no servidor
- controlar cadastro por convite
- manter um painel de convites só para você

Sem mexer no jeito que o usuário final usa o sistema.
