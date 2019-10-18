/* PRE INIT */
CREATE EXTENSION pg_trgm;
CREATE EXTENSION citext;

/* POST MIGRATIONS */
INSERT INTO "public"."node_type" (node_type) VALUES ('dichiarazione_accessibilita');
INSERT INTO "public"."language" (language) VALUES ('en');
INSERT INTO "public"."language" (language) VALUES ('it');
INSERT INTO "public"."role" (role) VALUES ('admin');
INSERT INTO "public"."role" (role) VALUES ('rtd');
INSERT INTO "public"."status" (status) VALUES ('needs_review');
INSERT INTO "public"."status" (status) VALUES ('published');
INSERT INTO "public"."status" (status) VALUES ('archived');
INSERT INTO "public"."status" (status) VALUES ('draft');
INSERT INTO "public"."node_type_perm" (node_type, role, insert) VALUES ('dichiarazione_accessibilita', 'rtd', true);
