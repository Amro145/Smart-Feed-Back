# 🧠 Smart Feedback Processor

A powerful, highly scalable full-stack edge application built on **Cloudflare Workers** that processes, analyzes, and catalogs live user feedback using AI models on the Edge.

This system provides a real-time glowing terminal-style Dashboard out-of-the-box, displaying a live tally of submissions and recent text inferences. 

---

## 🏗️ Architecture

This project leverages several core Cloudflare technologies to construct a highly robust pipeline without any separate backend servers:

- **Cloudflare Workers**: The core Edge compute layer acting as both the API logic and the host for the unified web dashboard.
- **Cloudflare Queues** (`feedback-queue`): Receives heavy text submissions asynchronously to prevent UI stalling and process AI models safely.
- **Cloudflare Workers AI**:
  - Uses [\`@cf/meta/llama-3-8b-instruct\`](https://developers.cloudflare.com/workers-ai/models/llama-3-8b-instruct/) using system prompts to dynamically zero-shot label text strings autonomously as \`POSITIVE\`, \`NEGATIVE\`, or \`NEUTRAL\`.
  - Uses [\`@cf/baai/bge-small-en-v1.5\`](https://developers.cloudflare.com/workers-ai/models/bge-small-en-v1.5/) to compute embeddings of incoming texts for relational awareness.
- **Cloudflare Vectorize** (\`feedback-vectors\`): Stores the generated text embeddings alongside their original human-readable text internally in metadata. This database powers direct "Top 5" similarities queries when requested.
- **Cloudflare Durable Objects** (\`MyDurableObject\`): Acts as a globally consistent coordinator to maintain live traffic counters, manage a fixed-size queue of the most recently processed texts, and handle internal \`/api/search\` API routing seamlessly.

---

## 🎨 Features
* **Submit Portal & Live Polling UI**: Navigate to the Worker's root URL to access a beautiful sleek glassmorphism Dashboard capturing live stats and submitting data silently via async \`fetch\`.
* **Semantic Native Search Engine**: Type queries directly into the dashboard. It instantly generates the embedding and crosses your personal \`feedback-vectors\` index returning the top 5 ranked semantic matches seamlessly formatted on your screen.
* **Edge-Triggered AI Pipeline**: Instant AI inferences asynchronously isolated by Cloudflare Queues so the end-user UI remains perfectly stall-free.

---

## 🌐 API & Endpoints

The architecture is split into public-facing Edge endpoints and strictly internal Durable Object routing policies:

### 1. Public Edge Endpoints (\`ExportedHandler\`)
- **\`GET /\`**: Serves the fully cohesive HTML/CSS Dashboard natively from the Worker.
- **\`POST /\`**: Receives feedback submissions securely as JSON (\`{"text":"..."}\`) and immediately dispatches the payload to Cloudflare Queues for asynchronous background processing. Returns \`200 OK\`.
- **\`GET /api/stats\`**: Proxies requests securely to the core \`MyDurableObject\` instance to fetch live metrics without hitting a slow SQL database.
- **\`GET /api/search?q=XYZ\`**: Proxies search queries securely to the \`MyDurableObject\` instance, dynamically returning detailed Vectorize similarities.

### 2. Internal Durable Object API (\`MyDurableObject\`)
- **\`POST /increment\`**: Strictly internal hook invoked *only* by the Queue Consumer (\`queue()\` handler) after heavy AI pipelines finish. It permanently caches \`{ text, sentiment, timestamp }\` arrays globally and increments the master state variables.
- **\`GET /stats\`**: Returns serialized JSON metrics mapping the global counter and the maximum allowable 5 strictly formatted recent texts.
- **\`GET /api/search?q=...\`**: Internally routes the request to `@cf/baai/bge-small-en-v1.5` Worker AI to generate dimensional embeddings on-the-fly, mapping them via a `topK: 5` similarity radius across the `feedback-vectors` repository.

### 3. Asynchronous Queue Processor (\`queue()\`)
1. Batch pulls unverified text messages asynchronously from \`FEEDBACK_QUEUE\`.
2. Triggers **LLaMA 3** zero-shot generative prompting to critically evaluate and define text sentiment (\`POSITIVE/NEGATIVE/NEUTRAL\`).
3. Triggers BAAI representation models to translate the literal text identically into computable \`Vector Embeddings\`.
4. Saves explicitly mapped \`Metadata\` paired meticulously to generated ID clusters internally within the \`feedback-vectors\` index.
5. Coordinates final state-tracking confirmation signaling back to the Durable Object.

---

## 🚀 Setup & Installation

### 1. Prerequisites 
- Ensure you have Node.js and npm installed.
- Log in to your Cloudflare account locally: \`npx wrangler login\`.

### 2. Scaffold & Install 
\`\`\`bash
npm install
\`\`\`

### 3. Provision Cloudflare Bindings
Before deploying, you must ensure your remote Vectorize index and Queues exist in your Cloudflare dashboard:

**Create the Feedback Queue**:
\`\`\`bash
npx wrangler queues create feedback-queue
\`\`\`

**Create the Vectorize Index**:
\`\`\`bash
npx wrangler vectorize create feedback-vectors --dimensions=384 --metric=cosine
\`\`\`

### 4. Deploy!
Once bindings are configured and provisioned matching your \`wrangler.jsonc\` file, ship the worker up to the edge:

\`\`\`bash
npm run deploy
# or
npx wrangler deploy
\`\`\`

---

## 💻 Local Development

To run the Worker locally via Miniflare:

\`\`\`bash
npm run dev
# or 
npx wrangler dev
\`\`\`
*(Navigate to [http://localhost:8787](http://localhost:8787) in your browser to interact with the Dashboard!)*

---

🌟 *Built seamlessly with the modern Cloudflare Developer Platform stack.*
