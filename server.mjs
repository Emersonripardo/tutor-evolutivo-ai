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

// ======================================================
// LIMPA MEMÓRIA RATE LIMIT
// ======================================================

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
// BANCO DE DADOS EM MEMÓRIA (HACKATHON)
// ======================================================

const hackathonUsers = []

// ======================================================
// REGISTRO
// ======================================================

app.post("/auth/register",rateLimit,async(req,res)=>{

  try{

    const {

      name,
      email,
      pass

    } = req.body

    if(

      !name
      ||
      !email
      ||
      !pass

    ){

      return res.status(400).json({

        error:"Preencha todos os campos."

      })

    }

    const emailNormal =
    email
      .trim()
      .toLowerCase()

    const exists =
    hackathonUsers.find(

      u=>
      u.email === emailNormal

    )

    if(exists){

      return res.status(400).json({

        error:"Este email já está cadastrado."

      })

    }

    const newUser = {

      id:Date.now(),

      name:
      name.trim(),

      first_name:
      name.trim().split(" ")[0],

      email:emailNormal

    }

    hackathonUsers.push({

      ...newUser,

      pass

    })

    console.log(

      `[NOVO USUÁRIO] ${newUser.name}`

    )

    return res.json({

      data:{

        key:
        CEFIS_API_KEY
        ||
        "chave_mockada_hackathon",

        user:newUser

      }

    })

  }catch(error){

    console.error(

      "[REGISTER ERROR]",
      error

    )

    return res.status(500).json({

      error:"Erro no registro"

    })

  }

})

// ======================================================
// LOGIN
// ======================================================

app.post("/auth/login",rateLimit,async(req,res)=>{

  try{

    const {

      email,
      pass

    } = req.body

    if(

      !email
      ||
      !pass

    ){

      return res.status(400).json({

        error:
        "Campos obrigatórios."

      })

    }

    const emailNormal =
    email
      .trim()
      .toLowerCase()

    // ==================================================
    // LOGIN CEFIS
    // ==================================================

    try{

      const upstream =
      await fetchWithTimeout(

        "https://cefis.com.br/api/v1/login",

        {

          method:"POST",

          headers:{

            "Content-Type":
            "application/json",

            Accept:
            "application/json"

          },

          body:JSON.stringify({

            email:emailNormal,

            pass

          })

        }

      )

      const data =
      await upstream.json()

      console.log(
        "[CEFIS LOGIN]",
        data
      )

      if(

        upstream.ok
        &&
        !data.error

      ){

        return res.json(data)

      }

    }catch(err){

      console.error(

        "[CEFIS LOGIN ERROR]",

        err.message

      )

    }

    // ==================================================
    // FALLBACK MOCK
    // ==================================================

    const mockUser =
    hackathonUsers.find(

      u=>

        u.email === emailNormal
        &&
        u.pass === pass

    )

    if(mockUser){

      return res.json({

        data:{

          key:
          CEFIS_API_KEY
          ||
          "chave_mockada_hackathon",

          user:{

            id:
            mockUser.id,

            name:
            mockUser.name,

            first_name:
            mockUser.first_name,

            email:
            mockUser.email

          }

        }

      })

    }

    return res.status(401).json({

      error:
      "Credenciais inválidas."

    })

  }catch(error){

    console.error(

      "[LOGIN ERROR]",
      error

    )

    return res.status(500).json({

      error:"Erro login"

    })

  }

})

// ======================================================
// CHAT GEMINI
// ======================================================

app.post("/chat",rateLimit,async(req,res)=>{

  try{

    const { messages } =
    req.body

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

    if(lastMessage.length > 4000){

      return res.status(400).json({

        error:"Mensagem muito grande."

      })

    }

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

Você é Professor AI.

Especialista em:
- educação
- produtividade
- concursos
- aprendizado acelerado

Seu objetivo:
- ensinar profundamente
- explicar simples
- usar analogias
- agir como professor humano
- incentivar o aluno

Sempre:
- use markdown
- explique detalhadamente
- use listas
- ensine passo a passo

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

    console.log("===== GEMINI RESPONSE =====")

    console.log(
      JSON.stringify(data,null,2)
    )

    console.log("===========================")

    if(data.error){

      console.error(data.error)

      return res.status(500).json({

        error:
        data.error.message

      })

    }

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
// CURSOS
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
// TRACKS MOCK
// ======================================================

app.get("/tracks",(req,res)=>{

  return res.json({

    data:[

      {
        id:1,
        title:"IA e Produtividade"
      },

      {
        id:2,
        title:"Desenvolvimento Web"
      },

      {
        id:3,
        title:"Marketing Digital"
      }

    ]

  })

})

// ======================================================
// CERTIFICADOS MOCK
// ======================================================

app.get("/certs",(req,res)=>{

  return res.json({

    data:[]

  })

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
