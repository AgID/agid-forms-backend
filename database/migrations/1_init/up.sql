CREATE FUNCTION public.audit_node() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        INSERT INTO node_revision(id, created_at, updated_at, user_id, type, version, title, content, status, language, "group")
            VALUES (NEW.id, NEW.created_at, NEW.updated_at, NEW.user_id, NEW.type, NEW.version, NEW.title, NEW.content, NEW.status, NEW.language, NEW.group);
        RETURN NEW;
    END;
$$;
CREATE FUNCTION public.compute_ipa_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        NEW."des_amm_Comune" = NEW.des_amm || ' ' || NEW."Comune";
        RETURN NEW;
    END;
$$;
CREATE FUNCTION public.force_serial_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   IF TG_OP = 'UPDATE' AND NEW.id <> OLD.id THEN
     RAISE EXCEPTION 'Cannot UPDATE with a different ID';
   END IF;
   RETURN NEW;
END
$$;
CREATE FUNCTION public.increment_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.version < OLD.version + 1 THEN
        RAISE EXCEPTION 'Cannot update an old revision (latest=%)', OLD.version
        USING ERRCODE = 'check_violation';
    ELSIF NEW.version > OLD.version + 1 THEN
        RAISE EXCEPTION 'Cannot update the current revision with a wrong version (latest=%)', OLD.version
        USING ERRCODE = 'check_violation';
    ELSIF NEW.version IS NULL THEN
        RAISE EXCEPTION 'Cannot update the current revision without provinding a version (latest=%)', OLD.version
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
CREATE TABLE public.ipa_pa (
    cod_amm text NOT NULL,
    des_amm text DEFAULT '""'::text NOT NULL,
    "Comune" text DEFAULT '""'::text NOT NULL,
    nome_resp text DEFAULT '""'::text NOT NULL,
    cogn_resp text DEFAULT '""'::text NOT NULL,
    "Cap" text DEFAULT '""'::text NOT NULL,
    "Provincia" text DEFAULT '""'::text NOT NULL,
    "Regione" text DEFAULT '""'::text NOT NULL,
    sito_istituzionale text DEFAULT '""'::text NOT NULL,
    "Indirizzo" text DEFAULT '""'::text NOT NULL,
    titolo_resp text DEFAULT '""'::text NOT NULL,
    tipologia_istat text DEFAULT '""'::text NOT NULL,
    tipologia_amm text DEFAULT '""'::text NOT NULL,
    acronimo text DEFAULT '""'::text NOT NULL,
    cf_validato text DEFAULT '""'::text NOT NULL,
    "Cf" text DEFAULT '""'::text NOT NULL,
    mail1 text DEFAULT '""'::text NOT NULL,
    tipo_mail1 text DEFAULT '""'::text NOT NULL,
    mail2 text DEFAULT '""'::text NOT NULL,
    tipo_mail2 text DEFAULT '""'::text NOT NULL,
    mail3 text DEFAULT '""'::text NOT NULL,
    tipo_mail3 text DEFAULT '""'::text NOT NULL,
    mail4 text DEFAULT '""'::text NOT NULL,
    tipo_mail4 text DEFAULT '""'::text NOT NULL,
    mail5 text DEFAULT '""'::text NOT NULL,
    tipo_mail5 text DEFAULT '""'::text NOT NULL,
    url_facebook text DEFAULT '""'::text NOT NULL,
    url_twitter text DEFAULT '""'::text NOT NULL,
    url_googleplus text DEFAULT '""'::text NOT NULL,
    url_youtube text DEFAULT '""'::text NOT NULL,
    liv_accessibili text DEFAULT '""'::text NOT NULL,
    "des_amm_Comune" text DEFAULT '""'::text NOT NULL
);
CREATE FUNCTION public.search_ipa(search text) RETURNS SETOF public.ipa_pa
    LANGUAGE sql STABLE
    AS $$
    SELECT *
    FROM public.ipa_pa
    WHERE
      search <% (des_amm || ' ' || "Comune")
    ORDER BY
      similarity(search, (des_amm || ' ' || "Comune")) DESC
    LIMIT 10;
$$;
CREATE FUNCTION public.trigger_update_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.trigger_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
CREATE TABLE public.node (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    title text NOT NULL,
    content jsonb NOT NULL,
    user_id uuid NOT NULL,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    type text NOT NULL,
    language text NOT NULL,
    "group" text DEFAULT 'global'::text NOT NULL,
    CONSTRAINT max_node_length CHECK ((pg_column_size(content) <= 64000))
);
CREATE TABLE public."group" (
    "group" text NOT NULL,
    CONSTRAINT group_snake_case CHECK (("group" ~ '^([A-Za-z0-9\_])+$'::text))
);
COMMENT ON TABLE public."group" IS 'snake case group names';
CREATE TABLE public.ipa_ou (
    cod_ou text NOT NULL,
    cod_aoo text DEFAULT '""'::text NOT NULL,
    des_ou text DEFAULT '""'::text NOT NULL,
    comune text DEFAULT '""'::text NOT NULL,
    "Cap" text DEFAULT '""'::text NOT NULL,
    provincia text DEFAULT '""'::text NOT NULL,
    "Regione" text DEFAULT '""'::text NOT NULL,
    "Indirizzo" text DEFAULT '""'::text NOT NULL,
    "Tel" text DEFAULT '""'::text NOT NULL,
    nome_resp text DEFAULT '""'::text NOT NULL,
    cogn_resp text DEFAULT '""'::text NOT NULL,
    mail_resp text DEFAULT '""'::text NOT NULL,
    tel_resp text DEFAULT '""'::text NOT NULL,
    cod_amm text NOT NULL,
    cod_ou_padre text NOT NULL,
    "Fax" text DEFAULT '""'::text NOT NULL,
    cod_uni_ou text DEFAULT '""'::text NOT NULL,
    mail1 text DEFAULT '""'::text NOT NULL,
    tipo_mail1 text DEFAULT '""'::text NOT NULL,
    mail2 text DEFAULT '""'::text NOT NULL,
    tipo_mail2 text DEFAULT '""'::text NOT NULL,
    mail3 text DEFAULT '""'::text NOT NULL,
    tipo_mail3 text DEFAULT '""'::text NOT NULL
);
CREATE TABLE public.language (
    language text NOT NULL
);
CREATE TABLE public.node_revision (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    title text NOT NULL,
    content jsonb NOT NULL,
    status text NOT NULL,
    language text NOT NULL,
    user_id uuid NOT NULL,
    id uuid NOT NULL,
    "group" text
);
CREATE VIEW public.last_published_or_draft AS
 WITH latest_not_draft AS (
         SELECT DISTINCT ON (r.id) r.created_at,
            r.updated_at,
            r.type,
            r.version,
            r.title,
            r.content,
            r.status,
            r.language,
            r.user_id,
            r.id,
            r."group"
           FROM public.node_revision r
          WHERE (r.status <> 'draft'::text)
          ORDER BY r.id, r.version DESC
        ), drafts_only AS (
         SELECT DISTINCT ON (n.id) n.created_at,
            n.updated_at,
            n.type,
            n.version,
            n.title,
            n.content,
            n.status,
            n.language,
            n.user_id,
            n.id,
            n."group"
           FROM (public.node_revision n
             LEFT JOIN public.node_revision rr ON (((rr.id = n.id) AND (rr.status <> 'draft'::text))))
          WHERE ((n.status = 'draft'::text) AND (rr.id IS NULL))
          ORDER BY n.id, n.version DESC
        )
 SELECT latest_not_draft.created_at,
    latest_not_draft.updated_at,
    latest_not_draft.type,
    latest_not_draft.version,
    latest_not_draft.title,
    latest_not_draft.content,
    latest_not_draft.status,
    latest_not_draft.language,
    latest_not_draft.user_id,
    latest_not_draft.id,
    latest_not_draft."group"
   FROM latest_not_draft
UNION
 SELECT drafts_only.created_at,
    drafts_only.updated_at,
    drafts_only.type,
    drafts_only.version,
    drafts_only.title,
    drafts_only.content,
    drafts_only.status,
    drafts_only.language,
    drafts_only.user_id,
    drafts_only.id,
    drafts_only."group"
   FROM drafts_only
  ORDER BY 2 DESC;
COMMENT ON VIEW public.last_published_or_draft IS 'helper view to show list of nodes in users dashboards';
CREATE TABLE public.node_type (
    node_type text NOT NULL,
    CONSTRAINT node_types_snake_case CHECK ((node_type ~ '^([a-z\_])+$'::text))
);
CREATE TABLE public.node_type_perm (
    node_type text NOT NULL,
    role text NOT NULL,
    insert boolean DEFAULT false NOT NULL
);
CREATE TABLE public.role (
    role text NOT NULL,
    CONSTRAINT role_snake_case CHECK ((role ~ '^([a-z\_])+$'::text))
);
COMMENT ON TABLE public.role IS 'use snake case names for roles';
CREATE TABLE public.status (
    status text NOT NULL
);
CREATE TABLE public."user" (
    email public.citext NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL
);
CREATE TABLE public.user_group (
    user_id uuid NOT NULL,
    "group" text NOT NULL,
    role text NOT NULL
);
ALTER TABLE ONLY public."group"
    ADD CONSTRAINT groups_pkey PRIMARY KEY ("group");
ALTER TABLE ONLY public.ipa_ou
    ADD CONSTRAINT ipa_ou_pkey PRIMARY KEY (cod_ou, cod_amm);
ALTER TABLE ONLY public.ipa_pa
    ADD CONSTRAINT ipa_pa_pkey PRIMARY KEY (cod_amm);
ALTER TABLE ONLY public.language
    ADD CONSTRAINT language_pkey PRIMARY KEY (language);
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.node_revision
    ADD CONSTRAINT node_revision_pkey PRIMARY KEY (id, version);
ALTER TABLE ONLY public.node_type_perm
    ADD CONSTRAINT node_type_perm_pkey PRIMARY KEY (node_type, role);
ALTER TABLE ONLY public.node_type
    ADD CONSTRAINT node_type_pkey PRIMARY KEY (node_type);
ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (role);
ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_pkey PRIMARY KEY (status);
ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);
ALTER TABLE ONLY public.user_group
    ADD CONSTRAINT user_group_pkey PRIMARY KEY (user_id, "group", role);
ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);
CREATE INDEX search_gin_idx ON public.ipa_pa USING gin ((((des_amm || ' '::text) || "Comune")) public.gin_trgm_ops);
CREATE TRIGGER audit_node AFTER INSERT OR UPDATE ON public.node FOR EACH ROW EXECUTE PROCEDURE public.audit_node();
CREATE TRIGGER compute_ipa_column BEFORE INSERT OR UPDATE ON public.ipa_pa FOR EACH ROW EXECUTE PROCEDURE public.compute_ipa_column();
CREATE TRIGGER force_serial_id BEFORE UPDATE ON public.node FOR EACH ROW EXECUTE PROCEDURE public.force_serial_id();
CREATE TRIGGER force_serial_id BEFORE UPDATE ON public."user" FOR EACH ROW EXECUTE PROCEDURE public.force_serial_id();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.node FOR EACH ROW EXECUTE PROCEDURE public.trigger_updated_at();
CREATE TRIGGER set_version BEFORE UPDATE ON public.node FOR EACH ROW EXECUTE PROCEDURE public.increment_version();
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_group_fkey FOREIGN KEY ("group") REFERENCES public."group"("group") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_language_fkey FOREIGN KEY (language) REFERENCES public.language(language) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_status_fkey FOREIGN KEY (status) REFERENCES public.status(status) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_type_fkey FOREIGN KEY (type) REFERENCES public.node_type(node_type) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public.node_type_perm
    ADD CONSTRAINT node_type_perm_node_type_fkey FOREIGN KEY (node_type) REFERENCES public.node_type(node_type) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.node_type_perm
    ADD CONSTRAINT node_type_perm_role_fkey FOREIGN KEY (role) REFERENCES public.role(role) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public.user_group
    ADD CONSTRAINT user_group_group_fkey FOREIGN KEY ("group") REFERENCES public."group"("group") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.user_group
    ADD CONSTRAINT user_group_role_fkey FOREIGN KEY (role) REFERENCES public.role(role) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.user_group
    ADD CONSTRAINT user_group_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;
