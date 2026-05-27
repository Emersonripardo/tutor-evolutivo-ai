import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import fetch from "node-fetch"
import path from "path"

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

// ================================
// FRONTEND
// ================================

app.use(express.static("."))

app.get("/", (req,res)=>{

  res.sendFile(
    path.resolve("index.html")
  )

})

// ================================
// GEMINI AI CHAT
// ================================

app.post("/chat", async (req,res)=>{

  try{

    const { messages } = req.body

    const lastMessage =
    messages[messages.length - 1].content

    const response =
    await fetch(

      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,

      {

        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify({

          contents:[

            {
              parts:[
                {
                  text:lastMessage
                }
              ]
            }

          ]

        })

      }

    )

    const data =
    await response.json()

    console.log(
      JSON.stringify(data,null,2)
    )

    // ============================
    // VALIDAÇÃO DE ERRO
    // ============================

    if(data.error){

      console.error(data.error)

      return res.status(500).json({

        error:data.error.message

      })

    }

    // ============================
    // RESPOSTA GEMINI
    // ============================

    const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text
    ||
    "Não consegui responder."

    res.json({

      choices:[
        {
          message:{
            content:text
          }
        }
      ]

    })

  }catch(error){

    console.error(error)

    res.status(500).json({

      error:"Erro Gemini"

    })

  }

})

// ================================
// CEFIS
// ================================

app.get("/courses", async (req,res)=>{

  try{

    const response =
    await fetch(
      "https://api-v3.cefis.com.br/courses"
    )

    const data =
    await response.json()

    res.json(data)

  }catch(error){

    console.error(error)

    res.status(500).json({

      error:"Erro cursos"

    })

  }

})

// ================================
// SERVER
// ================================

const PORT =
process.env.PORT || 3000

app.listen(PORT, ()=>{

  console.log(
    `Servidor rodando na porta ${PORT}`
  )

})
