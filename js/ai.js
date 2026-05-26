const OPENAI_API_KEY =
prompt("Cole sua OpenAI API Key")

async function callOpenAI(messages){

try{

const response = await fetch(
"https://api.openai.com/v1/chat/completions",
{
method:"POST",

headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${OPENAI_API_KEY}`
},

body:JSON.stringify({

model:"gpt-4.1-mini",

messages,

temperature:0.8

})
}
)

if(!response.ok){

throw new Error(
"Erro ao conectar com OpenAI"
)

}

const data = await response.json()

return data.choices[0].message.content

}catch(error){

console.error(error)

return `
Desculpe.
O tutor encontrou um erro.
`

}

}
