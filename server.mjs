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
// GROK AI CHAT
// ================================

app.post("/chat", async (req,res)=>{

  try{

    const { messages } = req.body

    const response =
    await fetch(
      "https://api.x.ai/v1/chat/completions",
      {

        method:"POST",

        headers:{
          "Content-Type":"application/json",

          "Authorization":
          `Bearer ${process.env.XAI_API_KEY}`
        },

        body:JSON.stringify({

          model:"grok-beta",

          messages,

          temperature:0.7

        })

      }
    )

    const data =
    await response.json()

    console.log(
      JSON.stringify(data,null,2)
    )

    if(data.error){

      console.error(data.error)

      return res.status(500).json({

        error:data.error.message

      })

    }

    res.json(data)

  }catch(error){

    console.error(error)

    res.status(500).json({

      error:"Erro servidor"

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
