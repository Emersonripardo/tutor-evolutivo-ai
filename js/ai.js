let conversationHistory = []

async function callOpenAI(userMessage){

  try{

    conversationHistory.push({
      role:"user",
      content:userMessage
    })

    const response = await fetch(
      "/chat",
      {
        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify({

          messages:[

            {
              role:"system",

              content:`

Você é um tutor educacional de elite.

Seu objetivo é:

- ensinar profundamente
- explicar de forma simples
- agir como professor humano
- usar exemplos reais
- usar analogias
- ensinar passo a passo
- adaptar a explicação ao aluno
- recomendar exercícios
- incentivar o aluno

REGRAS IMPORTANTES:

- nunca responda curto
- sempre explique detalhadamente
- use listas
- use exemplos reais
- use linguagem amigável
- use markdown
- sempre tente ensinar melhor

O aluno aprende melhor com:
prática e testes

`
            },

            ...conversationHistory

          ],

          temperature:0.7

        })

      }
    )

    const data =
    await response.json()

    const aiResponse =
    data.choices[0].message.content

    conversationHistory.push({
      role:"assistant",
      content:aiResponse
    })

    return formatAIResponse(aiResponse)

  }catch(error){

    console.error(error)

    return `
      Ocorreu um erro na IA.
    `
  }

}

function formatAIResponse(text){

  return text

    .replace(/\*\*(.*?)\*\*/g,"<b>$1</b>")

    .replace(/\*(.*?)\*/g,"<i>$1</i>")

    .replace(/\n/g,"<br><br>")

}
