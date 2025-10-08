--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (165f042)
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.user_cards_id_seq;
DROP TABLE IF EXISTS public.user_cards;
DROP TABLE IF EXISTS public.transactions;
DROP SEQUENCE IF EXISTS public.support_tickets_id_seq;
DROP TABLE IF EXISTS public.support_tickets;
DROP SEQUENCE IF EXISTS public.support_messages_id_seq;
DROP TABLE IF EXISTS public.support_messages;
DROP TABLE IF EXISTS public.support_chats;
DROP SEQUENCE IF EXISTS public.stats_id_seq;
DROP TABLE IF EXISTS public.stats;
DROP SEQUENCE IF EXISTS public.exchanges_id_seq;
DROP TABLE IF EXISTS public.exchanges;
DROP TABLE IF EXISTS public.exchange_rates;
DROP SEQUENCE IF EXISTS public.cards_id_seq;
DROP TABLE IF EXISTS public.cards;
DROP SEQUENCE IF EXISTS public.banks_id_seq;
DROP TABLE IF EXISTS public.banks;
DROP SEQUENCE IF EXISTS public.balances_id_seq;
DROP TABLE IF EXISTS public.balances;
DROP SEQUENCE IF EXISTS public.admins_id_seq;
DROP TABLE IF EXISTS public.admins;
DROP TYPE IF EXISTS public.support_ticket_status;
DROP TYPE IF EXISTS public.message_sender;
DROP TYPE IF EXISTS public.exchange_status;
DROP TYPE IF EXISTS public.balance_type;
--
-- Name: balance_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.balance_type AS ENUM (
    'fiat',
    'crypto',
    'token',
    'voucher'
);


--
-- Name: exchange_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exchange_status AS ENUM (
    'wait',
    'wait-paid',
    'paid',
    'complete',
    'canceled',
    'dispute'
);


--
-- Name: message_sender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_sender AS ENUM (
    'user',
    'support'
);


--
-- Name: support_ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.support_ticket_status AS ENUM (
    'wait-user',
    'wait-support',
    'closed'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255),
    permissions jsonb DEFAULT '[]'::jsonb,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- Name: balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.balances (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    network character varying(50),
    currency character varying(10) NOT NULL,
    rate numeric(18,8),
    type public.balance_type DEFAULT 'fiat'::public.balance_type NOT NULL,
    status character varying(50)
);


--
-- Name: balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.balances_id_seq OWNED BY public.balances.id;


--
-- Name: banks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banks (
    id integer NOT NULL,
    card_id integer NOT NULL,
    bank_name character varying(255) NOT NULL,
    time_exchange integer,
    commission numeric(5,2),
    status character varying(50) DEFAULT '1'::character varying
);


--
-- Name: banks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.banks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: banks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.banks_id_seq OWNED BY public.banks.id;


--
-- Name: cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cards (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    country character varying(50) NOT NULL,
    lang character varying(255),
    time_exchange integer NOT NULL,
    commission numeric(5,2) NOT NULL,
    id_balance character varying(255),
    status character varying(50) DEFAULT '1'::character varying
);


--
-- Name: cards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cards_id_seq OWNED BY public.cards.id;


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    from_balance_id integer,
    to_balance_id integer,
    from_currency text NOT NULL,
    to_currency text NOT NULL,
    rate numeric(18,8) NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: exchanges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchanges (
    id integer NOT NULL,
    number_order character varying(50) NOT NULL,
    id_user integer NOT NULL,
    id_balance_from integer,
    id_balance_to integer,
    id_card integer,
    from_currency character varying(10) NOT NULL,
    to_currency character varying(10) NOT NULL,
    amount_from numeric(18,8) NOT NULL,
    amount_to numeric(18,8) NOT NULL,
    rate numeric(18,8) NOT NULL,
    commission numeric(18,8) DEFAULT 0.0,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status public.exchange_status DEFAULT 'wait'::public.exchange_status NOT NULL,
    wallet_id integer,
    manual_card_number character varying(50),
    cancel_reason text,
    payment_hash text
);


--
-- Name: exchanges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exchanges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exchanges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exchanges_id_seq OWNED BY public.exchanges.id;


--
-- Name: stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats (
    id integer NOT NULL,
    stat_type character varying(100) NOT NULL,
    id_exchange integer NOT NULL,
    sum numeric(18,8),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id_user integer
);


--
-- Name: stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stats_id_seq OWNED BY public.stats.id;


--
-- Name: support_chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_chats (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    transaction_id character varying,
    messages json DEFAULT '[]'::jsonb,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_messages (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    sender public.message_sender NOT NULL,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: support_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_messages_id_seq OWNED BY public.support_messages.id;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    exchange_id integer NOT NULL,
    status public.support_ticket_status DEFAULT 'wait-support'::public.support_ticket_status NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_tickets_id_seq OWNED BY public.support_tickets.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    order_id text NOT NULL,
    user_id integer,
    from_currency text NOT NULL,
    to_currency text NOT NULL,
    from_amount numeric(18,8) NOT NULL,
    to_amount numeric(18,8) NOT NULL,
    from_address text,
    to_address text,
    card_number text,
    status text DEFAULT 'pending'::text NOT NULL,
    tx_hash text,
    created_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone
);


--
-- Name: user_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_cards (
    id integer NOT NULL,
    id_card integer NOT NULL,
    id_user integer NOT NULL,
    name character varying(100),
    first_name character varying(100),
    last_name character varying(100),
    phone character varying(20),
    country character varying(50) NOT NULL,
    number_card character varying(50) NOT NULL,
    status character varying(50),
    id_bank integer
);


--
-- Name: user_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_cards_id_seq OWNED BY public.user_cards.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    tg_id character varying(255) NOT NULL,
    google character varying(255),
    api_key character varying(255),
    name character varying(255),
    img character varying(255),
    status character varying(50),
    agreement integer DEFAULT 0,
    blocked boolean DEFAULT false,
    default_fiat_balance_id integer,
    id_ref integer,
    code_ref character varying(20)
);


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admins (id, username, password_hash, name, permissions, status, created_at) FROM stdin;
\.


--
-- Data for Name: balances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.balances (id, title, network, currency, rate, type, status) FROM stdin;
1	Российский рубль	\N	RUB	\N	fiat	1
2	Турецкая лира	\N	TRY	\N	fiat	1
3	USDT TRC20	TRC20	USDT	\N	crypto	1
4	USDT BEP20	BEP20	USDT	\N	crypto	1
\.


--
-- Data for Name: banks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.banks (id, card_id, bank_name, time_exchange, commission, status) FROM stdin;
\.


--
-- Data for Name: cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cards (id, title, country, lang, time_exchange, commission, id_balance, status) FROM stdin;
\.


--
-- Data for Name: exchange_rates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exchange_rates (id, from_balance_id, to_balance_id, from_currency, to_currency, rate, updated_at) FROM stdin;
1fc361ef-6c0a-4e41-a360-85632a4450cd	4	1	USDT	RUB	95.50000000	2025-10-08 05:51:43.714
ae40bc71-8f26-4f18-8a7f-1aafd4e6040c	4	2	USDT	TRY	27.80000000	2025-10-08 05:51:43.791
a187dec8-6ae1-42f9-b8f9-ae1d48ea0a97	3	1	USDT	RUB	95.50000000	2025-10-08 05:51:43.868
148ced14-2944-48c1-901a-71e607da095b	3	2	USDT	TRY	27.80000000	2025-10-08 05:51:43.943
e82b895e-bd18-4182-ad4f-8af5fb16e6c5	3	1	USDT	RUB	81.21000000	2025-10-08 07:29:30.554
\.


--
-- Data for Name: exchanges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exchanges (id, number_order, id_user, id_balance_from, id_balance_to, id_card, from_currency, to_currency, amount_from, amount_to, rate, commission, "timestamp", status, wallet_id, manual_card_number, cancel_reason, payment_hash) FROM stdin;
\.


--
-- Data for Name: stats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats (id, stat_type, id_exchange, sum, "timestamp", id_user) FROM stdin;
\.


--
-- Data for Name: support_chats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_chats (id, user_id, transaction_id, messages, status, created_at) FROM stdin;
demo-chat-1	\N	\N	[{"sender":"Elena from support","message":"Hi there! How can I help?","timestamp":"2025-10-08T05:51:44.094Z"}]	open	2025-10-08 05:51:44.094
\.


--
-- Data for Name: support_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_messages (id, ticket_id, sender, message, created_at) FROM stdin;
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_tickets (id, user_id, exchange_id, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, order_id, user_id, from_currency, to_currency, from_amount, to_amount, from_address, to_address, card_number, status, tx_hash, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: user_cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_cards (id, id_card, id_user, name, first_name, last_name, phone, country, number_card, status, id_bank) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, tg_id, google, api_key, name, img, status, agreement, blocked, default_fiat_balance_id, id_ref, code_ref) FROM stdin;
\.


--
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admins_id_seq', 1, false);


--
-- Name: balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.balances_id_seq', 1, false);


--
-- Name: banks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.banks_id_seq', 1, false);


--
-- Name: cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cards_id_seq', 1, false);


--
-- Name: exchanges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.exchanges_id_seq', 1, false);


--
-- Name: stats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stats_id_seq', 1, false);


--
-- Name: support_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_messages_id_seq', 1, false);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_tickets_id_seq', 1, false);


--
-- Name: user_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_cards_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

