#!/bin/bash

export POSTGRES_DB_NAME="agid"

if [ -z "$POSTGRES_PASSWORD" ]; then
  export POSTGRES_PASSWORD=$(kubectl get secret --namespace default backend-secrets -o jsonpath="{.data.postgresql-password}" | base64 --decode)
fi

if [ ! -f "amministrazioni.txt" ]; then
  curl 'https://www.indicepa.gov.it/public-services/opendata-read-service.php?dstype=FS&filename=amministrazioni.txt' -o amministrazioni.txt
fi

kubectl run postgresql-postgresql-client --rm $PSQL_KUBECTL_OPTS -i --restart='Never' --namespace default \
  --image docker.io/bitnami/postgresql:11.3.0 \
  --env="PGPASSWORD=$POSTGRES_PASSWORD" --command -- psql --host postgresql-postgresql -U postgres -d $POSTGRES_DB_NAME -p 5432 \
  -c "BEGIN; \
    CREATE TEMP TABLE tmp_ipa_pa ON COMMIT DROP AS SELECT * FROM ipa_pa WITH NO DATA; \
    COPY tmp_ipa_pa (cod_amm, des_amm, \"Comune\", nome_resp, cogn_resp, \"Cap\", \"Provincia\", \"Regione\", sito_istituzionale, \
    \"Indirizzo\", titolo_resp, tipologia_istat, tipologia_amm, acronimo, cf_validato, \"Cf\", mail1, tipo_mail1, mail2, \
    tipo_mail2, mail3, tipo_mail3, mail4, tipo_mail4, mail5, tipo_mail5, \
    url_facebook, url_twitter, url_googleplus, url_youtube, liv_accessibili) \
    FROM STDIN WITH DELIMITER E'\t' CSV HEADER QUOTE E'\b' FORCE NOT NULL \
    cod_amm, des_amm, \"Comune\", nome_resp, cogn_resp, \"Cap\", \"Provincia\", \"Regione\", sito_istituzionale, \
    \"Indirizzo\", titolo_resp, tipologia_istat, tipologia_amm, acronimo, cf_validato, \"Cf\", mail1, tipo_mail1, mail2, \
    tipo_mail2, mail3, tipo_mail3, mail4, tipo_mail4, mail5, tipo_mail5, \
    url_facebook, url_twitter, url_googleplus, url_youtube, liv_accessibili \
    ; INSERT INTO ipa_pa SELECT \
    cod_amm, des_amm, \"Comune\", nome_resp, cogn_resp, \"Cap\", \"Provincia\", \"Regione\", sito_istituzionale, \
    \"Indirizzo\", titolo_resp, tipologia_istat, tipologia_amm, acronimo, cf_validato, \"Cf\", mail1, tipo_mail1, mail2, \
    tipo_mail2, mail3, tipo_mail3, mail4, tipo_mail4, mail5, tipo_mail5, \
    url_facebook, url_twitter, url_googleplus, url_youtube, liv_accessibili \
    FROM tmp_ipa_pa ON CONFLICT (cod_amm) DO UPDATE SET \
    des_amm = EXCLUDED.des_amm, \"Comune\" = EXCLUDED.\"Comune\", \
    nome_resp = EXCLUDED.nome_resp, cogn_resp = EXCLUDED.cogn_resp, \"Cap\" = EXCLUDED.\"Cap\", \"Provincia\" = EXCLUDED.\"Provincia\", \
    \"Regione\" = EXCLUDED.\"Regione\", sito_istituzionale = EXCLUDED.sito_istituzionale, \
    \"Indirizzo\" = EXCLUDED.\"Indirizzo\", titolo_resp = EXCLUDED.titolo_resp, tipologia_istat = EXCLUDED.tipologia_istat, \
    tipologia_amm = EXCLUDED.tipologia_amm, acronimo = EXCLUDED.acronimo, cf_validato = EXCLUDED.cf_validato, \
    \"Cf\" = EXCLUDED.\"Cf\", mail1 = EXCLUDED.mail1, tipo_mail1 = EXCLUDED.tipo_mail1, mail2 = EXCLUDED.mail2, \
    tipo_mail2 = EXCLUDED.tipo_mail2, mail3 = EXCLUDED.mail3, tipo_mail3 = EXCLUDED.tipo_mail3, \
    mail4 = EXCLUDED.mail4, tipo_mail4 = EXCLUDED.tipo_mail4, mail5 = EXCLUDED.mail5, tipo_mail5 = EXCLUDED.tipo_mail5, \
    url_facebook = EXCLUDED.url_facebook, url_twitter = EXCLUDED.url_twitter, url_googleplus = EXCLUDED.url_googleplus, \
    url_youtube = EXCLUDED.url_youtube, liv_accessibili = EXCLUDED.liv_accessibili \
    ; COMMIT;" < amministrazioni.txt

if [ ! -f "ou.txt" ]; then
  curl 'https://www.indicepa.gov.it/public-services/opendata-read-service.php?dstype=FS&filename=ou.txt' -o ou.txt
fi

kubectl run postgresql-postgresql-client --rm $PSQL_KUBECTL_OPTS -i --restart='Never' --namespace default \
  --image docker.io/bitnami/postgresql:11.3.0 \
  --env="PGPASSWORD=$POSTGRES_PASSWORD" --command -- psql --host postgresql-postgresql -U postgres -d $POSTGRES_DB_NAME -p 5432 \
  -c "BEGIN; \
  CREATE TEMP TABLE tmp_ipa_ou ON COMMIT DROP AS SELECT * FROM ipa_ou WITH NO DATA; \
  COPY tmp_ipa_ou FROM STDIN WITH DELIMITER E'\t' CSV HEADER QUOTE E'\b' FORCE NOT NULL \
  cod_ou, cod_aoo, des_ou, comune, \"Cap\", provincia, \"Regione\", \"Indirizzo\", \"Tel\", nome_resp, cogn_resp, mail_resp, \
  tel_resp, cod_amm, cod_ou_padre, \"Fax\", cod_uni_ou, mail1, tipo_mail1, mail2, tipo_mail2, mail3, tipo_mail3 \
  ; INSERT INTO ipa_ou SELECT * FROM tmp_ipa_ou ON CONFLICT (cod_ou, cod_amm) DO UPDATE SET \
  cod_aoo = EXCLUDED.cod_aoo, des_ou = EXCLUDED.des_ou, comune = EXCLUDED.comune, \
  \"Cap\" = EXCLUDED.\"Cap\", provincia = EXCLUDED.provincia, \"Regione\" = EXCLUDED.\"Regione\", \
  \"Indirizzo\" = EXCLUDED.\"Indirizzo\", \"Tel\" = EXCLUDED.\"Tel\", nome_resp = EXCLUDED.nome_resp, \
  cogn_resp = EXCLUDED.cogn_resp, mail_resp = EXCLUDED.mail_resp, tel_resp = EXCLUDED.tel_resp, \
  cod_ou_padre = EXCLUDED.cod_ou_padre, \"Fax\" = EXCLUDED.\"Fax\", \
  cod_uni_ou = EXCLUDED.cod_uni_ou, mail1 = EXCLUDED.mail1, tipo_mail1 = EXCLUDED.tipo_mail1, \
  mail2 = EXCLUDED.mail2, tipo_mail2 = EXCLUDED.tipo_mail2, mail3 = EXCLUDED.mail3, tipo_mail3 = EXCLUDED.tipo_mail3 \
  ; COMMIT;" < ou.txt
