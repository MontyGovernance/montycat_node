# 🚀 Montycat Node.js Client — the self-hosted NoSQL + vector database with built-in AI semantic search for RAG & AI agents, powered by Rust

[![npm version](https://img.shields.io/npm/v/montycat.svg)](https://www.npmjs.com/package/montycat)
[![npm downloads](https://img.shields.io/npm/dt/montycat.svg)](https://www.npmjs.com/package/montycat)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/montycat.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TS-ready-blue.svg)]()

Montycat Node.js Client is the official JavaScript and TypeScript SDK for Montycat — the **self-hosted NoSQL + vector database** with semantic search built in, so you get **RAG, AI-agent memory, and vector search** in one Rust-powered engine instead of running a separate vector DB (and paying its per-query bill). No cloud lock-in, no ops headache. It gives Node.js developers the power to work with structured, decentralized, and secure data using a clean, asynchronous API that feels native to JavaScript — not like another bloated driver. Montycat is more than a database — it’s a redefinition of how data should feel in modern, real-time systems.

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

Other databases are written in C, C++, or Java.
`Montycat` was built with Rust — and made accessible to JavaScript / TypeScript.
No adapters, no legacy baggage — just pure async data flow.

## ⚡ Benchmarks (Node.js)

| Operation                      | Throughput               |
| ------------------------------ | ------------------------ |
| Insert (10k records)           | 40k/sec                  |
| Lookup (single key)            | 80k/sec                  |
| Lookup (filtered query)        | 30k/sec                  |
| Real-Time subscription updates | < 2ms latency per update |

Performance depends on engine deployment, network, and schema complexity, but Node.js client overhead is negligible thanks to Rust core.

## When you use Montycat, you’re NOT querying a database. You’re interacting with a living data mesh that feels native to your language. 👉 Learn more about Montycat Engine https://montygovernance.com

## Installation

```bash
npm install montycat
```

or with Yarn:

```bash
yarn add montycat
```

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
    amount: 100,
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
    searchCriteria: { amount: 100 },
    schema: ProductionSchema,
    keyIncluded: true
});

console.log('Lookup results:', res3, res4);

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
    amount: 100,
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
    searchCriteria: { amount: 100 },
    schema: ProductionSchema,
    keyIncluded: true
});

console.log('Lookup results:', res3, res4);

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
> Get it the way that suits you — pull the `montycat-semantic` **Docker image**, download
> the prebuilt **package**, or install from the **apt repository**. The Node.js client API
> is identical either way; just point it at a `montycat-semantic` server (semantic search
> is enabled by default there, using the `bge-small` model).

Enable it once, DB-wide, on the engine; every keyspace is embedded in the background as
data is written (the embedding model is downloaded on first enable).

```typescript
// Turn semantic search on for the whole database (model downloaded on first use).
// model: 'minilm' | 'bge-small' (default) | 'bge-base' | 'e5-small'
await engine.enableSemanticSearch();

// Rank stored items by meaning — two flavors:
//   getValues → each hit is { key, score, value }
//   getKeys   → each hit is { key, score } (lighter; fetch a page later with getBulk)
await Sales.semanticSearchGetValues({ query: 'wireless headphones', limitOutput: { start: 0, stop: 5 } });
await Sales.semanticSearchGetKeys({ query: 'wireless headphones', limitOutput: { start: 0, stop: 5 } });

// Optionally drop weak matches by cosine similarity (range [-1, 1]).
await Sales.semanticSearchGetKeys({ query: 'wireless headphones', limitOutput: { start: 0, stop: 5 }, minScore: 0.35 });

// Turn it off (vectors are kept so re-enabling resumes instantly;
// pass { dropVectors: true } to also clear stored vectors).
await engine.disableSemanticSearch();
```