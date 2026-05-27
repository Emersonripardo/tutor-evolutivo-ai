import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import fetch from "node-fetch"
import path from "path"

dotenv.config()

// ======================================================
// VALIDAÇÃO DE VARIÁVEIS
// ======================================================

const REQUIRED_ENV = ["GEMINI_API_KEY"]

const missing = REQUIRED_ENV.filter(
  key => !process.env[key]
)

if(missing.length){

  console.error(
    `❌ Variáveis faltando: ${missing.join(", ")}`
  )

  process.exit(1)

}

const GEMINI_API_KEY =
process.env.GEMINI_API_KEY

const PORT =
process.env.PORT || 3000

const CEFIS_API_KEY =
process.env.CEFIS_API_KEY || ""

// ======================================================
// APP
// ======================================================

const app = express()

// ======================================================
// MIDDLEWARES
// ======================================================

app.use(cors({

  origin:
  process.env.ALLOWED_ORIGIN || "*"

}))

app.use(express.json({

  limit:"32kb"

}))

// ======================================================
// RATE LIMIT
// ======================================================

const requests = new Map()

const WINDOW_MS = 60000
const MAX_REQUESTS = 30

function rateLimit(req,res,next){

  const ip =
  req.ip || "unknown"

  const now =
  Date.now()

  const userData =
  requests.get(ip)

  if(!userData){

    requests.set(ip,{
      count:1,
      start:now
    })

    return next()

  }

  if(now - userData.start > WINDOW_MS){

    requests.set(ip,{
      count:1,
      start:now
    })

    return next()

  }

  userData.count++

  if(userData.count > MAX_REQUESTS){

    return res.status(429).json({

      error:"Muitas requisições. Aguarde."

    })

  }

  next()

}

// limpa memória
setInterval(()=>{

  const now = Date.now()

  for(const [ip,data] of requests){

    if(now - data.start > WINDOW_MS){

      requests.delete(ip)

    }

  }

},WINDOW_MS)

// ======================================================
// FRONTEND
// ======================================================

app.use(express.static("."))

app.get("/",(req,res)=>{

  res.sendFile(
    path.resolve("index.html")
  )

})

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/health",(req,res)=>{

  res.json({

    status:"online"

  })

})

// ======================================================
// FETCH COM TIMEOUT
// ======================================================

async function fetchWithTimeout(

  url,
  options = {},
  timeout = 15000

){

  const controller =
  new AbortController()

  const timer =
  setTimeout(()=>{

    controller.abort()

  },timeout)

  try{

    const response =
    await fetch(url,{

      ...options,

      signal:
      controller.signal

    })

    return response

  }finally{

    clearTimeout(timer)

  }

}

// ======================================================
// CHAT GEMINI
// ======================================================

app.post("/chat",rateLimit,async(req,res)=>{

  try{

    const { messages } =
    req.body

    // ==========================
    // VALIDAÇÃO
    // ==========================

    if(

      !Array.isArray(messages)
      ||
      messages.length === 0

    ){

      return res.status(400).json({

        error:"Messages inválido"

      })

    }

    const invalid =
    messages.some(

      m=>

      typeof m?.role !== "string"
      ||
      typeof m?.content !== "string"

    )

    if(invalid){

      return res.status(400).json({

        error:"Formato inválido"

      })

    }

    // ==========================
    // HISTÓRICO
    // ==========================

    const contents =
    messages.map(m=>({

      role:
      m.role === "assistant"
      ? "model"
      : "user",

      parts:[
        {
          text:m.content
        }
      ]

    }))

    const lastMessage =
    messages[messages.length - 1]
    ?.content || ""

    // ==========================
    // LIMITE TEXTO
    // ==========================

    if(lastMessage.length > 4000){

      return res.status(400).json({

        error:"Mensagem muito grande."

      })

    }

    // ==========================
    // CHAMADA GEMINI
    // ==========================

    const response =
    await fetchWithTimeout(

      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,

      {

        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify({

          systemInstruction:{

            parts:[

              {
                text:`

Você é um tutor educacional de elite.

OBJETIVOS:

- ensinar profundamente
- explicar simples
- usar analogias
- ensinar passo a passo
- agir como professor humano
- adaptar explicações
- usar exemplos reais
- incentivar o aluno

REGRAS:

- nunca responda curto
- use markdown
- explique detalhadamente
- use listas
- incentive prática
- recomende exercícios

`
              }

            ]

          },

          contents

        })

      }

    )

    const data =
    await response.json()

    console.log(

      JSON.stringify(
        data,
        null,
        2
      )

    )

    // ==========================
    // ERRO GEMINI
    // ==========================

    if(data.error){

      console.error(data.error)

      return res.status(500).json({

        error:
        data.error.message

      })

    }

    // ==========================
    // RESPOSTA
    // ==========================

    const text =

      data?.candidates?.[0]
      ?.content?.parts?.[0]
      ?.text

      ||

      "Não consegui responder."

    return res.json({

      choices:[

        {
          message:{

            role:"assistant",

            content:text

          }
        }

      ]

    })

  }catch(error){

    console.error(error)

    return res.status(500).json({

      error:"Erro interno"

    })

  }

})

// ======================================================
// CURSOS CEFIS
// ======================================================

app.get("/courses",rateLimit,async(req,res)=>{

  try{

    const headers = {

      Accept:"application/json"

    }

    if(CEFIS_API_KEY){

      headers["Authorization"] =
      `Bearer ${CEFIS_API_KEY}`

    }

    const response =
    await fetchWithTimeout(

      "https://api-v3.cefis.com.br/courses",

      { headers }

    )

    const data =
    await response.json()

    return res.json(data)

  }catch(error){

    console.error(error)

    return res.status(500).json({

      error:"Erro cursos"

    })

  }

})

// ======================================================
// 404
// ======================================================

app.use((req,res)=>{

  res.status(404).json({

    error:"Rota não encontrada"

  })

})

// ======================================================
// ERROR HANDLER
// ======================================================

app.use((err,req,res,next)=>{

  console.error(err)

  res.status(500).json({

    error:"Erro inesperado"

  })

})

// ======================================================
// SERVER
// ======================================================

app.listen(PORT,()=>{

  console.log("================================")
  console.log("🚀 Tutor Evolutivo Online")
  console.log(`🌎 Porta: ${PORT}`)
  console.log("🤖 Gemini conectado")
  console.log("================================")

})
