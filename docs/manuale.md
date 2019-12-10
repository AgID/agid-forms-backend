# eForm AGID - backend

## Funzionalità

Il backend del progetto eForm AGID implementa funzionalità quali:

- autenticazione di un utente generico tramite un codice inviato all'indirizzo email immesso
- autenticazione di un utente Responsabile per la Transizione Digitale (RTD) tramite un codice inviato all'indirizzo email trovato su [IPA](https://indicepa.gov.it)
- interfaccia GraphQL al database PostgreSQL (per salvare e leggere i contenuti provenienti dai form del frontend)
- logiche di business (_"rules"_) in reazione ad eventi del database (es. aggiornamento di un contenuto); sono attivate da un webhook
- invio delle email tramite un worker process (attivato dai messaggi che transitano in una coda FIFO)

Le componenti software principali sono scritte in Typescript e constano di:

- un [server express](../src/servers.ts) (NodeJS) che implementa le [logiche](../src/controllers/auth_ipa.ts) [di autenticazione](../src/controllers/auth_email.ts)
e un [webhook](../src/controllers/graphql_webhook.ts) per reagire alle modifiche dei dati su Hasura / PostgreSQL
- un server express (NodeJS) che implementa l'[upload dei file](../src/uploads/upload-server.ts) e
il download dei file caricati
- alcuni [worker NodeJS](../src/workers/) per il processamento asincrono

![Componenti dell'infrastruttura](./components.svg)

Nell'infrastruttura sono presenti inoltre:

- un server [PostgreSQL](https://www.postgresql.org/) per la persistenza dei dati
- un server [Hasura](https://hasura.io/) che agisce da proxy verso PostgreSQL convertendo le query GraphQL
- un server [Minio](https://min.io/) che implementa le API (compatibili con S3 Amazon) per l'upload dei file
- un server [Redis](https://redis.io/) per lo storage dei token di autenticazione (sessioni utente) 
e l'implementazione di una [coda FIFO](https://github.com/OptimalBits/bull) dove viene effettuato il dispatch dei messaggi
inviati dal webhook configurato su Hasura
- un proxy [Traefik](https://containo.us/traefik/) che permette l'accesso da internet ai diversi servizi docker
e automatizza l'utilizzo dei certificati TSL (per https)

## Tracker del progetto

Le attività (TODO) del progetto sono tracciate mediante [Pivotal Tracker](https://www.pivotaltracker.com):

- [Backend](https://www.pivotaltracker.com/n/projects/2325271)
- [Frontend](https://www.pivotaltracker.com/n/projects/2354762)
- [Backoffice](https://www.pivotaltracker.com/n/projects/2354770)

## Installazione in locale

```shell
git clone https://github.com/AgID/agid-forms-backend
cp env.example .env # editare il file
docker-compose up -f docker-compose.yml -f docker-compose.override.dev.yml -d --build
```

Le variabili del file di configurazione sono documentate
nel file di esempio [env.example](../env.example).

## Accesso alla console Hasura

Per poter gestire i dati sul database, è possibile
accedere localmente alla [console di Hasura](https://docs.hasura.io/1.0/graphql/manual/hasura-cli/hasura_console.html).

A tal fine è necessario scaricare il binario e impostare il secret in un file
[`database/config.yaml`](../database/config.yaml):

```yaml
admin_secret: <HASURA ADMIN SECRET>
endpoint: https://database.form.agid.gov.it/
```

dopodiché sarà possibile lanciare l'applicazione web:

```shell
$ cd database
$ hasura console
INFO hasura cli is up to date                      version=1.0.0-rc.1
INFO console running at: http://localhost:9695/
```

## API di autenticazione

Le API di autenticazione sono descritte nel file [`api_backend.yaml`](../api_backend.yaml):

https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/AgID/agid-forms-backend/master/api_backend.yaml

## Processi asincroni

Per qualsiasi necessità di scrivere o leggere dati, il frontend
contatta direttamente Hasura passando il token (JWT) ottenuto tramite le API di autenticazione.

Sul server Hasura è configurato un [event trigger](https://docs.hasura.io/1.0/graphql/manual/event-triggers/index.html)
in modo tale che, per ogni evento di modifica di un nodo nel database, Hasura invia il contenuto 
del nodo verso un endpoint (webhook) configurato tramite il backoffice.

Il processo express/NodeJS (lo stesso che implementa le API di autenticazione) riceve il payload del webhook
tramite uno [specifico endpoint](../src/controllers/graphql_webhook.ts) che pubblica l'evento (e il payload)
su uno specifico [canale Redis](https://redis.io/topics/pubsub).

Un altro [processo NodeJS](../src/workers/node_events_dispatcher.ts), in ascolto su tale canale (subscribe),
processa il messaggio ricevuto e ne effettua il _dispatching_ su una specifica coda FIFO ([Redis Bull Queue](https://github.com/OptimalBits/bull))
indirizzandolo verso un "worker process" che riceve i messaggi dalla coda.

In tal modo viene disaccoppiato l'evento (scrittura / aggiornamento di un dato) dalla logica business
che ne consegue.

Al momento i _worker process_ attivi sono:

- [verifica dei link della dichiarazione di accessibilità](../src/workers/link_verifier_processor.ts)
- [invio di email](../src/workers/email_processor.ts)

## Deploy in produzione

La macchina in produzione deve essere opportunamente configurata;
a tal fine il repository contiene un file [`rc.local`](../docker/compose/rc.local)
che riporta:

- le modifiche da effettuare ai parametri di sistema
- i `cron jobs` da installare per il [backup del database](../scripts/backup-db.sh)
e l'importazione dei dati da [IPA](https://indicepa.gov.it).

```shell
cd /home/ubuntu/agid-forms-backend
git pull origin master # aggiorna all'ultima versione pubblicata su GitHub
docker-compose up -d --build
```
