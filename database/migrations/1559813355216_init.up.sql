SET xmloption = content;
CREATE FUNCTION public.audit_node() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        INSERT INTO node_revision(id, created_at, updated_at, user_id, type, version, title, content, status, language)
            VALUES (NEW.id, NEW.created_at, NEW.updated_at, NEW.user_id, NEW.type, NEW.version, NEW.title, NEW.content, NEW.status, NEW.language);
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
CREATE FUNCTION public.increment_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    NEW.version = OLD.version + 1;
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
    type text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    title text NOT NULL,
    content jsonb NOT NULL,
    status text NOT NULL,
    language text NOT NULL,
    user_id uuid NOT NULL,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL
);
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
    id uuid NOT NULL
);
CREATE TABLE public.node_types (
    node_type text NOT NULL,
    CONSTRAINT node_types_snake_case CHECK ((node_type ~ '^([a-z\_])+$'::text))
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
CREATE TABLE public.user_role (
    role_id text NOT NULL,
    user_id uuid NOT NULL
);
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
ALTER TABLE ONLY public.node_types
    ADD CONSTRAINT node_types_pkey PRIMARY KEY (node_type);
ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (role);
ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_pkey PRIMARY KEY (status);
ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);
ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_pkey PRIMARY KEY (user_id, role_id);
CREATE INDEX search_gin_idx ON public.ipa_pa USING gin ((((des_amm || ' '::text) || "Comune")) public.gin_trgm_ops);
CREATE TRIGGER audit_node AFTER INSERT OR UPDATE ON public.node FOR EACH ROW EXECUTE PROCEDURE public.audit_node();
CREATE TRIGGER compute_ipa_column BEFORE INSERT OR UPDATE ON public.ipa_pa FOR EACH ROW EXECUTE PROCEDURE public.compute_ipa_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.node FOR EACH ROW EXECUTE PROCEDURE public.trigger_updated_at();
CREATE TRIGGER set_version BEFORE UPDATE ON public.node FOR EACH ROW EXECUTE PROCEDURE public.increment_version();
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_language_fkey FOREIGN KEY (language) REFERENCES public.language(language) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_status_fkey FOREIGN KEY (status) REFERENCES public.status(status) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_type_fkey FOREIGN KEY (type) REFERENCES public.node_types(node_type) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(role) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;
