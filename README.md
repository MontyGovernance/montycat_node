# 🚀 Montycat for Node.js & TypeScript — The AI-Native NoSQL Database with Semantic Search for RAG & Agents

### Abolish the two-database stack.

The official Node.js & TypeScript SDK for [Montycat](https://montygovernance.com) — a self-hosted **NoSQL + vector database** with AI **semantic search** forged into the core, built for **RAG and AI-agent memory**. One Rust engine, not a sprawl of services. **Your hardware. Your data. Your meaning.**

[![npm version](https://img.shields.io/npm/v/montycat.svg)](https://www.npmjs.com/package/montycat)
[![npm downloads](https://img.shields.io/npm/dt/montycat.svg)](https://www.npmjs.com/package/montycat)
[![Docker Pulls](https://img.shields.io/docker/pulls/montygovernance/montycat)](https://hub.docker.com/r/montygovernance/montycat)
[![Node.js](https://img.shields.io/node/v/montycat.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/MontyGovernance/montycat_node/blob/master/LICENSE)

```typescript
// Search your data by MEANING — no external APIs, no separate vector database.
// (already ON by default in the montycat-semantic server edition)
const hits = await Sales.semanticSearchGetValues({ query: 'Show all Bluetooth devices', limitOutput: { start: 0, stop: 5 } });
// → [{ __key__: 123..., __score__: 0.78, __value__: { name: 'Wireless Headphones' }}]
```

> ### 🧩 All-in-one. AI-native. **Zero external dependencies.**
> The vector-embedding engine runs **inside** the database — **no** separate vector DB, **no** embedding API, **no** API keys, **no** sidecar service. One engine, one binary, your hardware.

## What is Montycat?

For a generation we were told the price of intelligence was two systems: a database for your records, and a separate vector store — with its per-query bill — for their meaning. Montycat rejects that tax. It is a **self-hosted NoSQL + vector database**: one Rust-powered engine with semantic search built in, so **RAG, AI-agent memory, and vector search** live where your data already lives. No cloud lock-in. No ops headache. Decentralized by nature, ultra-fast, and natively async.

Think of it as an **open-source, self-hosted alternative to Pinecone, Weaviate, Chroma, Qdrant, and Redis** — a **vector database _and_ a NoSQL store in a single engine**, so your records and their embeddings live together instead of in two systems you have to keep in sync.

This client gives JavaScript and TypeScript developers structured, decentralized, secure data through a clean async API that feels native to the language — not another bloated driver. Montycat is not an incremental improvement on the databases you know. It is a break with them.

## 🧭 The Montycat Philosophy

- 💡 No query language. No SQL. No CQL. No pseudo-ORM DSLs. Just structured, composable function calls.
- ⚡ Async-first by design. Every operation is fully non-blocking, built for Node.js concurrency and scale.
- 🔐 Safe by construction. No injections, no loose queries, no ambiguity — only typed, structured data access.
- 🧩 Data Mesh native. Every keyspace is its own domain — decentralized, independent, and composable.
- 🧠 Developer-centric. Clean APIs, minimal setup, and full schema-awareness — because data shouldn’t be painful.

### Montycat isn’t just another database with a JavaScript client. It’s a Rust-powered data engine that speaks JavaScript fluently.

## ✨ Key Features

- ⚡ `High Performance` - Ultra-fast read/write operations powered by Rust’s zero-copy architecture.
- 💾 `In-Memory + Persistent` - Combine memory-speed operations with durable persistence — seamlessly.
- 🔄 `Async/Await Native` - Built for modern async I/O — perfect for APIs, microservices, and real-time apps.
- 🧭 `Data Mesh Ready` - Decentralized keyspaces for distributed domain ownership.
- 📡 `Real-Time Subscriptions` - Subscribe to keyspace or key changes with live updates.
- 🔐 `TLS Security` - Encrypted communication and authenticated connections.
- 🧬 `Schema Support` - Optional schema layer for validation, structure, and type safety.
- 🧠 `AI Semantic & Vector Search` - Rank stored items by meaning with on-device embeddings. kNN vector search for **RAG, AI agents & LLM apps** — no external API, no separate vector database.
- 🧱 `Zero Dependencies on ORMs` - No extra abstractions. Just pure, beautiful logic.
- 🧠 `Easy Integration` - Works with Express, Fastify, Next.js, Deno, and any Node.js runtime.

## 🔐 Security & Reliability

- End-to-end TLS support for encrypted transport
- Safe async concurrency — no race conditions or data leaks
- Domain-level data isolation

## 🧠 Why Developers Love Montycat

- 🧱 One protocol. One mindset. No complex dialects or query languages — just structured logic.
- ⚙️ Plays nicely with modern stacks. Works out-of-the-box with Express, Koa, Fastify, Deno, Bun, and Electron.
- 💬 Reactive by nature. Subscriptions make Montycat ideal for dashboards, analytics, and live apps.
- 🪶 Minimal footprint. Lightweight Node.js client backed by a Rust core — zero bloat.

## 🏁 The Future Is Structured

Other databases were written in C, C++, or Java — for a world that no longer exists.
`Montycat` was built in Rust and made to speak JavaScript and TypeScript fluently.
No adapters. No legacy baggage. No permission asked. Just pure async data flow.

The old stack — a database here, a vector store there, an embedding API somewhere in the cloud, and a tangle of sync jobs holding it together — is not an architecture. It is a compromise. Montycat refuses the compromise: **one engine, your hardware, your data, your meaning.**

> **When you use Montycat, you are not querying a database. You are interacting with a living data mesh that speaks your language.**

## 🔍 Example Use Cases

- **RAG pipelines & semantic retrieval** for LLM-powered apps
- **AI agent / chatbot long-term memory** that survives restarts
- **Semantic product search & recommendations** — match intent, not keywords
- Real-time dashboards, analytics, and live collaborative apps
- Microservice data stores and event-driven systems
- Data products in a decentralized Mesh architecture

## 🚀 Get the Engine (30 seconds)

The client talks to a Montycat server. Fastest way — Docker, with AI semantic search built in:

```bash
docker run -d --name montycat \
  -p 21210:21210 -p 21211:21211 \
  -e MONTYCAT_SUPEROWNER="admin" \
  -e MONTYCAT_PASSWORD="change-me" \
  -v montycat_data:/var/lib/.montycat \
  montygovernance/montycat:semantic
```

Prefer the lean edition without the embedding engine? Use the `latest` tag. Prebuilt packages (apt, macOS, Windows) at **https://montygovernance.com**.

## Installation

```bash
npm install montycat
```

or with Yarn:

```bash
yarn add montycat
```

> **ESM-only, Node.js 18+.** This package ships native ES modules — use `import`, not
> `require()`. Works out of the box with TypeScript, Deno, Bun, and any modern Node.js
> project (`"type": "module"` or `.mjs`).

## Quick Start

### TypeScript Example

```typescript
import {Engine, Keyspace, Pointer, Schema, Timestamp} from 'montycat'

// setup connection

interface EngineConfig {
    store: string;
    port: number;
    username: string;
    password: string;
    host: string;
}

const engineConfig: EngineConfig = {
    store: 'Company',
    port: 21210,
    username: 'user',
    password: 'password',
    host: '127.0.0.1',
};

const engine: Engine = new Engine(engineConfig);

// define data structures
class Sales extends Keyspace.Persistent {
    static keyspace = "Sales";
}

class Production extends Keyspace.InMemory {
    static keyspace = "Production";
}

Sales.connectEngine(engine);
Production.connectEngine(engine);

// create keyspaces and store
const res1 = await Sales.createKeyspace();
const res2 = await Production.createKeyspace();

console.log('Keyspace creation results:', res1, res2);

// define data schemas (optional)

interface SalesSchemaInterface {
    item: string;
    amount: number;
};

class SalesSchema extends Schema {
    constructor({ item, amount }: SalesSchemaInterface) {
        super({ item, amount });
    }
};

interface ProductionSchemaInterface {
    workOrder: string;
    customer: string;
};

class ProductionSchema extends Schema {
    constructor({ workOrder, customer }: ProductionSchemaInterface) {
        super({ workOrder, customer });
    }
}

// insert values
const newSale = new SalesSchema({
    item: 'Product 1',
    amount: 10,
}).serialize();

const newOrder = new ProductionSchema({
    workOrder: 'WO 000012',
    customer: 'ACME Corp',
}).serialize();

const res3 = await Sales.insertValue({ value: newSale });
const res4 = await Production.insertValue({ value: newOrder });

console.log('Insertion results:', res3, res4);

// check insertions

const res5 = await Sales.lookupValuesWhere({
    searchCriteria: { item: 'Product 1' },
    keyIncluded: true
});

const res6 = await Production.lookupValuesWhere({
    searchCriteria: { customer: 'ACME Corp' },
    schema: ProductionSchema,
    keyIncluded: true
});

console.log('Lookup results:', res5, res6);

```

### JavaScript Example

```javascript
import {Engine, Keyspace, Pointer, Schema, Timestamp} from 'montycat'

// setup connection

const engineConfig = {
    store: 'Company',
    port: 21210,
    username: 'user',
    password: 'password',
    host: '127.0.0.1',
};

const engine = new Engine(engineConfig);

// define data structures
class Sales extends Keyspace.Persistent {
    static keyspace = "Sales";
}

class Production extends Keyspace.InMemory {
    static keyspace = "Production";
}

Sales.connectEngine(engine);
Production.connectEngine(engine);

// create keyspaces and store
const res1 = await Sales.createKeyspace();
const res2 = await Production.createKeyspace();

console.log('Keyspace creation results:', res1, res2);

// define data schemas (optional)

class SalesSchema extends Schema {
    constructor({ item, amount }) {
        super({ item, amount });
    }
};

class ProductionSchema extends Schema {
    constructor({ workOrder, customer }) {
        super({ workOrder, customer });
    }
}

// insert values
const newSale = new SalesSchema({
    item: 'Product 1',
    amount: 10,
}).serialize();

const newOrder = new ProductionSchema({
    workOrder: 'WO 000012',
    customer: 'ACME Corp',
}).serialize();

const res3 = await Sales.insertValue({ value: newSale });
const res4 = await Production.insertValue({ value: newOrder });

console.log('Insertion results:', res3, res4);

// check insertions

const res5 = await Sales.lookupValuesWhere({
    searchCriteria: { item: 'Product 1' },
    keyIncluded: true
});

const res6 = await Production.lookupValuesWhere({
    searchCriteria: { customer: 'ACME Corp' },
    schema: ProductionSchema,
    keyIncluded: true
});

console.log('Lookup results:', res5, res6);

```

## 🧠 AI-Native Semantic Search — Vector Search Built Into Your Database

**Stop bolting a separate vector database onto your stack.** Montycat ranks your data by
*meaning*, not keywords — an embedded, on-device vector-embedding engine turns every write
into a searchable vector automatically. It's the retrieval layer for **RAG pipelines, AI
agents, semantic search, recommendation engines, and LLM-powered apps** — with **zero
external APIs, zero API keys, and zero extra infrastructure.**

- 🔎 **Semantic / vector search** — kNN similarity over on-device embeddings, not brittle keyword matches.
- 🤖 **Built for AI** — RAG, semantic retrieval, AI agents, recommendations, dedup, clustering.
- 🔒 **Private & free** — embeddings never leave your machine. No OpenAI/Cohere bill, no data egress.
- ⚡ **One system, not two** — your data *and* its vectors live in the same database. No sync jobs, no drift, no second service to run.
- 🚀 **Zero setup** — no index tuning, no pipeline: `enableSemanticSearch()` and you're ranking by meaning.

> **⚠️ Requires the semantic edition of the server — nothing to compile.** Semantic
> search runs an embedded ONNX vector-embedding engine that ships only in the
> **`montycat-semantic`** edition; the default lean `montycat` server does not include it.
> Get it the way that suits you — pull the **Docker image**
> (`montygovernance/montycat:semantic`), download the prebuilt **package**, or install
> `montycat-semantic` from the **apt repository**. The Node.js client API is identical
> either way; just point it at a semantic-edition server (semantic search is enabled by
> default there, using the `bge-small` model).

The switch is DB-wide and already on in the semantic edition; every keyspace is embedded
in the background as data is written (the embedding model is downloaded on demand).

```typescript
// Semantic search is ON by default in the montycat-semantic edition — just search.
// Rank stored items by meaning — two flavors:
//   getValues → each hit is { __key__, __score__, __value__ }
//   getKeys   → each hit is { __key__, __score__ } (lighter; fetch a page later with getBulk)
const hits = await Sales.semanticSearchGetValues({ query: 'Show all Bluetooth devices', limitOutput: { start: 0, stop: 5 } });
const keys = await Sales.semanticSearchGetKeys({ query: 'Show all Bluetooth devices', limitOutput: { start: 0, stop: 5 } });

// Optionally drop weak matches by cosine similarity (range [-1, 1]).
const strong = await Sales.semanticSearchGetKeys({ query: 'Show all Bluetooth devices', limitOutput: { start: 0, stop: 5 }, minScore: 0.35 });

// Control the DB-wide switch (optional — it's already on):
// switch the embedding model: 'minilm' | 'bge-small' (default) | 'bge-base' | 'e5-small'
await engine.enableSemanticSearch({ model: 'bge-base' });

// turn it off (vectors are kept so re-enabling resumes instantly;
// pass { dropVectors: true } to also clear stored vectors)
await engine.disableSemanticSearch();
```

### Hybrid semantic search

Use semantic ranking with a structured metadata constraint. The filter is a
hard AND pre-filter using the same criteria shape as `lookupKeysWhere`; it does
not boost cosine scores.

```typescript
const matchingKeys = await Sales.semanticSearchGetKeysWhere({
  query: 'astronomy and outer space',
  filters: { category: 'space' },
  limitOutput: { start: 0, stop: 5 },
  minScore: 0.35,
});

const matchingValues = await Sales.semanticSearchGetValuesWhere({
  query: 'astronomy and outer space',
  filters: { category: 'space' },
  limitOutput: { start: 0, stop: 5 },
});
// key hits:   { __key__, __score__ }
// value hits: { __key__, __score__, __value__ }
```

## 🔗 Links

- 🌐 **Website & Docs** — https://montygovernance.com
- 📦 **npm** — https://www.npmjs.com/package/montycat
- 🐳 **Docker Hub** — https://hub.docker.com/r/montygovernance/montycat
- 💻 **Source** — https://github.com/MontyGovernance/montycat_node

## ❓ FAQ

- **Is Montycat a vector database or a NoSQL database?** Both — one engine. Store records and query them by *meaning* (vector / semantic search) or by key/schema, without running two systems.
- **Do I need OpenAI or an embedding API?** No. Embeddings run on-device in the `montycat-semantic` server. No API keys, no per-query bill, no data egress.
- **Is it a Pinecone / Weaviate / Chroma / Qdrant alternative?** Yes — self-hosted and open-source, with a NoSQL store built in.
- **TypeScript support?** First-class — the package ships its own type definitions. Works with Node.js, Deno, Bun, Express, Fastify, and Next.js.
