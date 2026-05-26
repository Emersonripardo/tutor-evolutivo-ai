async function callOpenAI(messages){

  try{

    const response = await fetch(
      "https://tutor-evolutivo-ai.onrender.com/chat",
      {
        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify({
          messages
        })
      }
    )

    if(!response.ok){

      throw new Error(
        "Erro conexão servidor"
      )

    }

    const data = await response.json()

    return data.choices[0].message.content

  }catch(error){

    console.error(error)

    return `
      Desculpe.
      O servidor encontrou um erro.
    `

  }

}
