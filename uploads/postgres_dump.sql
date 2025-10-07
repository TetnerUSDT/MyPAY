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
-- Name: users_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_balances (
    id integer NOT NULL,
    id_balance integer NOT NULL,
    id_user integer NOT NULL,
    sum numeric(18,8) DEFAULT 0.0,
    status character varying(50)
);


--
-- Name: users_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_balances_id_seq OWNED BY public.users_balances.id;


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    id_user integer,
    network character varying(50) NOT NULL,
    address character varying(255) NOT NULL,
    reservation_time timestamp without time zone,
    status character varying(50),
    private_key character varying(500),
    reserved character varying(50)
);


--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- Name: balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balances ALTER COLUMN id SET DEFAULT nextval('public.balances_id_seq'::regclass);


--
-- Name: banks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks ALTER COLUMN id SET DEFAULT nextval('public.banks_id_seq'::regclass);


--
-- Name: cards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards ALTER COLUMN id SET DEFAULT nextval('public.cards_id_seq'::regclass);


--
-- Name: exchanges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchanges ALTER COLUMN id SET DEFAULT nextval('public.exchanges_id_seq'::regclass);


--
-- Name: stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats ALTER COLUMN id SET DEFAULT nextval('public.stats_id_seq'::regclass);


--
-- Name: support_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages ALTER COLUMN id SET DEFAULT nextval('public.support_messages_id_seq'::regclass);


--
-- Name: support_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets ALTER COLUMN id SET DEFAULT nextval('public.support_tickets_id_seq'::regclass);


--
-- Name: user_cards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cards ALTER COLUMN id SET DEFAULT nextval('public.user_cards_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: users_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_balances ALTER COLUMN id SET DEFAULT nextval('public.users_balances_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


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
5	American Dollar	\N	USD	1.00000000	fiat	1
6	Ton Network	TON	USDT	1.00000000	crypto	1
\.


--
-- Data for Name: banks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.banks (id, card_id, bank_name, time_exchange, commission, status) FROM stdin;
1	1	Ozon Банк	\N	\N	1
2	1	ПАО Сбербанк	\N	\N	1
3	1	ПАО «Совкомбанк»	\N	\N	1
4	1	АО «Газпромбанк»	\N	\N	1
5	1	АО «ОТП Банк»	\N	\N	1
6	1	АО «Альфа-Банк»	\N	\N	1
7	1	АО «Банк Уралсиб»	\N	\N	1
8	1	ПАО «Промсвязьбанк»	\N	\N	1
9	1	АО «Яндекс Банк»	\N	\N	1
10	1	АО «Коммерческий банк Юнистрим»	\N	\N	1
11	1	АО «Т-Банк»	\N	\N	1
12	1	АО «Акционерный банк «Россия»	\N	\N	1
13	1	ВасяБанк	30	1.00	0
\.


--
-- Data for Name: cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cards (id, title, country, lang, time_exchange, commission, id_balance, status) FROM stdin;
1	Россия (RU)	Любой банк в России	ru	30	1.50	1	1
2	Турция (TR)	Любой банк в Турции	tr	30	4.50	2	0
\.


--
-- Data for Name: exchange_rates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exchange_rates (id, from_balance_id, to_balance_id, from_currency, to_currency, rate, updated_at) FROM stdin;
e659aff7-a1c5-4ca7-b22c-ef5d8fa8d20b	4	1	USDT	RUB	81.15000000	2025-10-06 11:04:51.375
\.


--
-- Data for Name: exchanges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exchanges (id, number_order, id_user, id_balance_from, id_balance_to, id_card, from_currency, to_currency, amount_from, amount_to, rate, commission, "timestamp", status, wallet_id, manual_card_number, cancel_reason, payment_hash) FROM stdin;
2	U4CRPMD8IL	1	4	1	2	USDT	RUB	100.00000000	9550.00000000	95.50000000	0.00000000	2025-10-05 12:07:35.08608	paid	2	\N	\N	\N
1	OR73BCCFYS	1	4	1	2	USDT	RUB	100.00000000	9550.00000000	95.50000000	0.00000000	2025-10-05 11:39:06.218508	wait	1	\N	\N	\N
3	QWOVVUU08G	1	4	1	2	USDT	RUB	102.00000000	9741.00000000	95.50000000	0.00000000	2025-10-05 12:21:06.275812	paid	3	\N	\N	\N
4	74OSIY09JF	1	4	1	2	USDT	RUB	100.00000000	9550.00000000	95.50000000	0.00000000	2025-10-05 14:31:45.552	complete	4	\N	\N	\N
5	VBZDIF7CN6	1	4	1	2	USDT	RUB	105.00000000	10027.50000000	95.50000000	0.00000000	2025-10-05 14:51:37.852731	wait	5	\N	\N	\N
6	VJZVRZHXIC	1	4	1	2	USDT	RUB	105.00000000	10027.50000000	95.50000000	0.00000000	2025-10-05 14:54:44.142828	complete	6	\N	\N	bjbksdbfbkfsbdkfbs
7	AJ01SUEP06	1	4	1	2	USDT	RUB	100.00000000	9550.00000000	95.50000000	0.00000000	2025-10-05 19:42:47.246382	wait	12	\N	\N	\N
8	FF2FNYGAVI	1	4	1	2	USDT	RUB	100.00000000	9550.00000000	95.50000000	0.00000000	2025-10-05 19:47:26.241469	wait-paid	13	\N	\N	\N
9	YJUI4HCH5Q	1	4	1	2	USDT	RUB	300.00000000	28650.00000000	95.50000000	0.00000000	2025-10-05 19:47:48.790112	wait	14	\N	\N	\N
10	G8HKSHTUEE	1	4	1	2	USDT	RUB	106.00000000	10123.00000000	95.50000000	0.00000000	2025-10-05 19:48:41.950211	wait	15	\N	\N	\N
11	SX37E5GYAV	1	4	1	\N	USDT	RUB	109.00000000	10409.50000000	95.50000000	0.00000000	2025-10-05 19:49:05.494431	canceled	16	3423 4234 2342 3433	Не поступил платеж	\N
12	76MNCWRZSR	5	4	1	3	USDT	RUB	100.00000000	9550.00000000	95.50000000	0.00000000	2025-10-06 10:41:41.67369	wait-paid	1	\N	\N	\N
13	2RVFIAC2DB	5	4	1	3	USDT	RUB	1000.00000000	95500.00000000	95.50000000	0.00000000	2025-10-06 10:57:19.141514	paid	3	\N	\N	\N
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
demo-chat-1	\N	\N	[{"sender":"Elena from support","message":"Hi there! How can I help?","timestamp":"2025-10-02T06:55:18.741Z"},{"sender":"admin","message":"Нормально","timestamp":"2025-10-06T07:30:20.042Z"}]	open	2025-10-02 06:55:18.741
\.


--
-- Data for Name: support_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_messages (id, ticket_id, sender, message, created_at) FROM stdin;
1	1	user	Привет, нужно порешать вопросы	2025-10-05 16:42:34.298549
2	1	user	Еще есть вопрос	2025-10-05 17:25:30.305006
3	1	support	Ваш вопрос решен	2025-10-06 07:40:51.381756
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_tickets (id, user_id, exchange_id, status, created_at, updated_at) FROM stdin;
1	1	5	wait-user	2025-10-05 16:42:34.298549	2025-10-06 07:40:51.813
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, order_id, user_id, from_currency, to_currency, from_amount, to_amount, from_address, to_address, card_number, status, tx_hash, created_at, completed_at) FROM stdin;
6c48c5f5-5a66-46fb-9271-0684d250eff7	order_1759686109354_6s6mht3s5ef	1	USDT	USDT	10.00000000	9.90000000	TW6LqMKykCfsgkMkLxd92HGbp...	TW6LqMKykCfsgkMkLxd92HGbp...	\N	completed	\N	2025-10-05 17:41:49.471646	\N
d33e69ac-a97a-4daf-ab46-714f5c86a5be	order_1759686694331_2hh8zo60erx	1	USDT	USDT	1.00000000	0.99000000	TW6LqMKykCfsgkMkLxd92HGbp...	TW6LqMKykCfsgkMkLxd92HGbp...	\N	completed	\N	2025-10-05 17:51:34.450475	\N
bce4e778-8e5f-4452-8427-5285d45a9321	order_1759692842902_3jc1x52zpba	1	USDT	USDT	1.00000000	0.99000000	TW6LqMKykCfsgkMkLxd92HGbp...	TW6LqMKykCfsgkMkLxd92HGbp...	\N	completed	\N	2025-10-05 19:34:03.020868	\N
46beac1f-4882-4e8e-9179-32539bc2149f	order_1759692959981_2qyef4pvc76	1	USDT	USDT	1.00000000	0.99000000	TW6LqMKykCfsgkMkLxd92HGbp...	TW6LqMKykCfsgkMkLxd92HGbp...	\N	completed	\N	2025-10-05 19:36:00.1	\N
\.


--
-- Data for Name: user_cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_cards (id, id_card, id_user, name, first_name, last_name, phone, country, number_card, status, id_bank) FROM stdin;
2	1	1	тестовая карта	mike	xio	+79197364764	Любой банк в России	3237427347273747	active	5
3	1	5	yyyyy	ytyy	sadfg	+34557895978	Любой банк в России	5469600029250107	active	2
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, tg_id, google, api_key, name, img, status, agreement, blocked, default_fiat_balance_id, id_ref, code_ref) FROM stdin;
3	test_асир	\N	f06698b2-0b2e-4a61-9b61-dff6203c7f78	Асир	\N	active	0	f	\N	\N	Y841640153
4	test_fgg	\N	b64a9aae-f00b-49c8-b9ac-e7aaa562efd5	fgg	\N	active	1	f	\N	\N	V352357808
1	test_test	\N	977b6e04-4768-425c-86d3-f5144f3b7c4c	test	\N	active	1	f	5	\N	C131337788
2	test_оит	\N	a84e5992-fac9-4cbd-becc-d3e3dd9545a5	оит	\N	active	1	f	1	\N	W537071117
5	test_high	\N	41cc0734-d0f5-49f1-bd7d-cce7e0834f5a	high	\N	active	1	f	5	\N	A614792811
6	test_от	\N	2485806f-7f27-492f-b1a3-f99b42a008bf	от	\N	active	0	f	\N	\N	V480085293
7	test_umid	\N	40fece28-63d2-42d3-ae88-e62ca0146bab	umid	\N	active	1	f	\N	\N	V347418316
8	895319443	\N	06c143a1-0b73-4d13-93a1-1080f535932c	弗拉迪斯拉夫	https://t.me/i/userpic/320/KKRBfqNYGu3p_v0t0cayfuytzF6c9AFrebISpxT17Nk.jpg	active	1	f	\N	\N	N233097757
\.


--
-- Data for Name: users_balances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users_balances (id, id_balance, id_user, sum, status) FROM stdin;
10	1	8	0.00000000	active
9	4	8	10.00000000	active
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallets (id, id_user, network, address, reservation_time, status, private_key, reserved) FROM stdin;
4	8	BEP20	0xd85a91d47123af423c1cadcce242eb911e2ab273	2025-10-08 10:44:45.741	active	ceb1fce47431d6f506caad6061e3d857323e990bc10e691f4b0459bfa865b005	topup
10	8	TON	EQCUiY-SSUO6AcVHuMtCLoD8IF4y-1OoZBTp7hW0tBFHzE_B	2025-10-08 10:44:51.025	active	8e2d91f615b46d9151af6e358a5df4ff6e03ff7eb943a1c350f85294d39f8120b4e589719ea100afac40a464741a4746c4e8fd692c4b98c184169094bce0411c	topup
2	\N	BEP20	0x6ec215e998f37e36150a80fa12a857a50759ac12	\N	active	a1a0fe1a3170dff1ed5d8662bea73c95aabba26187c66922fe877b63c02f0d6f	\N
18	\N	TON	EQB6Q3Xc2sGXBC6O33UgBA33VYLP7WKcVDxJ-6j5nUCW34m5	\N	active	753c3f91f54935c9382a473f94d48d81059f9ed1171190957a564fb351e58cdda80095a34a4cbb7f09392d87f3015f66e5a299aa8157362cc8d3f08265e92cbc	\N
17	8	TRC20	4168cede4ad47415c8453a9148a9a4405a503a8382	2025-10-08 11:22:19.622	active	798aee07d6fa929635bb993ad61a46d29e2919e7841eddbde311dafd84f9b447	topup
9	1	TRC20	4107e48f0241ea170d7f8bdf78f5f204399c84948d	2025-10-08 08:16:30.269	active	315d2bfa261d1400087005afe31a3132b3663ba0ca5384820a944dea5f2bb835	topup
5	\N	BEP20	0x5ceb5e2f3cd06fe9446695b274e8f6e03b8360a6	\N	active	2d5ecea0f14231563eea3566155593f2154e6d8b605dd57546f0f0173a578c2d	\N
6	\N	BEP20	0xbe343049c42326f639b7817b7aa15abcccc24410	\N	active	911ab18a6852dbaaf21c4f7204a26252e3694d8c377a5238be76184d1c3cacca	\N
11	\N	BEP20	0x1bdef99a56e21ace2fe43bd160b16fd212e59bc8	\N	active	0cb77136b03030da04c47da889eb1b5a967a2583373298b6640f36ff1d750bac	\N
12	\N	BEP20	0x941e52f18baed5cfb809a6a583b85f6d77c46c9a	\N	active	9c45d2ced580f6c85b1aee1a3d19dd56ec18c85046b0abb7ee9900d7a81445a9	\N
13	\N	BEP20	0x5de1f8096858ac4f81e15fdbee5bee6981fa63e4	\N	active	d268934205aaf432e727c1496b8382237836b34b8a11b90998d8fe7f363922f1	\N
14	\N	BEP20	0x2671d3764590c5c97b0735ff6b59ad89c5f261a8	\N	active	c187c566dad1c05f4830d76a98b8097142ec47de86616122daafabccba2d7c51	\N
15	\N	BEP20	0x160c98be7a34d84377a34d56ffb0200a852d6f89	\N	active	ff70a79c14c9593ce0f36f877ed9b88de1e4d5616ea7e41eebc16776744e8b2f	\N
16	\N	BEP20	0x551f274e2f2489cc101d8d3d684868b9f6f47220	\N	active	270b6ffc1a1ad06058090d536219817a4d960be2932a68f4cebb7fefc1d7d7cc	\N
1	\N	BEP20	0x91f1ebf7d7b07fdda6bdadae8aebb0eda2a7e3a8	\N	active	0cb99864638f0fef9d359a3df42339b1cf8b035c2b8643483b5b07469195f978	\N
3	\N	BEP20	0xea4efcfc664ed44a455493a1ba05b079f3d44a2a	\N	active	aac4f949b02e34849eb4640f903ec35bd31ea08e5395235152783da853e0ef54	\N
\.


--
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admins_id_seq', 1, false);


--
-- Name: balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.balances_id_seq', 5, true);


--
-- Name: banks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.banks_id_seq', 13, true);


--
-- Name: cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cards_id_seq', 2, true);


--
-- Name: exchanges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.exchanges_id_seq', 13, true);


--
-- Name: stats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stats_id_seq', 1, false);


--
-- Name: support_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_messages_id_seq', 3, true);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_tickets_id_seq', 1, true);


--
-- Name: user_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_cards_id_seq', 3, true);


--
-- Name: users_balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_balances_id_seq', 10, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 8, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallets_id_seq', 21, true);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- Name: balances balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balances
    ADD CONSTRAINT balances_pkey PRIMARY KEY (id);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (id);


--
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: exchanges exchanges_number_order_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_number_order_unique UNIQUE (number_order);


--
-- Name: exchanges exchanges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_pkey PRIMARY KEY (id);


--
-- Name: stats stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats
    ADD CONSTRAINT stats_pkey PRIMARY KEY (id);


--
-- Name: support_chats support_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_chats
    ADD CONSTRAINT support_chats_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_order_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_order_id_unique UNIQUE (order_id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_cards user_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cards
    ADD CONSTRAINT user_cards_pkey PRIMARY KEY (id);


--
-- Name: users users_api_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_api_key_unique UNIQUE (api_key);


--
-- Name: users_balances users_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_balances
    ADD CONSTRAINT users_balances_pkey PRIMARY KEY (id);


--
-- Name: users users_code_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_code_ref_key UNIQUE (code_ref);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_tg_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tg_id_unique UNIQUE (tg_id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: banks banks_card_id_cards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_card_id_cards_id_fk FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: exchange_rates exchange_rates_from_balance_id_balances_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_from_balance_id_balances_id_fk FOREIGN KEY (from_balance_id) REFERENCES public.balances(id);


--
-- Name: exchange_rates exchange_rates_to_balance_id_balances_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_to_balance_id_balances_id_fk FOREIGN KEY (to_balance_id) REFERENCES public.balances(id);


--
-- Name: exchanges exchanges_id_balance_from_balances_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_id_balance_from_balances_id_fk FOREIGN KEY (id_balance_from) REFERENCES public.balances(id) ON DELETE SET NULL;


--
-- Name: exchanges exchanges_id_balance_to_balances_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_id_balance_to_balances_id_fk FOREIGN KEY (id_balance_to) REFERENCES public.balances(id) ON DELETE SET NULL;


--
-- Name: exchanges exchanges_id_card_user_cards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_id_card_user_cards_id_fk FOREIGN KEY (id_card) REFERENCES public.user_cards(id) ON DELETE SET NULL;


--
-- Name: exchanges exchanges_id_user_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_id_user_users_id_fk FOREIGN KEY (id_user) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: exchanges exchanges_wallet_id_wallets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_wallet_id_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE SET NULL;


--
-- Name: stats stats_id_exchange_exchanges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats
    ADD CONSTRAINT stats_id_exchange_exchanges_id_fk FOREIGN KEY (id_exchange) REFERENCES public.exchanges(id) ON DELETE CASCADE;


--
-- Name: stats stats_id_user_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats
    ADD CONSTRAINT stats_id_user_users_id_fk FOREIGN KEY (id_user) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_chats support_chats_transaction_id_transactions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_chats
    ADD CONSTRAINT support_chats_transaction_id_transactions_id_fk FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);


--
-- Name: support_chats support_chats_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_chats
    ADD CONSTRAINT support_chats_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: support_messages support_messages_ticket_id_support_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_ticket_id_support_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_exchange_id_exchanges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_exchange_id_exchanges_id_fk FOREIGN KEY (exchange_id) REFERENCES public.exchanges(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_cards user_cards_id_bank_banks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cards
    ADD CONSTRAINT user_cards_id_bank_banks_id_fk FOREIGN KEY (id_bank) REFERENCES public.banks(id) ON DELETE SET NULL;


--
-- Name: user_cards user_cards_id_card_cards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cards
    ADD CONSTRAINT user_cards_id_card_cards_id_fk FOREIGN KEY (id_card) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: user_cards user_cards_id_user_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cards
    ADD CONSTRAINT user_cards_id_user_users_id_fk FOREIGN KEY (id_user) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users_balances users_balances_id_balance_balances_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_balances
    ADD CONSTRAINT users_balances_id_balance_balances_id_fk FOREIGN KEY (id_balance) REFERENCES public.balances(id) ON DELETE CASCADE;


--
-- Name: users_balances users_balances_id_user_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_balances
    ADD CONSTRAINT users_balances_id_user_users_id_fk FOREIGN KEY (id_user) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_default_fiat_balance_id_balances_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_default_fiat_balance_id_balances_id_fk FOREIGN KEY (default_fiat_balance_id) REFERENCES public.balances(id) ON DELETE SET NULL;


--
-- Name: users users_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_ref_fkey FOREIGN KEY (id_ref) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wallets wallets_id_user_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_id_user_users_id_fk FOREIGN KEY (id_user) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

