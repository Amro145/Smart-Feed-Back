import { DurableObject } from "cloudflare:workers";

interface Env {
    MY_DURABLE_OBJECT: DurableObjectNamespace<MyDurableObject>;
    FEEDBACK_QUEUE: Queue;
    AI: any;
    VECTOR_INDEX: VectorizeIndex;
}
export class MyDurableObject extends DurableObject<Env> {
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === "POST" && url.pathname === "/increment") {
            let count: number = await this.ctx.storage.get("message_count") || 0;
            count++;
            await this.ctx.storage.put("message_count", count);

            const data = (await request.json()) as { text: string; sentiment: any };
            let recent: any[] = await this.ctx.storage.get("recent_messages") || [];

            recent.unshift({
                text: data.text || "No feedback text",
                sentiment: data.sentiment || "UNKNOWN",
                timestamp: Date.now()
            });
            recent = recent.slice(0, 5); // keep only last 5

            await this.ctx.storage.put("recent_messages", recent);

            return new Response("Incremented");
        }

        if (request.method === "GET" && url.pathname === "/stats") {
            const count = await this.ctx.storage.get("message_count") || 0;
            const recent = await this.ctx.storage.get("recent_messages") || [];
            return new Response(JSON.stringify({ count, recent }), {
                headers: { "Content-Type": "application/json" }
            });
        }
        if (url.pathname === "/api/search") {
            const query = url.searchParams.get("q");
            if (!query) {
                return new Response("No query provided", { status: 400 });
            }
            // convert query to embedding
            const embeddings = await this.env.AI.run("@cf/baai/bge-small-en-v1.5", { text: [query] });
            const vector = embeddings.data[0];
            // find 3 word that similar to query
            const matches = await this.env.VECTOR_INDEX.query(vector, {
                topK: 3,
                returnMetadata: true
            });
            return new Response(JSON.stringify(matches), {
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response("Not found", { status: 404 });
    }
}

const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Feedback Dashboard</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #3b82f6; --accent-glow: rgba(59, 130, 246, 0.5); }
        body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); padding: 2rem; margin: 0; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 2rem; }
        .header h1 { font-size: 2.5rem; background: linear-gradient(90deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; }
        .header p { color: #94a3b8; font-size: 1.1rem; }
        .card { background: var(--card); border-radius: 1rem; padding: 2rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 0 20px var(--accent-glow); margin-bottom: 2rem; border: 1px solid rgba(255,255,255,0.05); }
        .card h2 { margin-top: 0; margin-bottom: 1.5rem; font-size: 1.25rem; font-weight: 600; color: #cbd5e1; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;}
        .counter { font-size: 5rem; font-weight: bold; text-align: center; color: var(--accent); }
        .message-list { list-style: none; padding: 0; margin: 0; }
        .message-item { padding: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; border-radius: 0.5rem; }
        .message-item:hover { background: rgba(255,255,255,0.05); }
        .message-item:last-child { border-bottom: none; }
        .badge { padding: 0.35rem 0.85rem; border-radius: 999px; font-size: 0.85rem; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;}
        .badge.positive { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.2);}
        .badge.negative { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.2);}
        .badge.neutral { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.2);}
        .text { flex-grow: 1; margin-right: 1.5rem; font-size: 1.05rem; line-height: 1.5; color: #e2e8f0; }
        .date { font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; }
        .default-form { display: flex; flex-direction: column; gap: 1rem; }
        #feedbackInput { width: 100%; min-height: 100px; padding: 1rem; border-radius: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: var(--text); font-family: inherit; resize: vertical; box-sizing: border-box; }
        #feedbackInput:focus { outline: none; border-color: var(--accent); }
        #submitBtn { background: var(--accent); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 1rem; align-self: flex-start; }
        #submitBtn:hover { background: #2563eb; transform: translateY(-1px); box-shadow: 0 4px 12px var(--accent-glow); }
        #submitBtn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Feedback Intelligence Dashboard</h1>
            <p>Live AI Sentiment Analysis Monitor</p>
        </div>

        <div class="card">
            <h2>Submit New Feedback</h2>
            <div class="default-form">
                <textarea id="feedbackInput" placeholder="Enter student feedback here..."></textarea>
                <button id="submitBtn" onclick="sendFeedback()">Submit for AI Analysis</button>
            </div>
        </div>
        
        <div class="card">
            <h2>Total Feedback Analyzed</h2>
            <div id="counter" class="counter">...</div>
        </div>

        <div class="card">
            <h2>Search Feedback Memory</h2>
            <div class="default-form" style="flex-direction: row; flex-wrap: wrap;">
                <input type="text" id="searchInput" placeholder="Search similar feedback..." style="flex-grow: 1; min-width: 200px; padding: 1rem; border-radius: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: var(--text); font-family: inherit; box-sizing: border-box;">
                <button id="searchBtn" onclick="searchFeedback()">Search</button>
            </div>
            <ul id="searchResults" class="message-list" style="margin-top: 1.5rem; display: none;"></ul>
        </div>

        <div class="card">
            <h2>Last 5 Analyzed Messages</h2>
            <ul id="messages" class="message-list">
                <li style="text-align: center; color: #94a3b8; padding: 2rem;">Loading latest feedback...</li>
            </ul>
        </div>
    </div>

    <script>
        async function fetchStats() {
            try {
                const res = await fetch('/api/stats');
                const data = await res.json();
                
                document.getElementById('counter').innerText = data.count || 0;
                
                const messageList = document.getElementById('messages');
                if (data.recent && data.recent.length > 0) {
                    messageList.innerHTML = data.recent.map(msg => {
                        let label = 'UNKNOWN';
                        let cssClass = '';
                        if (msg.sentiment) {
                            if (typeof msg.sentiment === 'string') {
                                label = msg.sentiment;
                            } else if (Array.isArray(msg.sentiment) && msg.sentiment.length > 0) {
                                label = msg.sentiment[0].label;
                            } else if (msg.sentiment.label) {
                                label = msg.sentiment.label;
                            }
                        }
                        
                        const upperLabel = label.toUpperCase();
                        if (upperLabel.includes('POS')) cssClass = 'positive';
                        else if (upperLabel.includes('NEG')) cssClass = 'negative';
                        else if (upperLabel.includes('NEU')) cssClass = 'neutral';
                        
                        const dateStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
                        
                        return \`<li class="message-item">
                                    <div style="flex-grow: 1;">
                                        <div class="text">"\${msg.text}"</div>
                                        <div class="date">\${dateStr}</div>
                                    </div>
                                    <span class="badge \${cssClass}">\${upperLabel}</span>
                                </li>\`;
                    }).join('');
                } else {
                    messageList.innerHTML = '<li style="text-align: center; color: #94a3b8; padding: 2rem;">No messages yet.</li>';
                }
            } catch (err) {
                console.error("Failed to fetch stats", err);
            }
        }

        async function sendFeedback() {
            const input = document.getElementById('feedbackInput');
            const btn = document.getElementById('submitBtn');
            const text = input.value.trim();
            
            if (!text) {
                alert("Please enter some feedback before submitting.");
                return;
            }

            btn.disabled = true;
            btn.innerText = "Sending...";

            try {
                const res = await fetch('/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });

                if (res.ok) {
                    input.value = '';
                    fetchStats();
                    setTimeout(fetchStats, 2000); 
                } else {
                    alert("Failed to send feedback. Please try again.");
                }
            } catch (err) {
                console.error(err);
                alert("An error occurred while sending feedback.");
            } finally {
                btn.disabled = false;
                btn.innerText = "Submit for AI Analysis";
            }
        }

        async function searchFeedback() {
            const input = document.getElementById('searchInput');
            const btn = document.getElementById('searchBtn');
            const resultsList = document.getElementById('searchResults');
            const query = input.value.trim();
            
            if (!query) return;

            btn.disabled = true;
            btn.innerText = "Searching...";
            resultsList.style.display = "block";
            resultsList.innerHTML = '<li style="text-align: center; color: #94a3b8; padding: 2rem;">Searching Vector Memory...</li>';

            try {
                const res = await fetch('/api/search?q=' + encodeURIComponent(query));
                const data = await res.json();
                
                if (data.matches && data.matches.length > 0) {
                    resultsList.innerHTML = data.matches.map(m => {
                        const score = (m.score * 100).toFixed(1);
                        return \`<li class="message-item">
            <div style="flex-grow: 1;">
                <div class="text">"\${m.metadata && m.metadata.text ? m.metadata.text : 'ID: ' + m.id}"</div> 
            </div>
            <span class="badge neutral">\${score}% Match</span>
        </li>\`;
                    }).join('');
                } else {
                    resultsList.innerHTML = '<li style="text-align: center; color: #94a3b8; padding: 2rem;">No similar feedback found.</li>';
                }
            } catch (err) {
                console.error("Failed to search", err);
                resultsList.innerHTML = '<li style="text-align: center; color: #ef4444; padding: 2rem;">Error performing search.</li>';
            } finally {
                btn.disabled = false;
                btn.innerText = "Search";
            }
        }

        fetchStats();
        setInterval(fetchStats, 5000);
    </script>
</body>
</html>`;

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === "GET") {
            if (url.pathname === "/") {
                return new Response(dashboardHtml, {
                    headers: { "Content-Type": "text/html;charset=utf-8" }
                });
            } else if (url.pathname === "/api/stats") {
                const id = env.MY_DURABLE_OBJECT.idFromName("global-stats");
                const stub = env.MY_DURABLE_OBJECT.get(id);
                return stub.fetch(new Request("http://do/stats"));
            } else if (url.pathname === "/api/search") {
                const id = env.MY_DURABLE_OBJECT.idFromName("global-stats");
                const stub = env.MY_DURABLE_OBJECT.get(id);
                return stub.fetch(new Request("http://do/api/search" + url.search));
            }
        }

        if (request.method === "POST" && url.pathname !== "/increment") {
            const { text } = (await request.json()) as { text: string };

            await env.FEEDBACK_QUEUE.send({
                text
            });
            return new Response("Feedback sent successfully", { status: 200 });
        }

        return new Response("Invalid request", { status: 400 });
    },
    async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext) {
        for (const message of batch.messages) {
            const content = message.body.text;

            // 1. AI Sentiment Analysis
            const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
                messages: [
                    {
                        role: "system",
                        content: "You are a sentiment analysis assistant. Analyze the sentiment of the following feedback and respond with only one word: POSITIVE, NEGATIVE, or NEUTRAL.",
                    },
                    {
                        role: "user",
                        content: `Analyze the sentiment of the following feedback and respond with only one word: POSITIVE, NEGATIVE, or NEUTRAL. Feedback: ${content}`,
                    },
                ],
            });
            const sentiment = aiResponse.response.trim().toUpperCase();

            // 2. AI Pipeline Component
            const embedding = await env.AI.run("@cf/baai/bge-small-en-v1.5", { text: [content] });

            // 3. Save to Vectorize
            await env.VECTOR_INDEX.upsert([{
                id: message.id,
                values: embedding.data[0],
                metadata: { text: content }
            }]);

            // 4. Update Durable Object properties
            const id = env.MY_DURABLE_OBJECT.idFromName("global-stats");
            const stub = env.MY_DURABLE_OBJECT.get(id);
            await stub.fetch(new Request("http://do/increment", {
                method: "POST",
                body: JSON.stringify({ text: content, sentiment }),
                headers: { "Content-Type": "application/json" }
            }));

            console.log(`feedback ${message.id} processed successfully: ${content} | Sentiment: ${JSON.stringify(sentiment)}`);
        }
    }
} satisfies ExportedHandler<Env>;
