#!/bin/bash

if [ ! -f "amministrazioni.txt" ]; then
  curl -fsSL 'https://www.indicepa.gov.it/ipa-dati/dataset/502ff370-1b2c-4310-94c7-f39ceb7500e3/resource/3ed63523-ff9c-41f6-a6fe-980f3d9e501f/download/amministrazioni.txt' -o /tmp/amministrazioni.txt
fi

export PGPASSWORD=$POSTGRESQL_PASSWORD

psql --host postgresql -U postgres -d $POSTGRESQL_DATABASE -p 5432 \
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
    ; COMMIT;" < /tmp/amministrazioni.txt

if [ ! -f "ou.txt" ]; then
  curl -fsSL 'https://www.indicepa.gov.it:443/ipa-dati/dataset/7a2db7d8-4123-41b4-a1d6-d7b712a193f1/resource/4740588c-eb09-4ce8-92b0-86626508ad49/download/ou.txt' -o /tmp/ou.txt
fi

psql --host postgresql -U postgres -d $POSTGRESQL_DATABASE -p 5432 \
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
  ; COMMIT;" < /tmp/ou.txt
