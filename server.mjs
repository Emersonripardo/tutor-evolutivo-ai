import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import fetch from "node-fetch"
import path from "path"

dotenv.config()

// ================================================
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE NO BOOT
// ================================================
const REQUIRED_ENV = ["GEMINI_API_KEY"]
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length) {
  console.error(`[ERRO] Variáveis de ambiente faltando: ${missing.join(", ")}`)
  process.exit(1)
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const PORT           = process.env.PORT || 3000
const CEFIS_API_KEY  = process.env.CEFIS_API_KEY || "" // opcional — algumas rotas exigem auth

const app = express()

// ================================================
// MIDDLEWARES GLOBAIS
// ================================================
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  methods: ["GET", "POST"],
}))

app.use(express.json({ limit: "32kb" })) // evita payloads gigantes

// ------------------------------------------------
// Rate limiting simples (sem dependência externa)
// Limita cada IP a MAX_REQUESTS por janela de tempo
// ------------------------------------------------
const RATE_WINDOW_MS  = 60_000 // 1 minuto
const MAX_REQUESTS    = 30     // por IP por janela
const rateLimitStore  = new Map()

function rateLimit(req, res, next) {
  const ip  = req.ip || req.socket.remoteAddress || "unknown"
  const now = Date.now()
  const entry = rateLimitStore.get(ip)

  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, start: now })
    return next()
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({ error: "Muitas requisições. Aguarde um momento." })
  }

  next()
}

// Limpa o store periodicamente para não vazar memória
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS
  for (const [ip, entry] of rateLimitStore) {
    if (entry.start < cutoff) rateLimitStore.delete(ip)
  }
}, RATE_WINDOW_MS)

// ================================================
// FRONTEND ESTÁTICO
// ================================================
app.use(express.static("."))

app.get("/", (req, res) => {
  res.sendFile(path.resolve("index.html"))
})

// ================================================
// HELPER: fetch com timeout
// ================================================
async function fetchWithTimeout(url, options = {}, timeoutMs = 15_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// ================================================
// ROTA: POST /chat — Proxy seguro para Gemini
// ================================================
app.post("/chat", rateLimit, async (req, res) => {
  const { messages } = req.body

  // ---- Validação de input ----
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Campo 'messages' deve ser um array não-vazio." })
  }

  // Valida que cada item tem role e content string
  const invalid = messages.some(
    m => typeof m?.role !== "string" || typeof m?.content !== "string" || m.content.trim() === ""
  )
  if (invalid) {
    return res.status(400).json({ error: "Cada mensagem deve ter 'role' e 'content' (string não-vazia)." })
  }

  // ---- Monta histórico completo para o Gemini ----
  // Gemini usa "user" e "model" como roles
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  try {
    const geminiRes = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      }
    )

    const data = await geminiRes.json()

    if (data.error) {
      console.error("[Gemini Error]", data.error)
      return res.status(502).json({ error: "Erro na API Gemini: " + (data.error.message || "desconhecido") })
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Não consegui gerar uma resposta."

    // Retorna no mesmo formato OpenAI-like que o frontend espera
    return res.json({
      choices: [{ message: { role: "assistant", content: text } }],
    })

  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[Gemini Timeout]")
      return res.status(504).json({ error: "Timeout ao contatar a Gemini API." })
    }
    console.error("[Chat Error]", err)
    return res.status(500).json({ error: "Erro interno no servidor." })
  }
})

// ================================================
// ROTA: GET /courses — Proxy autenticado para CEFIS
// ================================================
app.get("/courses", rateLimit, async (req, res) => {
  // Repassa query params legítimos vindos do frontend
  const allowed = ["count", "page", "order", "orderDirection", "search", "categories", "filter"]
  const params  = new URLSearchParams()

  for (const key of allowed) {
    const val = req.query[key]
    if (val !== undefined) params.set(key, val)
  }

  const url = `https://api-v3.cefis.com.br/courses?${params}`

  const headers = { Accept: "application/json" }
  if (CEFIS_API_KEY) headers["Authorization"] = `Bearer ${CEFIS_API_KEY}`

  try {
    const upstream = await fetchWithTimeout(url, { headers })

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `CEFIS retornou status ${upstream.status}` })
    }

    const data = await upstream.json()
    return res.json(data)

  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Timeout ao buscar cursos CEFIS." })
    }
    console.error("[Courses Error]", err)
    return res.status(500).json({ error: "Erro ao buscar cursos." })
  }
})

// ================================================
// ROTA: GET /tracks — Trilhas CEFIS
// ================================================
app.get("/tracks", rateLimit, async (req, res) => {
  const allowed = ["count", "page", "categories", "filters"]
  const params  = new URLSearchParams()

  for (const key of allowed) {
    const val = req.query[key]
    if (val !== undefined) params.set(key, val)
  }

  const url = `https://api-v3.cefis.com.br/tracks?${params}`
  const headers = { Accept: "application/json" }
  if (CEFIS_API_KEY) headers["Authorization"] = `Bearer ${CEFIS_API_KEY}`

  try {
    const upstream = await fetchWithTimeout(url, { headers })

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `CEFIS retornou status ${upstream.status}` })
    }

    return res.json(await upstream.json())

  } catch (err) {
    if (err.name === "AbortError") return res.status(504).json({ error: "Timeout ao buscar trilhas." })
    console.error("[Tracks Error]", err)
    return res.status(500).json({ error: "Erro ao buscar trilhas." })
  }
})

// ================================================
// ROTA: POST /auth/login — Proxy de login CEFIS
// A API key nunca trafega pelo frontend
// ================================================
app.post("/auth/login", rateLimit, async (req, res) => {
  const { email, pass } = req.body

  if (!email || !pass || typeof email !== "string" || typeof pass !== "string") {
    return res.status(400).json({ error: "Campos 'email' e 'pass' são obrigatórios." })
  }

  try {
    const upstream = await fetchWithTimeout(
      "https://cefis.com.br/api/v1/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), pass }),
      }
    )

    const data = await upstream.json()

    if (!upstream.ok || data.error) {
      return res.status(upstream.status || 401).json({ error: data?.message || "Credenciais inválidas." })
    }

    // Guarda a key no servidor (opcional: use Redis/DB em produção)
    // Por ora, repassa ao frontend apenas os dados do usuário
    // A key fica no backend se você quiser zero-exposure — aqui repassamos
    // para manter compatibilidade com o fluxo atual do frontend.
    return res.json(data)

  } catch (err) {
    if (err.name === "AbortError") return res.status(504).json({ error: "Timeout no login." })
    console.error("[Login Error]", err)
    return res.status(500).json({ error: "Erro ao autenticar." })
  }
})

// ================================================
// 404 HANDLER
// ================================================
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada." })
})

// ================================================
// GLOBAL ERROR HANDLER
// ================================================
app.use((err, req, res, next) => {
  console.error("[Unhandled Error]", err)
  res.status(500).json({ error: "Erro interno inesperado." })
})

// ================================================
// INICIALIZAÇÃO
// ================================================
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`)
  console.log(`   Gemini: configurado | CEFIS key: ${CEFIS_API_KEY ? "configurada" : "não configurada (rotas públicas)"}`)
})
