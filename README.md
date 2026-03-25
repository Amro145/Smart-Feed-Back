# 🧠 Smart Feedback Processor

A powerful, highly scalable full-stack edge application built on **Cloudflare Workers** that processes, analyzes, and catalogs live user feedback using AI models on the Edge.

This system provides a real-time glowing terminal-style Dashboard out-of-the-box, displaying a live tally of submissions and recent text inferences. 

---

## 🏗️ Architecture

This project leverages several core Cloudflare technologies to construct a highly robust pipeline without any separate backend servers:

- **Cloudflare Workers**: The core Edge compute layer acting as both the API logic and the host for the unified web dashboard.
- **Cloudflare Queues** (`feedback-queue`): Receives heavy text submissions asynchronously to prevent UI stalling and process AI models safely.
- **Cloudflare Workers AI**:
  - Uses [`@cf/meta/llama-3-8b-instruct`](https://developers.cloudflare.com/workers-ai/models/llama-3-8b-instruct/) to rapidly label feedback text strings as `POSITIVE`, `NEGATIVE`, or `NEUTRAL`.
  - Uses [`@cf/baai/bge-small-en-v1.5`](https://developers.cloudflare.com/workers-ai/models/bge-small-en-v1.5/) to embed messages into dimensions for semantic searchability.
- **Cloudflare Vectorize** (`feedback-vectors`): Intercepts the generated BGE embeddings and indexes them for future AI RAG architectures and semantic queries.
- **Cloudflare Durable Objects** (`MyDurableObject`): Acts as a globally consistent coordinator to carefully increment a global incoming message counter and store a structured `recent_messages` object array locally.

---

## 🎨 Features
* **Submit Portal & Live Polling UI**: Navigate to the Worker's root URL to access a beautiful sleek glassmorphism Dashboard. Feedback submitted is automatically flushed without page reloading.
* **Edge-Triggered AI Labeling**: Instant inference run across serverless edge zones avoiding massive server spin-ups. 
* **Vector Memory**: Submissions build memory inside Vectorize automatically bridging into next-gen feature potentials. 

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
