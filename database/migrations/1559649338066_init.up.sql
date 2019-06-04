SET xmloption = content;
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
CREATE TABLE public.language (
    language text NOT NULL
);
CREATE TABLE public.node (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id text NOT NULL,
    type text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    title text NOT NULL,
    content jsonb NOT NULL,
    status text NOT NULL,
    language text NOT NULL
);
CREATE TABLE public.status (
    status text NOT NULL
);
ALTER TABLE ONLY public.language
    ADD CONSTRAINT language_pkey PRIMARY KEY (language);
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_pkey PRIMARY KEY (status);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.node FOR EACH ROW EXECUTE PROCEDURE public.trigger_updated_at();
CREATE TRIGGER set_version BEFORE UPDATE ON public.node FOR EACH ROW EXECUTE PROCEDURE public.increment_version();
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_language_fkey FOREIGN KEY (language) REFERENCES public.language(language) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_status_fkey FOREIGN KEY (status) REFERENCES public.status(status) ON UPDATE CASCADE ON DELETE RESTRICT;
