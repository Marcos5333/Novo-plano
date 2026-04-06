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

### Migração dos dados atuais

1. Abra o sistema antigo.
2. Exporte o backup JSON pelo menu do sistema.
3. Abra a URL do projeto na Railway.
4. Importe o backup no sistema já rodando na Railway.

Assim você sobe no gratuito primeiro e mantém um caminho limpo para depois mudar para o plano Hobby sem refazer a app.
